import mongoose, { type Document } from "mongoose";
import type { User } from "./user";

export interface IOrderItem {
  product: mongoose.Types.ObjectId;
  quantity: number;
  price: number; // Price at the time of order
}

export interface IOrderStatusHistory {
  status: string;
  timestamp: Date;
  updatedBy?: mongoose.Types.ObjectId | User;
  note?: string;
}

export interface IOrder extends Document {
  orderNumber?: string;
  user: mongoose.Types.ObjectId | User;
  store: mongoose.Types.ObjectId;
  orderItems: IOrderItem[];
  shippingAddress: string;
  deliveryContactPhone: string;
  itemsTotal: number;
  deliveryFee: number;
  platformFee?: number;
  totalAmount: number;
  orderDate: Date;
  status: "Pending" | "Accepted" | "Rejected" | "Processing" | "ReadyForPickup" | "Assigned" | "PickedUp" | "OnTheWay" | "Shipped" | "Delivered" | "Cancelled";
  merchantAcceptedAt?: Date;
  rejectionReason?: string;
  paymentMethod: "COD" | "Online";
  paymentStatus: "Pending" | "Completed" | "Failed" | "Refunded";
  paymentId?: mongoose.Types.ObjectId;
  deliveryPerson?: mongoose.Types.ObjectId | User;
  deliveryDate?: Date;
  pickupLocation?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  deliveryLocation?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  cancellationReason?: string;
  cancelledAt?: Date;
  notes?: string;
  statusHistory: IOrderStatusHistory[];
  storeRated?: boolean;
  storeRating?: number;
  storeReview?: string;
  storeRatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

