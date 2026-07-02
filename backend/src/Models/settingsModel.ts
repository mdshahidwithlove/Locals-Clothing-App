import mongoose from "mongoose";

export interface ISettings extends mongoose.Document {
  key: string;
  value: string;
  description?: string;
  isEncrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  value: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    trim: true,
  },
  isEncrypted: {
    type: Boolean,
    default: false,
  }
}, {
  timestamps: true,
});

const Settings = mongoose.model<ISettings>("Settings", settingsSchema);
export default Settings;
