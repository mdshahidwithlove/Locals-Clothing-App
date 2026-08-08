import express, { Router } from "express";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getPaymentDetails,
  retryPayment,
  getPaymentConfig
} from "../controllers/paymentController";
import { isAuthenticated } from "../middleware/auth";
import { timeouts } from "../middleware/timeout";

const router: Router = express.Router();

// Apply longer timeout for payment operations (45 seconds)
router.use(timeouts.payment);

// Public/Auth endpoint to fetch active dynamic payment gateway config
router.get("/config", getPaymentConfig);

// Create Razorpay order for payment
router.post("/create-order", isAuthenticated, createRazorpayOrder);

// Verify Razorpay payment
router.post("/verify", isAuthenticated, verifyRazorpayPayment);

// Retry payment for pending/failed orders
router.post("/retry/:orderId", isAuthenticated, retryPayment);

// Razorpay webhook (no auth, needs raw body for signature)
router.post(
  "/webhook/razorpay",
  express.raw({ type: "application/json" }),
  // @ts-ignore - handler supports raw body
  require("../controllers/paymentController").handleRazorpayWebhook
);

// Get payment details for an order
router.get("/:orderId", isAuthenticated, getPaymentDetails);

export default router;

