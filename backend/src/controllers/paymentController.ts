import type { Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import OrderModel from "../Models/orderModel";
import PaymentModel from "../Models/paymentModel";
import StoreModel from "../Models/storeModel";
import { sendErrorResponse } from "../utils/validation";
import { notifyPaymentSuccess, notifyPaymentFailed } from "../utils/notificationUtils";
import { releaseInventory } from "../utils/orderUtils";
import type { Types } from "mongoose";

import { getConfig } from "../services/configService";

// Initialize Razorpay instance
let razorpayInstance: Razorpay | null = null;

export function initializeRazorpay(keyId: string, keySecret: string) {
  razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
  console.log("Razorpay initialized successfully");
}

export async function getPaymentConfig(req: Request, res: Response) {
  try {
    const keyId = getConfig("RAZORPAY_KEY_ID") || getConfig("RAZORPAY_KEYID") || process.env.RAZORPAY_KEY_ID || "";
    const keySecret = getConfig("RAZORPAY_KEY_SECRET") || getConfig("RAZORPAY_API_SECRET") || process.env.RAZORPAY_KEY_SECRET || "";
    const isEnabled = Boolean(keyId && keySecret);

    return res.status(200).json({
      success: true,
      keyId,
      isEnabled,
      currency: "INR"
    });
  } catch (error) {
    console.error("Error getting payment config:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * Create Razorpay order
 */
export async function createRazorpayOrder(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { orderId, orderIds } = req.body as { orderId?: string; orderIds?: string[] };

    if (!orderId && (!orderIds || orderIds.length === 0)) {
      return sendErrorResponse(res, 400, "Order ID(s) are required");
    }

    // Normalize to an array of order ids to support single or multiple
    const targetOrderIds = (orderIds && orderIds.length > 0) ? orderIds : [orderId as string];

    // Load all orders and validate ownership/method/status
    const orders = await OrderModel.find({ _id: { $in: targetOrderIds } });
    if (orders.length !== targetOrderIds.length) {
      return sendErrorResponse(res, 404, "One or more orders not found");
    }

    for (const o of orders) {
      if (o.user.toString() !== user._id.toString()) {
        return sendErrorResponse(res, 403, "Access denied for one or more orders");
      }
      if (o.paymentStatus === "Completed") {
        return sendErrorResponse(res, 400, `Order ${o.orderNumber || o._id} is already paid`);
      }
      if (o.paymentMethod !== "Online") {
        return sendErrorResponse(res, 400, `Order ${o.orderNumber || o._id} payment method is not Online`);
      }
    }

    if (!razorpayInstance) {
      return sendErrorResponse(res, 500, "Payment gateway not initialized");
    }

    // Compute total amount across orders (ensure whole numbers)
    const totalAmount = Math.round(orders.reduce((sum, o) => sum + o.totalAmount, 0));

    // Guard against empty
    if (orders.length === 0) {
      return sendErrorResponse(res, 400, "No orders to pay");
    }

    // Create a single Razorpay order for all
    const primary = orders[0];
    const baseRef = primary ? String(primary.orderNumber || primary._id) : String(Date.now());
    const shortRef = baseRef.slice(-8);
    const tsShort = Date.now().toString().slice(-6);
    const receiptStr = `grp_${shortRef}_${tsShort}`; // <= 40 chars
    const razorpayOrder = await razorpayInstance.orders.create({
      amount: Math.round(totalAmount * 100), // Amount in paise
      currency: "INR",
      receipt: receiptStr,
      notes: {
        orderIds: JSON.stringify(orders.map(o => o._id.toString())),
        userId: user._id.toString(),
      }
    });

    // Create payment records per order, all tied to the same gatewayOrderId
    const paymentIds: string[] = [];
    for (const o of orders) {
      const payment = new PaymentModel({
        order: o._id,
        user: user._id,
        store: o.store,
        amount: Math.round(o.totalAmount),
        paymentMethod: "Online",
        paymentStatus: "Pending",
        paymentGateway: "Razorpay",
        gatewayOrderId: razorpayOrder.id,
        metadata: { group: razorpayOrder.id }
      });
      await payment.save();
      o.paymentId = payment._id as any;
      await o.save();
      paymentIds.push(String(payment._id));
    }

    return res.status(200).json({
      success: true,
      message: "Razorpay order created successfully",
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency
      },
      paymentIds,
      keyId: getConfig("RAZORPAY_KEY_ID") || getConfig("RAZORPAY_KEYID") || process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEYID
    });

  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return sendErrorResponse(res, 500, "Failed to create payment order");
  }
}

/**
 * Verify Razorpay payment
 */
export async function verifyRazorpayPayment(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentId,
      paymentIds,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || (!paymentId && (!paymentIds || paymentIds.length === 0))) {
      return sendErrorResponse(res, 400, "Missing payment verification details");
    }

    // Load payments (single or multiple)
    const targetPaymentIds = (paymentIds && paymentIds.length > 0) ? paymentIds : [paymentId];
    const payments = await PaymentModel.find({ _id: { $in: targetPaymentIds } });
    if (payments.length !== targetPaymentIds.length) {
      return sendErrorResponse(res, 404, "One or more payment records not found");
    }
    const orderIds = payments.map(p => p.order);
    const orders = await OrderModel.find({ _id: { $in: orderIds } });
    for (const o of orders) {
      if (o.user.toString() !== user._id.toString()) {
        return sendErrorResponse(res, 403, "Access denied");
      }
    }

    if (!razorpayInstance) {
      return sendErrorResponse(res, 500, "Payment gateway not initialized");
    }

    // Verify signature
    const keySecret = getConfig("RAZORPAY_KEY_SECRET") || getConfig("RAZORPAY_API_SECRET") || process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_API_SECRET || "";
    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      // Signature verification failed for the group: mark all as failed and release inventory
      for (const p of payments) {
        p.paymentStatus = "Failed";
        p.notes = "Signature verification failed";
        await p.save();
      }
      for (const o of orders) {
        o.paymentStatus = "Failed";
        await o.save();
        await releaseInventory(o.orderItems);
        await notifyPaymentFailed(
          o._id,
          o.orderNumber || o._id.toString().slice(-8),
          user._id,
          o.totalAmount,
          o.store as unknown as Types.ObjectId
        );
      }

      return sendErrorResponse(res, 400, "Payment verification failed");
    }

    // Payment verified successfully - update all payments and orders in the group
    for (const p of payments) {
      p.paymentStatus = "Completed";
      p.gatewayPaymentId = razorpay_payment_id;
      p.gatewaySignature = razorpay_signature;
      p.transactionId = razorpay_payment_id;
      p.transactionDate = new Date();
      await p.save();
    }

    for (const o of orders) {
      o.paymentStatus = "Completed";
      await o.save();
    }

    // Notify user (summarize first order id)
    const first = orders[0];
    if (first) {
      await notifyPaymentSuccess(
        first._id,
        first.orderNumber || first._id.toString().slice(-8),
        user._id,
        first.totalAmount,
        first.store as unknown as Types.ObjectId
      );
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      orders: orders.map(o => ({
        _id: o._id,
        orderNumber: o.orderNumber,
        paymentStatus: o.paymentStatus,
        status: o.status
      }))
    });

  } catch (error) {
    console.error("Error verifying payment:", error);
    return sendErrorResponse(res, 500, "Payment verification failed");
  }
}

