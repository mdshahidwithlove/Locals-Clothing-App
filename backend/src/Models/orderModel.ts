import mongoose, { Schema, Document } from "mongoose";
import { type IOrder, type IOrderItem } from "../types/order";

const orderItemSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "Product",
  },
  quantity: { 
    type: Number, 
    required: true, 
    min: 1
  },
  price: { 
    type: Number, 
    required: true, 
    min: 0
  }
}, { _id: false });

const orderSchema: Schema = new Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      sparse: true
    },
    user: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true
    },
    store: { 
      type: Schema.Types.ObjectId, 
      ref: "Store", 
      required: true
    },
    orderItems: {
      type: [orderItemSchema],
      required: true
    },
    shippingAddress: {
      type: String,
      required: true,
      trim: true
    },
    deliveryContactPhone: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v: string) {
          return /^\d{10}$/.test(v); // Must be exactly 10 digits
        },
        message: 'Delivery contact phone must be exactly 10 digits'
      }
    },
    itemsTotal: {
      type: Number,
      required: true,
      min: 0
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0
    },
    platformFee: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAmount: { 
      type: Number, 
      required: true, 
      min: 0
    },
    orderDate: { 
      type: Date, 
      default: Date.now
    },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected", "Processing", "ReadyForPickup", "Assigned", "PickedUp", "OnTheWay", "Shipped", "Delivered", "Cancelled"],
      default: "Pending"
    },
    merchantAcceptedAt: {
      type: Date
    },
    rejectionReason: {
      type: String,
      trim: true
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "Online"],
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Completed", "Failed", "Refunded"],
      default: "Pending"
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment"
    },
    deliveryPerson: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    deliveryDate: { 
      type: Date
    },
    pickupLocation: {
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String }
    },
    deliveryLocation: {
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String }
    },
    cancellationReason: {
      type: String,
      trim: true
    },
    cancelledAt: {
      type: Date
    },
    notes: {
      type: String,
      trim: true
    },
    statusHistory: [{
      status: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User"
      },
      note: String
    }],
    storeRated: {
      type: Boolean,
      default: false
    },
    storeRating: {
      type: Number,
      min: 1,
      max: 5
    },
    storeReview: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    storeRatedAt: {
      type: Date
    }
  },
  { 
    timestamps: true
  }
);

// Database indexes for optimized queries
// Note: orderNumber already has a unique index from its schema definition
orderSchema.index({ user: 1, status: 1 }); // Get user orders filtered by status
orderSchema.index({ store: 1, status: 1 }); // Get merchant orders filtered by status
orderSchema.index({ deliveryPerson: 1, status: 1 }); // Get delivery person orders
orderSchema.index({ status: 1, createdAt: -1 }); // Query by status, sort by date
orderSchema.index({ user: 1, createdAt: -1 }); // User order history
orderSchema.index({ store: 1, createdAt: -1 }); // Store order history
orderSchema.index({ paymentMethod: 1, paymentStatus: 1 }); // Payment queries
orderSchema.index({ storeRated: 1, status: 1 }); // Rating queries

const OrderModel = mongoose.model<IOrder>("Order", orderSchema);

export default OrderModel;
