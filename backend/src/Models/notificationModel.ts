import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  recipient: mongoose.Schema.Types.ObjectId;
  recipientRole: "User" | "Merchant" | "Delivery" | "Admin";
  type: "ORDER_PLACED" | "ORDER_ACCEPTED" | "ORDER_REJECTED" | "ORDER_READY" | "ORDER_PICKED" | "ORDER_DELIVERED" | "ORDER_CANCELLED" | "PAYMENT_SUCCESS" | "PAYMENT_FAILED" | "DELIVERY_ASSIGNED" | "RATING_RECEIVED" | "VERIFICATION_APPROVED" | "VERIFICATION_REJECTED" | "GENERAL";
  title: string;
  message: string;
  
  // Related entities
  order?: mongoose.Schema.Types.ObjectId;
  store?: mongoose.Schema.Types.ObjectId;
  delivery?: mongoose.Schema.Types.ObjectId;
  
  // Notification metadata
  isRead: boolean;
  readAt?: Date;
  
  // Action button (optional)
  actionUrl?: string;
  actionLabel?: string;
  
  // Additional data
  data?: any;
  
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema: Schema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    recipientRole: {
      type: String,
      enum: ["User", "Merchant", "Delivery", "Admin"],
      required: true
    },
    type: {
      type: String,
      enum: [
        "ORDER_PLACED",
        "ORDER_ACCEPTED",
        "ORDER_REJECTED",
        "ORDER_READY",
        "ORDER_PICKED",
        "ORDER_DELIVERED",
        "ORDER_CANCELLED",
        "PAYMENT_SUCCESS",
        "PAYMENT_FAILED",
        "DELIVERY_ASSIGNED",
        "RATING_RECEIVED",
        "VERIFICATION_APPROVED",
        "VERIFICATION_REJECTED",
        "GENERAL"
      ],
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    
    // Related entities
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order"
    },
    store: {
      type: Schema.Types.ObjectId,
      ref: "Store"
    },
    delivery: {
      type: Schema.Types.ObjectId,
      ref: "Delivery"
    },
    
    // Notification metadata
    isRead: {
      type: Boolean,
      default: false
    },
    readAt: {
      type: Date
    },
    
    // Action button (optional)
    actionUrl: {
      type: String,
      trim: true
    },
    actionLabel: {
      type: String,
      trim: true
    },
    
    // Additional data
    data: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

// Indexes for faster queries
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ order: 1 });

const NotificationModel = mongoose.model<INotification>("Notification", notificationSchema);

export default NotificationModel;


