import mongoose, { Schema, Document } from "mongoose";

export interface IWithdrawalRequest extends Document {
  user: mongoose.Types.ObjectId;
  amount: number;
  paymentDetails: {
    method: "UPI" | "BankTransfer";
    upiId?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    accountHolderName?: string;
  };
  status: "Pending" | "Approved" | "Rejected";
  statusNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const withdrawalRequestSchema: Schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: [1, "Amount must be greater than zero"]
    },
    paymentDetails: {
      method: {
        type: String,
        enum: ["UPI", "BankTransfer"],
        required: true
      },
      upiId: { type: String, trim: true },
      bankName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      accountHolderName: { type: String, trim: true }
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending"
    },
    statusNotes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

withdrawalRequestSchema.index({ user: 1 });
withdrawalRequestSchema.index({ status: 1 });
withdrawalRequestSchema.index({ createdAt: -1 });

const WithdrawalRequest = mongoose.model<IWithdrawalRequest>("WithdrawalRequest", withdrawalRequestSchema);
export default WithdrawalRequest;
