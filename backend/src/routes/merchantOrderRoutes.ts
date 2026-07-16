import express from "express";
import {
  getMerchantOrders,
  getMerchantAnalytics,
  verifyCodReceipt,
  acceptOrder,
  rejectOrder,
  markReadyForPickup
} from "../controllers/merchantOrderController";
import { isAuthenticated } from "../middleware/auth";
import { requireRole } from "../middleware/roleAuth";
import { requireApprovedVerification } from "../middleware/verificationAuth";

const router = express.Router();

// All routes require merchant role and approved verification
router.use(isAuthenticated, requireRole(['Merchant']), requireApprovedVerification);

// Get merchant's orders
router.get("/", getMerchantOrders);

// Get merchant dashboard analytics
router.get("/analytics", getMerchantAnalytics);

// Verify receipt of COD cash from rider
router.post("/verify-cod", verifyCodReceipt);

// Accept an order
router.post("/:orderId/accept", acceptOrder);

// Reject an order
router.post("/:orderId/reject", rejectOrder);

// Mark order as ready for pickup
router.post("/:orderId/ready", markReadyForPickup);

export default router;

