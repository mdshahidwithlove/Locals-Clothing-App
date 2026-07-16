import type { Request, Response } from "express";
import OrderModel from "../Models/orderModel";
import StoreModel from "../Models/storeModel";
import PaymentModel from "../Models/paymentModel";
import { sendErrorResponse } from "../utils/validation";
import Razorpay from "razorpay";
import { releaseInventory } from "../utils/orderUtils";
import { notifyOrderAccepted, notifyOrderRejected, notifyOrderReady } from "../utils/notificationUtils";

/**
 * Accept order by merchant
 */
export async function acceptOrder(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { orderId } = req.params;

    if (user.role !== "Merchant") {
      return sendErrorResponse(res, 403, "Only merchants can accept orders");
    }

    // Find merchant's store
    const store = await StoreModel.findOne({ merchantId: user._id });
    if (!store) {
      return sendErrorResponse(res, 404, "Store not found for this merchant");
    }

    // Find order
    const order = await OrderModel.findById(orderId);
    if (!order) {
      return sendErrorResponse(res, 404, "Order not found");
    }

    // Check if order belongs to merchant's store
    if (order.store.toString() !== store._id.toString()) {
      return sendErrorResponse(res, 403, "This order does not belong to your store");
    }

    // Check if order is in Pending status
    if (order.status !== "Pending") {
      return sendErrorResponse(res, 400, `Cannot accept order with status: ${order.status}`);
    }

    // For online payment, check if payment is completed
    if (order.paymentMethod === "Online" && order.paymentStatus !== "Completed") {
      return sendErrorResponse(res, 400, "Payment not completed for this order");
    }

    // Accept the order
    order.status = "Accepted";
    order.merchantAcceptedAt = new Date();
    order.statusHistory.push({
      status: "Accepted",
      timestamp: new Date(),
      updatedBy: user._id,
      note: "Order accepted by merchant"
    });
    await order.save();

    // Notify customer
    await notifyOrderAccepted(
      order._id,
      order.orderNumber || order._id.toString().slice(-8),
      order.user as any,
      store._id,
      store.storeName
    );

    return res.status(200).json({
      success: true,
      message: "Order accepted successfully",
      order
    });

  } catch (error) {
    console.error("Error accepting order:", error);
    return sendErrorResponse(res, 500, "Internal server error");
  }
}

/**
 * Reject order by merchant
 */
export async function rejectOrder(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return sendErrorResponse(res, 400, "Rejection reason is required (minimum 10 characters)");
    }

    if (user.role !== "Merchant") {
      return sendErrorResponse(res, 403, "Only merchants can reject orders");
    }

    // Find merchant's store
    const store = await StoreModel.findOne({ merchantId: user._id });
    if (!store) {
      return sendErrorResponse(res, 404, "Store not found for this merchant");
    }

    // Find order
    const order = await OrderModel.findById(orderId);
    if (!order) {
      return sendErrorResponse(res, 404, "Order not found");
    }

    // Check if order belongs to merchant's store
    if (order.store.toString() !== store._id.toString()) {
      return sendErrorResponse(res, 403, "This order does not belong to your store");
    }

    // Check if order is in Pending status
    if (order.status !== "Pending") {
      return sendErrorResponse(res, 400, `Cannot reject order with status: ${order.status}`);
    }

    // Reject the order
    order.status = "Rejected";
    order.rejectionReason = reason.trim();
    order.statusHistory.push({
      status: "Rejected",
      timestamp: new Date(),
      updatedBy: user._id,
      note: `Order rejected: ${reason.trim()}`
    });
    await order.save();

    // Release inventory
    await releaseInventory(order.orderItems);

    // Handle refund for online payments (Razorpay)
    let refundStatus: 'not_applicable' | 'completed' | 'failed' | 'pending' = 'not_applicable';
    if (order.paymentMethod === "Online" && order.paymentStatus === "Completed") {
      try {
        const payment = await PaymentModel.findById(order.paymentId);
        if (payment && payment.gatewayPaymentId) {
          const keyId = process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEYID || "";
          const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_API_SECRET || "";
          const rp = new Razorpay({ key_id: keyId, key_secret: keySecret });

          const refund = await rp.payments.refund(payment.gatewayPaymentId, {
            amount: Math.round((payment.amount || 0) * 100),
            speed: "optimum",
            notes: { reason: "Order rejected by merchant", orderId: String(order._id) }
          } as any);

          // Update payment with refund details
          payment.paymentStatus = "Refunded";
          payment.refundAmount = Math.round((refund.amount || 0) / 100);
          payment.refundReason = "Order rejected by merchant";
          payment.refundDate = new Date();
          payment.refundTransactionId = refund.id;
          await payment.save();

          // Update order payment status
          order.paymentStatus = "Refunded";
          await order.save();
          refundStatus = 'completed';
        } else {
          console.warn("Payment record missing or no gatewayPaymentId for refund", order._id);
          refundStatus = 'failed';
        }
      } catch (refundErr) {
        console.error("Refund error:", refundErr);
        refundStatus = 'failed';
      }
    }

    // Notify customer
    await notifyOrderRejected(
      order._id,
      order.orderNumber || order._id.toString().slice(-8),
      order.user as any,
      store._id,
      store.storeName,
      reason.trim()
    );

    return res.status(200).json({
      success: true,
      message: "Order rejected successfully",
      order,
      refundStatus,
    });

  } catch (error) {
    console.error("Error rejecting order:", error);
    return sendErrorResponse(res, 500, "Internal server error");
  }
}

