import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
  },
  phone: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String, // bcrypt-hashed
  },
    // Avatar/profile picture
  avatar: {
    type: String, // S3 URL
    default: null,
    },
  gender: {
    type: String,
    enum: ["Male", "Female", "Other"],
  },

  // Addresses list (Zomato-like)
  addresses: {
    type: [String],
    default: [],
  },

  // Role management
  role: {
    type: String,
    enum: ["User", "Merchant", "Delivery"],
    default: "User",
    required: true,
  },

  // Verification flags
  isPhoneVerified: {
    type: Boolean,
    default: false,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  isProfileComplete: {
    type: Boolean,
    default: false,
  },

  // Merchant / delivery identity verification
  verificationStatus: {
    type: String,
    enum: ['not_required', 'pending_documents', 'pending_review', 'approved', 'rejected'],
    default: 'not_required',
  },
  verificationDocuments: [{
    documentType: {
      type: String,
      enum: ['aadhaar', 'other'],
      required: true,
    },
    url: { type: String, required: true },
    fileName: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  }],
  verificationSubmittedAt: Date,
  verificationReviewedAt: Date,
  verificationReviewNote: String,
  /** True for merchants/delivery who existed before document verification was required */
  verificationGrandfathered: {
    type: Boolean,
    default: false,
  },

  // Security / auth fields
  otp: String,
  otpExpiry: Date,

  // Meta fields
  isActive: {
    type: Boolean,
    default: true,
  },

  // Delivery partner specific fields
  currentLocation: {
    lat: {
      type: Number,
    },
    lng: {
      type: Number,
    }
  },
  isBusy: {
    type: Boolean,
    default: false,
  },
  currentOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
  },
  pushToken: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

// Database indexes for optimized queries
// Note: phone and email already have unique indexes from their schema definition
userSchema.index({ role: 1 }); // Query users by role
userSchema.index({ role: 1, isActive: 1, isBusy: 1 }); // Query available online delivery partners

const User = mongoose.model("User", userSchema);
export default User;
