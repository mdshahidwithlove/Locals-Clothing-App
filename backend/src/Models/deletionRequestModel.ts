import mongoose, { Schema, Document } from 'mongoose';

export interface IDeletionRequest extends Document {
  identifier: string;
  reason?: string;
  status: 'Pending' | 'Processed' | 'Cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const DeletionRequestSchema: Schema = new Schema(
  {
    identifier: { type: String, required: true, trim: true },
    reason: { type: String, trim: true },
    status: { type: String, enum: ['Pending', 'Processed', 'Cancelled'], default: 'Pending' },
  },
  { timestamps: true }
);

export const DeletionRequest = mongoose.model<IDeletionRequest>('DeletionRequest', DeletionRequestSchema);
