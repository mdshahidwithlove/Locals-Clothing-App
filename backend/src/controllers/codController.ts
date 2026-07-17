import type { Request, Response } from "express";
import OrderModel from "../Models/orderModel";
import PaymentModel from "../Models/paymentModel";
import DeliveryModel from "../Models/deliveryModel";
import { sendErrorResponse } from "../utils/validation";

/**
 * Mark COD as collected by delivery person
 */
export async function markCodCollected(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { orderId } = req.params;

    if (user.role !== "Delivery") {
      return sendErrorResponse(res, 403, "Only delivery persons can mark COD as collected");
    }

    // Find order
    const order = await OrderModel.findById(orderId);
    if (!order) {
      return sendErrorResponse(res, 404, "Order not found");
    }

    // Check if order is assigned to this delivery person
    if (!order.deliveryPerson || order.deliveryPerson.toString() !== user._id.toString()) {
      return sendErrorResponse(res, 403, "This order is not assigned to you");
    }

    // Check if payment method is COD
    if (order.paymentMethod !== "COD") {
      return sendErrorResponse(res, 400, "This order is not a COD order");
    }

    // Verify delivery assignment and status against Delivery entity
    const delivery = await DeliveryModel.findOne({
      order: orderId,
      deliveryPerson: user._id,
      deliveryType: { $ne: 'RETURN' },
    });
    if (!delivery) {
      return sendErrorResponse(res, 403, "No delivery assignment found for this order");
    }

    // Allow collecting COD once the parcel is picked up, on the way, or delivered (Delivery status)
    if (!["PickedUp", "OnTheWay", "Delivered"].includes(delivery.status)) {
      return sendErrorResponse(res, 400, "Delivery must be picked up before marking COD as collected");
    }

    // Find or create payment record
    let payment = await PaymentModel.findOne({ order: orderId });
    
    if (!payment) {
      payment = new PaymentModel({
        order: order._id,
        user: order.user,
        store: order.store,
        amount: Math.round(order.totalAmount),
        paymentMethod: "COD",
        paymentStatus: "Completed"
      });
    }

    payment.paymentStatus = "Completed";
    payment.codCollectedBy = user._id;
    payment.codCollectedAt = new Date();
    payment.transactionDate = new Date();
    await payment.save();

    // Update order payment status
    order.paymentStatus = "Completed";
    if (!order.paymentId) {
      order.paymentId = payment._id as any;
    }
    await order.save();

    return res.status(200).json({
      success: true,
      message: "COD marked as collected successfully",
      payment: {
        _id: payment._id,
        amount: payment.amount,
        codCollectedAt: payment.codCollectedAt
      }
    });

  } catch (error) {
    console.error("Error marking COD collected:", error);
    return sendErrorResponse(res, 500, "Internal server error");
  }
}

/**
 * Submit collected COD to store/admin
 */
export async function submitCodToStore(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { paymentIds } = req.body;

    if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
      return sendErrorResponse(res, 400, "Payment IDs array is required");
    }

    if (user.role !== "Delivery") {
      return sendErrorResponse(res, 403, "Only delivery persons can submit COD");
    }

    const submittedPayments = [];
    const errors = [];

    for (const paymentId of paymentIds) {
      try {
        const payment = await PaymentModel.findById(paymentId);
        
        if (!payment) {
          errors.push({ paymentId, error: "Payment not found" });
          continue;
        }

        if (payment.codCollectedBy?.toString() !== user._id.toString()) {
          errors.push({ paymentId, error: "Payment not collected by you" });
          continue;
        }

        if (payment.codSubmittedToStore) {
          errors.push({ paymentId, error: "COD already submitted" });
          continue;
        }

        payment.codSubmittedToStore = true;
        payment.codSubmittedAt = new Date();
        await payment.save();

        submittedPayments.push({
          paymentId: payment._id,
          orderId: payment.order,
          amount: payment.amount
        });

      } catch (err) {
        errors.push({ paymentId, error: "Failed to submit" });
      }
    }

    const totalAmount = submittedPayments.reduce((sum, p) => sum + p.amount, 0);

    return res.status(200).json({
      success: true,
      message: `Successfully submitted ${submittedPayments.length} COD payment(s)`,
      submittedPayments,
      totalAmount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Error submitting COD:", error);
    return sendErrorResponse(res, 500, "Internal server error");
  }
}

/**
 * Get delivery person's COD collection summary
 */
export async function getCodSummary(req: Request, res: Response) {
  try {
    const user = (req as any).user;

    if (user.role !== "Delivery") {
      return sendErrorResponse(res, 403, "Only delivery persons can access COD summary");
    }

    // Get collected but not submitted
    const collectedNotSubmitted = await PaymentModel.find({
      codCollectedBy: user._id,
      codSubmittedToStore: false,
      paymentMethod: "COD"
    }).populate("order", "orderNumber totalAmount");

    const collectedNotSubmittedAmount = collectedNotSubmitted.reduce(
      (sum, p) => sum + p.amount, 0
    );

    // Get submitted
    const submitted = await PaymentModel.find({
      codCollectedBy: user._id,
      codSubmittedToStore: true,
      paymentMethod: "COD"
    }).populate("order", "orderNumber totalAmount");

    const submittedAmount = submitted.reduce((sum, p) => sum + p.amount, 0);

    // Get total collected
    const totalCollected = await PaymentModel.find({
      codCollectedBy: user._id,
      paymentMethod: "COD"
    });

    const totalCollectedAmount = totalCollected.reduce((sum, p) => sum + p.amount, 0);

    return res.status(200).json({
      success: true,
      message: "COD summary retrieved successfully",
      summary: {
        collectedNotSubmitted: {
          count: collectedNotSubmitted.length,
          amount: collectedNotSubmittedAmount,
          payments: collectedNotSubmitted
        },
        submitted: {
          count: submitted.length,
          amount: submittedAmount
        },
        totalCollected: {
          count: totalCollected.length,
          amount: totalCollectedAmount
        }
      }
    });

  } catch (error) {
    console.error("Error getting COD summary:", error);
    return sendErrorResponse(res, 500, "Internal server error");
  }
}

/**
 * Settle unsubmitted COD cash online
 */
export async function settleCodOnline(req: Request, res: Response) {
  try {
    const user = (req as any).user;

    if (user.role !== "Delivery") {
      return sendErrorResponse(res, 403, "Only delivery persons can settle COD online");
    }

    // Get collected but not submitted COD payments
    const payments = await PaymentModel.find({
      codCollectedBy: user._id,
      codSubmittedToStore: false,
      paymentMethod: "COD",
      paymentStatus: "Completed"
    });

    if (payments.length === 0) {
      return sendErrorResponse(res, 400, "No pending COD cash to settle");
    }

    const totalSettledAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    // Update all payments to submitted/settled
    for (const payment of payments) {
      payment.codSubmittedToStore = true;
      payment.codSubmittedAt = new Date();
      payment.notes = (payment.notes ? payment.notes + " | " : "") + "Settled online by Rider";
      await payment.save();
    }

    return res.status(200).json({
      success: true,
      message: `Successfully settled ₹${totalSettledAmount} online`,
      count: payments.length,
      amount: totalSettledAmount
    });

  } catch (error) {
    console.error("Error settling COD online:", error);
    return sendErrorResponse(res, 500, "Internal server error");
  }
}