/**
 * Handle Razorpay webhook
 */
export async function handleRazorpayWebhook(req: Request, res: Response) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
    const signature = req.headers["x-razorpay-signature"] as string;

    // Verify webhook signature – req.body is raw Buffer due to express.raw()
    const body = (req as any).body instanceof Buffer ? (req as any).body : Buffer.from(JSON.stringify(req.body));
    const generatedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    if (generatedSignature !== signature) {
      console.error("Webhook signature verification failed");
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const json = JSON.parse(body.toString());
    const event = json.event;
    const payload = json.payload?.payment?.entity;

    console.log(`Webhook received: ${event}`);

    switch (event) {
      case "payment.captured":
        await handlePaymentCaptured(payload);
        break;
      
      case "payment.failed":
        await handlePaymentFailed(payload);
        break;
      
      case "refund.created":
        await handleRefundCreated(payload);
        break;
      
      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    return res.status(200).json({ success: true, message: "Webhook processed" });

  } catch (error) {
    console.error("Error handling webhook:", error);
    return res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
}

async function handlePaymentCaptured(payload: any) {
  try {
    const payment = await PaymentModel.findOne({ gatewayOrderId: payload.order_id });
    if (!payment) {
      console.error("Payment record not found for order:", payload.order_id);
      return;
    }

    if (payment.paymentStatus !== "Completed") {
      payment.paymentStatus = "Completed";
      payment.gatewayPaymentId = payload.id;
      payment.transactionId = payload.id;
      payment.transactionDate = new Date();
      await payment.save();

      // Update all payments in the group and corresponding orders
      const groupedPayments = await PaymentModel.find({ gatewayOrderId: payload.order_id });
      const groupedOrderIds = groupedPayments.map(p => p.order);
      await PaymentModel.updateMany({ gatewayOrderId: payload.order_id }, {
        $set: { paymentStatus: "Completed", gatewayPaymentId: payload.id, transactionId: payload.id, transactionDate: new Date() }
      });
      const orders = await OrderModel.find({ _id: { $in: groupedOrderIds } });
      for (const o of orders) {
        if (o.paymentStatus !== "Completed") {
          o.paymentStatus = "Completed";
          await o.save();
        }
      }
    }
  } catch (error) {
    console.error("Error handling payment captured:", error);
  }
}

async function handlePaymentFailed(payload: any) {
  try {
    const payment = await PaymentModel.findOne({ gatewayOrderId: payload.order_id });
    if (!payment) {
      console.error("Payment record not found for order:", payload.order_id);
      return;
    }

    payment.paymentStatus = "Failed";
    payment.notes = payload.error_description || "Payment failed";
    await payment.save();

    const order = await OrderModel.findById(payment.order);
    if (order) {
      order.paymentStatus = "Failed";
      order.status = "Cancelled";
      order.cancellationReason = "Payment failed";
      order.cancelledAt = new Date();
      await order.save();

      // Release inventory
      await releaseInventory(order.orderItems);
    }
  } catch (error) {
    console.error("Error handling payment failed:", error);
  }
}

async function handleRefundCreated(payload: any) {
  try {
    const payment = await PaymentModel.findOne({ gatewayPaymentId: payload.payment_id });
    if (!payment) {
      console.error("Payment record not found for payment:", payload.payment_id);
      return;
    }

    payment.paymentStatus = "Refunded";
    payment.refundAmount = Math.round(payload.amount / 100); // Convert from paise and round
    payment.refundTransactionId = payload.id;
    payment.refundDate = new Date();
    await payment.save();

    const order = await OrderModel.findById(payment.order);
    if (order) {
      order.paymentStatus = "Refunded";
      await order.save();
    }
  } catch (error) {
    console.error("Error handling refund created:", error);
  }
}

/**
 * Get payment details for an order
 */
export async function getPaymentDetails(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { orderId } = req.params;

    const order = await OrderModel.findById(orderId);
    if (!order) {
      return sendErrorResponse(res, 404, "Order not found");
    }

    // Check permissions
    if (user.role === "User" && order.user.toString() !== user._id.toString()) {
      return sendErrorResponse(res, 403, "Access denied");
    }

    if (user.role === "Merchant") {
      const store = await StoreModel.findOne({ merchantId: user._id });
      if (!store || order.store.toString() !== store._id.toString()) {
        return sendErrorResponse(res, 403, "Access denied");
      }
    }

    const payment = await PaymentModel.findOne({ order: orderId })
      .populate("user", "name phone email")
      .populate("store", "storeName");

    if (!payment) {
      return sendErrorResponse(res, 404, "Payment record not found");
    }

    return res.status(200).json({
      success: true,
      message: "Payment details retrieved successfully",
      payment
    });

  } catch (error) {
    console.error("Error getting payment details:", error);
    return sendErrorResponse(res, 500, "Internal server error");
  }
}

