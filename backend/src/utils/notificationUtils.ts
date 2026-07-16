import NotificationModel from "../Models/notificationModel";
import UserModel from "../Models/userModel";
import OrderModel from "../Models/orderModel";
import type { Types } from "mongoose";
import axios from "axios";

export interface NotificationData {
  recipient: Types.ObjectId | string;
  recipientRole: "User" | "Merchant" | "Delivery" | "Admin";
  type: "ORDER_PLACED" | "ORDER_ACCEPTED" | "ORDER_REJECTED" | "ORDER_READY" | "ORDER_PICKED" | "ORDER_DELIVERED" | "ORDER_CANCELLED" | "PAYMENT_SUCCESS" | "PAYMENT_FAILED" | "DELIVERY_ASSIGNED" | "RATING_RECEIVED" | "VERIFICATION_APPROVED" | "VERIFICATION_REJECTED" | "GENERAL";
  title: string;
  message: string;
  order?: Types.ObjectId | string;
  store?: Types.ObjectId | string;
  delivery?: Types.ObjectId | string;
  actionUrl?: string;
  actionLabel?: string;
  data?: any;
}

/**
 * Send push notification using Expo Push API
 */
async function sendExpoPushNotification(pushToken: string, title: string, body: string, data?: any): Promise<void> {
  if (!pushToken || !pushToken.startsWith("ExponentPushToken[")) {
    console.warn(`[PushNotification] Invalid Expo push token skipped: ${pushToken}`);
    return;
  }

  try {
    const payload = {
      to: pushToken,
      sound: "default",
      title,
      body,
      data: data || {},
    };

    const response = await axios.post("https://exp.host/--/api/v2/push/send", payload, {
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
    });

    if (response.status === 200) {
      console.log(`[PushNotification] Expo push successfully sent to ${pushToken}`);
    } else {
      console.error(`[PushNotification] Expo push API returned status ${response.status}:`, response.data);
    }
  } catch (error) {
    console.error("[PushNotification] Error sending Expo push notification:", error);
  }
}

/**
 * Send notification to a user
 */