/**
 * Mark order as ready for pickup
 */
export async function markReadyForPickup(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { orderId } = req.params;

    if (user.role !== "Merchant") {
      return sendErrorResponse(res, 403, "Only merchants can mark orders as ready");
    }

    // Find merchant's store
    const store = await StoreModel.findOne({ merchantId: user._id });
    if (!store) {
      return sendErrorResponse(res, 404, "Store not found for this merchant");
    }

    // Find order
    const order = await OrderModel.findById(orderId);
    if (!order) {
      return sendErrorResponse(res, 404, "Order not found");
    }

    // Check if order belongs to merchant's store
    if (order.store.toString() !== store._id.toString()) {
      return sendErrorResponse(res, 403, "This order does not belong to your store");
    }

    // Check if order is in Accepted or Processing status
    if (!["Accepted", "Processing"].includes(order.status)) {
      return sendErrorResponse(res, 400, `Cannot mark order as ready from status: ${order.status}`);
    }

    // Update order status
    order.status = "ReadyForPickup";
    order.statusHistory.push({
      status: "ReadyForPickup",
      timestamp: new Date(),
      updatedBy: user._id,
      note: "Order packed and ready for pickup"
    });
    await order.save();

    // Notify customer
    await notifyOrderReady(
      order._id,
      order.orderNumber || order._id.toString().slice(-8),
      order.user as any,
      store._id,
      store.storeName
    );

    // Auto-assign delivery partner using the centralized assignment service
    // This runs in the background so the merchant response is not delayed
    try {
      const { processUnassignedOrders } = await import("../services/orderAssignmentService");
      
      // Fire-and-forget: the centralized service has all the safety checks
      // (race condition double-check, active delivery check, proximity algorithm)
      processUnassignedOrders()
        .then(() => {
          console.log(`✅ [Ready For Pickup] Assignment service triggered for order ${order._id}`);
        })
        .catch((assignError) => {
          console.error(`❌ [Ready For Pickup] Assignment service error for order ${order._id}:`, assignError);
        });
    } catch (importError) {
      console.error("❌ Error importing assignment service:", importError);
      // Don't fail the entire request if auto-assignment fails
    }

    return res.status(200).json({
      success: true,
      message: "Order marked as ready for pickup and delivery partner assigned",
      order
    });

  } catch (error) {
    console.error("Error marking order ready:", error);
    return sendErrorResponse(res, 500, "Internal server error");
  }
}

/**
 * Get merchant's orders
 */
export async function getMerchantOrders(req: Request, res: Response) {
  try {
    const user = (req as any).user;

    if (user.role !== "Merchant") {
      return sendErrorResponse(res, 403, "Only merchants can access this endpoint");
    }

    // Find merchant's store
    const store = await StoreModel.findOne({ merchantId: user._id });
    if (!store) {
      return sendErrorResponse(res, 404, "Store not found for this merchant");
    }

    // Get query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;

    // Build filter
    const filter: any = { store: store._id };
    if (status) {
      filter.status = status;
    }

    // Calculate skip
    const skip = (page - 1) * limit;

    // Get orders
    const orders = await OrderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "name phone email")
      .populate("orderItems.product", "name images price");

    const totalOrders = await OrderModel.countDocuments(filter);

    return res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      orders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
        hasNextPage: page < Math.ceil(totalOrders / limit),
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error("Error getting merchant orders:", error);
    return sendErrorResponse(res, 500, "Internal server error");
  }
}

/**
 * Get merchant analytics (sales, profit, rider cash status, best sellers, trending products)
 */