/**
 * Retry payment for a pending/failed order
 */
export async function retryPayment(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { orderId } = req.params;

    // Find order
    const order = await OrderModel.findById(orderId);
    if (!order) {
      return sendErrorResponse(res, 404, "Order not found");
    }

    // Check if user owns the order
    if (order.user.toString() !== user._id.toString()) {
      return sendErrorResponse(res, 403, "Access denied. You can only retry payment for your own orders");
    }

    // Check if payment is pending or failed
    if (!['Pending', 'Failed'].includes(order.paymentStatus)) {
      return sendErrorResponse(res, 400, `Cannot retry payment. Current payment status: ${order.paymentStatus}`);
    }

    // Check if payment method is online
    if (order.paymentMethod !== 'Online') {
      return sendErrorResponse(res, 400, "Payment retry is only available for online payments");
    }

    if (!razorpayInstance) {
      return sendErrorResponse(res, 500, "Payment gateway not initialized");
    }

    // Create new Razorpay order
    const razorpayOrder = await razorpayInstance.orders.create({
      amount: Math.round(order.totalAmount * 100), // Convert to paise
      currency: "INR",
      receipt: `retry_${order._id}_${Date.now()}`,
      notes: {
        orderId: order._id.toString(),
        userId: user._id.toString(),
        retry: "true"
      }
    });

    // Update or create payment record
    let payment = await PaymentModel.findById(order.paymentId);
    
    if (payment) {
      // Update existing payment record
      payment.gatewayOrderId = razorpayOrder.id;
      payment.paymentStatus = "Pending";
      payment.notes = "Payment retry initiated";
      await payment.save();
    } else {
      // Create new payment record if not exists
      payment = new PaymentModel({
        order: order._id,
        user: user._id,
        store: order.store,
        amount: Math.round(order.totalAmount),
        paymentMethod: "Online",
        paymentStatus: "Pending",
        paymentGateway: "Razorpay",
        gatewayOrderId: razorpayOrder.id
      });
      await payment.save();
      
      order.paymentId = payment._id as any;
      await order.save();
    }

    return res.status(200).json({
      success: true,
      message: "Payment retry initiated successfully",
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency
      },
      paymentId: payment._id
    });

  } catch (error) {
    console.error("Error retrying payment:", error);
    return sendErrorResponse(res, 500, "Internal server error");
  }
}

