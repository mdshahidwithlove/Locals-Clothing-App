import type { Request, Response } from "express";
import z from "zod";
import ReturnModel from "../Models/returnModel";
import OrderModel from "../Models/orderModel";
import StoreModel from "../Models/storeModel";
import DeliveryModel from "../Models/deliveryModel";
import { RETURN_REASONS } from "../types/return";
import { assignReturnDelivery } from "../services/returnAssignmentService";

const RETURN_WINDOW_MS = 48 * 60 * 60 * 1000;

const createReturnSchema = z.object({
  orderId: z.string().min(1),
  reason: z.enum(RETURN_REASONS),
  notes: z.string().max(500).optional(),
  refundUpiId: z.string().trim().optional(),
});

const refundProofSchema = z.object({
  refundProofImage: z.string().url("Invalid image URL"),
});

function isWithinReturnWindow(deliveryDate?: Date | null): boolean {
  if (!deliveryDate) return false;
  return Date.now() - new Date(deliveryDate).getTime() <= RETURN_WINDOW_MS;
}

async function createReturnRequest(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (user.role !== "User") {
      return res.status(403).json({ success: false, message: "Only customers can request returns" });
    }

    const data = createReturnSchema.parse(req.body);
    const order = await OrderModel.findById(data.orderId).populate("store", "merchantId storeName address");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.user.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (order.status !== "Delivered") {
      return res.status(400).json({ success: false, message: "Returns are only allowed for delivered orders" });
    }

    if (!isWithinReturnWindow(order.deliveryDate)) {
      return res.status(400).json({
        success: false,
        message: "Return window has expired. Returns must be requested within 48 hours of delivery.",
      });
    }

    const existing = await ReturnModel.findOne({ order: order._id });
    if (existing) {
      return res.status(400).json({ success: false, message: "A return request already exists for this order" });
    }

    if (order.paymentMethod === "COD" && !data.refundUpiId?.trim()) {
      return res.status(400).json({ success: false, message: "Refund UPI ID is required for COD orders" });
    }

    const store = order.store as any;
    const merchantId = store?.merchantId;
    if (!merchantId) {
      return res.status(400).json({ success: false, message: "Store merchant not found" });
    }

    const returnRequest = await ReturnModel.create({
      order: order._id,
      customer: user._id,
      merchant: merchantId,
      reason: data.reason,
      notes: data.notes?.trim(),
      refundUpiId: data.refundUpiId?.trim(),
      status: "Pending",
      refundStatus: "Pending",
    });

    const populated = await ReturnModel.findById(returnRequest._id)
      .populate("order", "orderNumber status totalAmount paymentMethod deliveryDate")
      .populate("customer", "name phone");

    return res.status(201).json({
      success: true,
      message: "Return request submitted successfully",
      returnRequest: populated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid input data",
        errors: error.issues.map((err) => ({ field: err.path.join("."), message: err.message })),
      });
    }
    console.error("Error creating return request:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function getReturnByOrderId(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { orderId } = req.params;

    const order = await OrderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (user.role === "User" && order.user.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (user.role === "Merchant") {
      const store = await StoreModel.findOne({ merchantId: user._id });
      if (!store || order.store.toString() !== store._id.toString()) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }

    const returnRequest = await ReturnModel.findOne({ order: orderId })
      .populate("order", "orderNumber status totalAmount paymentMethod deliveryDate shippingAddress")
      .populate("customer", "name phone")
      .populate({
        path: "returnDelivery",
        populate: { path: "deliveryPerson", select: "name phone" },
      });

    const canRequestReturn =
      user.role === "User" &&
      order.status === "Delivered" &&
      !returnRequest &&
      isWithinReturnWindow(order.deliveryDate);

    return res.status(200).json({
      success: true,
      message: "Return details retrieved",
      returnRequest: returnRequest || null,
      canRequestReturn,
      returnWindowExpiresAt: order.deliveryDate
        ? new Date(new Date(order.deliveryDate).getTime() + RETURN_WINDOW_MS)
        : null,
    });
  } catch (error) {
    console.error("Error getting return:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function approveReturn(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { returnId } = req.params;

    const returnRequest = await ReturnModel.findById(returnId).populate({
      path: "order",
      populate: [{ path: "user" }, { path: "store" }],
    });

    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Return request not found" });
    }

    const store = await StoreModel.findOne({ merchantId: user._id });
    if (!store || returnRequest.merchant.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (returnRequest.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot approve return with status: ${returnRequest.status}`,
      });
    }

    const order = returnRequest.order as any;
    const storeDoc = order.store;

    const returnDelivery = await DeliveryModel.create({
      order: order._id,
      deliveryType: "RETURN",
      pickupAddress: order.shippingAddress,
      deliveryAddress: storeDoc?.address || store.address || "Store address",
      estimatedDeliveryTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      deliveryFee: 0,
      status: "Pending",
      returnRequest: returnRequest._id,
    });

    returnRequest.status = "Approved";
    returnRequest.returnDelivery = returnDelivery._id;
    await returnRequest.save();

    await assignReturnDelivery(returnDelivery._id.toString(), order);

    const populated = await ReturnModel.findById(returnRequest._id)
      .populate("order", "orderNumber status totalAmount paymentMethod")
      .populate("customer", "name phone")
      .populate({
        path: "returnDelivery",
        populate: { path: "deliveryPerson", select: "name phone" },
      });

    return res.status(200).json({
      success: true,
      message: "Return approved. Pickup delivery has been scheduled.",
      returnRequest: populated,
    });
  } catch (error) {
    console.error("Error approving return:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function rejectReturn(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { returnId } = req.params;

    const returnRequest = await ReturnModel.findById(returnId);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Return request not found" });
    }

    if (returnRequest.merchant.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (returnRequest.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot reject return with status: ${returnRequest.status}`,
      });
    }

    returnRequest.status = "Rejected";
    await returnRequest.save();

    const populated = await ReturnModel.findById(returnRequest._id)
      .populate("order", "orderNumber status")
      .populate("customer", "name phone");

    return res.status(200).json({
      success: true,
      message: "Return request rejected",
      returnRequest: populated,
    });
  } catch (error) {
    console.error("Error rejecting return:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function completeRefund(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { returnId } = req.params;

    const returnRequest = await ReturnModel.findById(returnId).populate("returnDelivery");
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Return request not found" });
    }

    if (returnRequest.merchant.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (returnRequest.status !== "Approved") {
      return res.status(400).json({
        success: false,
        message: "Refund can only be marked completed for approved returns",
      });
    }

    const returnDelivery = returnRequest.returnDelivery as any;
    if (!returnDelivery || returnDelivery.status !== "Delivered") {
      return res.status(400).json({
        success: false,
        message: "Item must be delivered back to the merchant before marking refund completed",
      });
    }

    returnRequest.refundStatus = "Completed";
    returnRequest.status = "Completed";
    await returnRequest.save();

    await OrderModel.findByIdAndUpdate(returnRequest.order, {
      paymentStatus: "Refunded",
    });

    const populated = await ReturnModel.findById(returnRequest._id)
      .populate("order", "orderNumber status totalAmount paymentMethod")
      .populate("customer", "name phone");

    return res.status(200).json({
      success: true,
      message: "Refund marked as completed",
      returnRequest: populated,
    });
  } catch (error) {
    console.error("Error completing refund:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function uploadRefundProof(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { returnId } = req.params;
    const { refundProofImage } = refundProofSchema.parse(req.body);

    const returnRequest = await ReturnModel.findById(returnId);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Return request not found" });
    }

    if (returnRequest.merchant.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (!["Approved", "Completed"].includes(returnRequest.status)) {
      return res.status(400).json({
        success: false,
        message: "Refund proof can only be uploaded for approved or completed returns",
      });
    }

    returnRequest.refundProofImage = refundProofImage;
    await returnRequest.save();

    return res.status(200).json({
      success: true,
      message: "Refund proof uploaded successfully",
      returnRequest,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: "Invalid image URL" });
    }
    console.error("Error uploading refund proof:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function getMerchantReturns(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (user.role !== "Merchant") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const returns = await ReturnModel.find({ merchant: user._id })
      .populate("order", "orderNumber status totalAmount paymentMethod shippingAddress items")
      .populate("customer", "name phone avatar")
      .populate({
        path: "returnDelivery",
        populate: { path: "deliveryPerson", select: "name phone" },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      returns,
    });
  } catch (error) {
    console.error("Error fetching merchant returns:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

export {
  createReturnRequest,
  getReturnByOrderId,
  getMerchantReturns,
  approveReturn,
  rejectReturn,
  completeRefund,
  uploadRefundProof,
  isWithinReturnWindow,
};