export async function sendNotification(notificationData: NotificationData): Promise<void> {
  try {
    const notification = new NotificationModel(notificationData);
    await notification.save();
    
    // Skip push notification check for Admin recipients
    if ((notificationData.recipientRole as string) !== "Admin") {
      const user = await UserModel.findById(notificationData.recipient).select("pushToken");
      if (user && user.pushToken) {
        // Trigger real-time push notification via Expo
        await sendExpoPushNotification(
          user.pushToken,
          notificationData.title,
          notificationData.message,
          {
            type: notificationData.type,
            orderId: notificationData.order ? notificationData.order.toString() : undefined,
            ...notificationData.data
          }
        );
      } else {
        console.log(`[Notification] No active push token found for recipient ${notificationData.recipient}. Skipping push.`);
      }
    }
    
    console.log(`Notification sent to ${notificationData.recipient}: ${notificationData.title}`);
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}

/**
 * Send notifications for order placed
 */
export async function notifyOrderPlaced(
  orderId: Types.ObjectId | string,
  orderNumber: string,
  userId: Types.ObjectId | string,
  merchantId: Types.ObjectId | string,
  storeId: Types.ObjectId | string,
  storeName: string,
  orderAmount: number
): Promise<void> {
  // Notify customer
  await sendNotification({
    recipient: userId,
    recipientRole: "User",
    type: "ORDER_PLACED",
    title: "Order Placed Successfully!",
    message: `Your order #${orderNumber} worth ₹${orderAmount} has been placed at ${storeName}.`,
    order: orderId,
    store: storeId,
    actionUrl: `/order/${orderId}`,
    actionLabel: "View Order"
  });
  
  // Notify merchant
  await sendNotification({
    recipient: merchantId,
    recipientRole: "Merchant",
    type: "ORDER_PLACED",
    title: "New Order Received!",
    message: `You have received a new order #${orderNumber} worth ₹${orderAmount}.`,
    order: orderId,
    store: storeId,
    actionUrl: `/merchant/orders/${orderId}`,
    actionLabel: "View Order"
  });

  // Notify admins
  try {
    const admins = await UserModel.find({ role: "Admin" } as any).select("_id");
    for (const admin of admins) {
      await sendNotification({
        recipient: admin._id,
        recipientRole: "Admin",
        type: "ORDER_PLACED",
        title: "New Platform Order Placed",
        message: `A new order #${orderNumber} worth ₹${orderAmount} has been placed at ${storeName}.`,
        order: orderId,
        store: storeId,
        actionUrl: `/admin/orders/${orderId}`,
        actionLabel: "View Order Details"
      });
    }
  } catch (adminError) {
    console.error("Failed to notify admins of new order:", adminError);
  }
}

/**
 * Send notifications for order accepted
 */
export async function notifyOrderAccepted(
  orderId: Types.ObjectId | string,
  orderNumber: string,
  userId: Types.ObjectId | string,
  storeId: Types.ObjectId | string,
  storeName: string
): Promise<void> {
  await sendNotification({
    recipient: userId,
    recipientRole: "User",
    type: "ORDER_ACCEPTED",
    title: "Order Accepted!",
    message: `Your order #${orderNumber} has been accepted by ${storeName} and is being prepared.`,
    order: orderId,
    store: storeId,
    actionUrl: `/order/${orderId}`,
    actionLabel: "Track Order"
  });
}

/**
 * Send notifications for order rejected
 */
export async function notifyOrderRejected(
  orderId: Types.ObjectId | string,
  orderNumber: string,
  userId: Types.ObjectId | string,
  storeId: Types.ObjectId | string,
  storeName: string,
  reason: string
): Promise<void> {
  await sendNotification({
    recipient: userId,
    recipientRole: "User",
    type: "ORDER_REJECTED",
    title: "Order Rejected",
    message: `Your order #${orderNumber} was rejected by ${storeName}. Reason: ${reason}`,
    order: orderId,
    store: storeId,
    actionUrl: `/order/${orderId}`,
    actionLabel: "View Details"
  });
}

/**
 * Send notifications for order ready for pickup
 */
export async function notifyOrderReady(
  orderId: Types.ObjectId | string,
  orderNumber: string,
  userId: Types.ObjectId | string,
  storeId: Types.ObjectId | string,
  storeName: string
): Promise<void> {
  await sendNotification({
    recipient: userId,
    recipientRole: "User",
    type: "ORDER_READY",
    title: "Order Ready for Pickup!",
    message: `Your order #${orderNumber} is ready and waiting for pickup from ${storeName}.`,
    order: orderId,
    store: storeId,
    actionUrl: `/order/${orderId}`,
    actionLabel: "Track Order"
  });

  // Notify delivery partner (rider) if already assigned
  try {
    const order = await OrderModel.findById(orderId).select("deliveryPerson");
    if (order && order.deliveryPerson) {
      await sendNotification({
        recipient: order.deliveryPerson as any,
        recipientRole: "Delivery",
        type: "ORDER_READY",
        title: "Order Ready for Pickup!",
        message: `Order #${orderNumber} is ready for pickup at ${storeName}. Please head to the store.`,
        order: orderId,
        store: storeId,
        actionUrl: `/delivery/orders/${orderId}`,
        actionLabel: "View Assignment"
      });
    }
  } catch (err) {
    console.error("Failed to notify delivery partner of ready order:", err);
  }
}

/**
 * Send notifications for delivery assigned
 */
export async function notifyDeliveryAssigned(
  orderId: Types.ObjectId | string,
  orderNumber: string,
  userId: Types.ObjectId | string,
  deliveryPersonId: Types.ObjectId | string,
  deliveryPersonName: string,
  storeId: Types.ObjectId | string
): Promise<void> {
  // Notify customer
  await sendNotification({
    recipient: userId,
    recipientRole: "User",
    type: "DELIVERY_ASSIGNED",
    title: "Delivery Partner Assigned!",
    message: `${deliveryPersonName} will deliver your order #${orderNumber}.`,
    order: orderId,
    store: storeId,
    actionUrl: `/order/${orderId}`,
    actionLabel: "Track Delivery"
  });
  
  // Notify delivery person
  await sendNotification({
    recipient: deliveryPersonId,
    recipientRole: "Delivery",
    type: "DELIVERY_ASSIGNED",
    title: "New Delivery Assignment!",
    message: `You have been assigned to deliver order #${orderNumber}.`,
    order: orderId,
    store: storeId,
    actionUrl: `/delivery/orders/${orderId}`,
    actionLabel: "View Order"
  });
}

/**
 * Send notifications for order picked up
 */
export async function notifyOrderPickedUp(
  orderId: Types.ObjectId | string,
  orderNumber: string,
  userId: Types.ObjectId | string,
  deliveryPersonName: string,
  storeId: Types.ObjectId | string
): Promise<void> {
  await sendNotification({
    recipient: userId,
    recipientRole: "User",
    type: "ORDER_PICKED",
    title: "Order Picked Up!",
    message: `${deliveryPersonName} has picked up your order #${orderNumber} and is on the way.`,
    order: orderId,
    store: storeId,
    actionUrl: `/order/${orderId}`,
    actionLabel: "Track Live"
  });
}

/**
 * Send notifications for order delivered
 */
export async function notifyOrderDelivered(
  orderId: Types.ObjectId | string,
  orderNumber: string,
  userId: Types.ObjectId | string,
  storeId: Types.ObjectId | string
): Promise<void> {
  await sendNotification({
    recipient: userId,
    recipientRole: "User",
    type: "ORDER_DELIVERED",
    title: "Order Delivered!",
    message: `Your order #${orderNumber} has been delivered successfully. Enjoy your purchase!`,
    order: orderId,
    store: storeId,
    actionUrl: `/order/${orderId}/rate`,
    actionLabel: "Rate Order"
  });
}

/**
 * Send notifications for payment success
 */
export async function notifyPaymentSuccess(
  orderId: Types.ObjectId | string,
  orderNumber: string,
  userId: Types.ObjectId | string,
  amount: number,
  storeId: Types.ObjectId | string
): Promise<void> {
  await sendNotification({
    recipient: userId,
    recipientRole: "User",
    type: "PAYMENT_SUCCESS",
    title: "Payment Successful!",
    message: `Your payment of ₹${amount} for order #${orderNumber} was successful.`,
    order: orderId,
    store: storeId,
    actionUrl: `/order/${orderId}`,
    actionLabel: "View Order"
  });
}

/**
 * Send notifications for payment failed
 */
export async function notifyPaymentFailed(
  orderId: Types.ObjectId | string,
  orderNumber: string,
  userId: Types.ObjectId | string,
  amount: number,
  storeId: Types.ObjectId | string
): Promise<void> {
  await sendNotification({
    recipient: userId,
    recipientRole: "User",
    type: "PAYMENT_FAILED",
    title: "Payment Failed",
    message: `Your payment of ₹${amount} for order #${orderNumber} failed. Please try again.`,
    order: orderId,
    store: storeId,
    actionUrl: `/order/${orderId}/payment`,
    actionLabel: "Retry Payment"
  });
}

/**
 * Notify merchant when a customer leaves a store review.
 */
export async function notifyRatingReceived(
  orderId: Types.ObjectId | string,
  orderNumber: string,
  merchantId: Types.ObjectId | string,
  storeId: Types.ObjectId | string,
  storeName: string,
  rating: number,
  review?: string
): Promise<void> {
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  const reviewSnippet = review?.trim()
    ? `: "${review.trim().slice(0, 80)}${review.trim().length > 80 ? "…" : ""}"`
    : "";

  await sendNotification({
    recipient: merchantId,
    recipientRole: "Merchant",
    type: "RATING_RECEIVED",
    title: "New Store Review",
    message: `${stars} (${rating}/5) for ${storeName} on order #${orderNumber}${reviewSnippet}`,
    order: orderId,
    store: storeId,
    actionUrl: `/merchant/orders/${orderId}`,
    actionLabel: "View Order",
    data: { rating, review: review || "" },
  });
}

/**
 * Notify merchant/delivery partner when admin updates verification status.
 */
export async function notifyVerificationDecision(
  userId: Types.ObjectId | string,
  role: "Merchant" | "Delivery",
  status: "approved" | "rejected" | "pending_review" | "pending_documents",
  note?: string,
): Promise<void> {
  const roleLabel = role === 'Merchant' ? 'seller' : 'delivery partner';

  if (status === 'approved') {
    await sendNotification({
      recipient: userId,
      recipientRole: role,
      type: 'VERIFICATION_APPROVED',
      title: 'Account verified',
      message: `Your ${roleLabel} account has been approved. You can now use the app.`,
      actionUrl: role === 'Merchant' ? '/(merchantTabs)/' : '/(deliveryTabs)/',
      actionLabel: 'Open app',
    });
    return;
  }

  if (status === 'rejected') {
    await sendNotification({
      recipient: userId,
      recipientRole: role,
      type: 'VERIFICATION_REJECTED',
      title: 'Verification rejected',
      message: note?.trim()
        ? `Your ${roleLabel} verification was rejected. Reason: ${note.trim()}`
        : `Your ${roleLabel} verification was rejected. Please upload documents again.`,
      actionUrl: '/auth/VerificationPending',
      actionLabel: 'Re-upload documents',
      data: { note: note || '' },
    });
    return;
  }

  if (status === 'pending_review') {
    await sendNotification({
      recipient: userId,
      recipientRole: role,
      type: 'GENERAL',
      title: 'Verification under review',
      message: note?.trim()
        ? `Your ${roleLabel} documents are being reviewed. ${note.trim()}`
        : `Your ${roleLabel} documents are being reviewed. We will notify you once a decision is made.`,
      actionUrl: '/auth/VerificationPending',
      actionLabel: 'View status',
    });
    return;
  }

  if (status === 'pending_documents') {
    await sendNotification({
      recipient: userId,
      recipientRole: role,
      type: 'GENERAL',
      title: 'New documents required',
      message: note?.trim()
        ? `Please upload your verification documents again. ${note.trim()}`
        : `Please upload your verification documents again to continue as a ${roleLabel}.`,
      actionUrl: '/auth/VerificationPending',
      actionLabel: 'Upload documents',
      data: { note: note || '' },
    });
  }
}

/**
 * Notify admin of a user login event
 */
export async function notifyUserLogin(
  userId: any,
  userName: string,
  userPhone: string,
  userRole: string
): Promise<void> {
  try {
    const AdminModel = require("../admin/admin.model").default;
    const admins = await AdminModel.find({ isActive: true });
    
    for (const admin of admins) {
      await sendNotification({
        recipient: admin._id,
        recipientRole: "Admin" as any,
        type: "GENERAL",
        title: "User Logged In",
        message: `${userName || 'A user'} (${userPhone || 'No Phone'}) logged in as ${userRole}.`,
        data: { userId: userId.toString(), role: userRole }
      });
    }
  } catch (error) {
    console.error("Failed to notify admins of user login:", error);
  }
}

/**
 * Notify admin of a new user registration event
 */
export async function notifyUserRegistration(
  userId: any,
  userName: string,
  userPhone: string,
  userRole: string
): Promise<void> {
  try {
    const AdminModel = require("../admin/admin.model").default;
    const admins = await AdminModel.find({ isActive: true });
    
    for (const admin of admins) {
      await sendNotification({
        recipient: admin._id,
        recipientRole: "Admin" as any,
        type: "GENERAL",
        title: "New User Registered!",
        message: `${userName || 'A new user'} (${userPhone || 'No Phone'}) registered as ${userRole}.`,
        data: { userId: userId.toString(), role: userRole }
      });
    }
  } catch (error) {
    console.error("Failed to notify admins of user registration:", error);
  }
}

