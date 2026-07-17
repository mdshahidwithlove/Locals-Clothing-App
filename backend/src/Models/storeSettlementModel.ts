import mongoose, { Schema, Document } from "mongoose";

export interface IStoreSettlement extends Document {
  store: mongoose.Types.ObjectId;
  amount: number;
  type: "Payout" | "Collection"; // Payout (Platform -> Store), Collection (Store -> Platform)
  paymentMethod: "BankTransfer" | "UPI" | "Cash" | "Other";
  transactionReference?: string;
  notes?: string;
  settledBy: mongoose.Types.ObjectId; // Admin user who recorded it
  createdAt: Date;
  updatedAt: Date;
}

const storeSettlementSchema: Schema = new Schema(
  {
    store: {
      type: Schema.Types.ObjectId,
      ref: "Store",
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than zero"]
    },
    type: {
      type: String,
      enum: ["Payout", "Collection"],
      required: true
    },
    paymentMethod: {
      type: String,
      enum: ["BankTransfer", "UPI", "Cash", "Other"],
      required: true
    },
    transactionReference: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    },
    settledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
storeSettlementSchema.index({ store: 1 });
storeSettlementSchema.index({ type: 1 });
storeSettlementSchema.index({ createdAt: -1 });

const StoreSettlementModel = mongoose.model<IStoreSettlement>("StoreSettlement", storeSettlementSchema);

export default StoreSettlementModel;