export async function getMerchantAnalytics(req: Request, res: Response) {
  try {
    const user = (req as any).user;

    if (user.role !== "Merchant") {
      return sendErrorResponse(res, 403, "Only merchants can view analytics");
    }

    // Find store
    const store = await StoreModel.findOne({ merchantId: user._id });
    if (!store) {
      return sendErrorResponse(res, 404, "Store not found for this merchant");
    }

    // 1. Financials: match delivered orders for this store
    const financialsResult = await OrderModel.aggregate([
      { $match: { store: store._id, status: "Delivered" } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$itemsTotal" },
          totalOrders: { $sum: 1 },
          platformFees: { $sum: "$platformFee" },
          netEarnings: { $sum: { $subtract: ["$itemsTotal", "$platformFee"] } }
        }
      }
    ]);

    const financials = financialsResult[0] || {
      totalSales: 0,
      totalOrders: 0,
      platformFees: 0,
      netEarnings: 0
    };

    // 2. COD Cash: unsubmitted and submitted amounts
    const codStatsResult = await PaymentModel.aggregate([
      { $match: { store: store._id, paymentMethod: "COD", paymentStatus: "Completed" } },
      {
        $group: {
          _id: "$codSubmittedToStore",
          totalAmount: { $sum: "$amount" }
        }
      }
    ]);

    let unsubmittedCodAmount = 0;
    let submittedCodAmount = 0;

    codStatsResult.forEach(item => {
      if (item._id === true) {
        submittedCodAmount = item.totalAmount;
      } else {
        unsubmittedCodAmount = item.totalAmount;
      }
    });

    // 3. Rider Cash holding details for this store
    const riderCashHoldings = await PaymentModel.aggregate([
      {
        $match: {
          store: store._id,
          paymentMethod: "COD",
          paymentStatus: "Completed",
          codSubmittedToStore: false,
          codCollectedBy: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: "$codCollectedBy",
          cashAmount: { $sum: "$amount" },
          payments: {
            $push: {
              paymentId: "$_id",
              order: "$order",
              amount: "$amount",
              collectedAt: "$codCollectedAt"
            }
          }
        }
      }
    ]);

    // Populate rider details manually
    const populatedRiderHoldings = [];
    const UserModel = require("../Models/userModel").default;
    const OrderModelForPop = require("../Models/orderModel").default;

    for (const riderGroup of riderCashHoldings) {
      const rider = await UserModel.findById(riderGroup._id).select("name phone").lean();
      
      const paymentsWithOrders = [];
      for (const p of riderGroup.payments) {
        const order = await OrderModelForPop.findById(p.order).select("orderNumber").lean();
        paymentsWithOrders.push({
          ...p,
          orderNumber: order?.orderNumber || p.order.toString().slice(-6)
        });
      }

      populatedRiderHoldings.push({
        riderId: riderGroup._id,
        riderName: rider?.name || "Unknown Rider",
        riderPhone: rider?.phone || "—",
        cashAmount: riderGroup.cashAmount,
        payments: paymentsWithOrders
      });
    }

    // 4. Best Seller products (top 5 by quantity sold)
    const bestSellersResult = await OrderModel.aggregate([
      { $match: { store: store._id, status: "Delivered" } },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.product",
          totalSold: { $sum: "$orderItems.quantity" },
          revenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 }
    ]);

    // Populate product details manually
    const ProductModel = require("../Models/productModel").default;
    const bestSellers = [];
    for (const item of bestSellersResult) {
      const product = await ProductModel.findById(item._id).select("name images price category").lean();
      if (product) {
        bestSellers.push({
          ...item,
          product
        });
      }
    }

    // 5. Trending products (top 5 by quantity sold in last 14 days)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const trendingResult = await OrderModel.aggregate([
      { $match: { store: store._id, status: "Delivered", createdAt: { $gte: fourteenDaysAgo } } },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.product",
          recentSold: { $sum: "$orderItems.quantity" }
        }
      },
      { $sort: { recentSold: -1 } },
      { $limit: 5 }
    ]);

    const trending = [];
    for (const item of trendingResult) {
      const product = await ProductModel.findById(item._id).select("name images price category").lean();
      if (product) {
        trending.push({
          ...item,
          product
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Merchant analytics retrieved successfully",
      analytics: {
        financials,
        codSummary: {
          unsubmittedCodAmount,
          submittedCodAmount,
          riderHoldings: populatedRiderHoldings
        },
        bestSellers,
        trending
      }
    });

  } catch (error) {
    console.error("Error getting merchant analytics:", error);
    return sendErrorResponse(res, 500, "Internal server error");
  }
}

/**
 * Verify receipt of COD cash from rider (merchant marks payment as submitted/received)
 */
export async function verifyCodReceipt(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { paymentIds } = req.body;

    if (user.role !== "Merchant") {
      return sendErrorResponse(res, 403, "Only merchants can verify COD receipt");
    }

    if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
      return sendErrorResponse(res, 400, "Payment IDs array is required");
    }

    // Find store
    const store = await StoreModel.findOne({ merchantId: user._id });
    if (!store) {
      return sendErrorResponse(res, 404, "Store not found for this merchant");
    }

    // Update payments
    const result = await PaymentModel.updateMany(
      {
        _id: { $in: paymentIds },
        store: store._id,
        paymentMethod: "COD",
        codSubmittedToStore: false
      },
      {
        $set: {
          codSubmittedToStore: true,
          codSubmittedAt: new Date(),
          notes: "Confirmed received by Merchant"
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: `Successfully verified receipt of ${result.modifiedCount} payment(s)`,
      verifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error("Error verifying COD receipt:", error);
    return sendErrorResponse(res, 500, "Internal server error");
  }
}

