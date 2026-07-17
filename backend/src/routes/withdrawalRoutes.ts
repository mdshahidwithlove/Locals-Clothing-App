import express from "express";
import { requestWithdrawal, getWithdrawalHistory } from "../controllers/withdrawalController";
import { isAuthenticated } from "../middleware/auth";
import { requireRole } from "../middleware/roleAuth";

const router = express.Router();

// Apply auth middleware to all routes
router.use(isAuthenticated, requireRole(["Merchant", "Delivery"]));

// Create a withdrawal request
router.post("/request", requestWithdrawal);

// Get past withdrawal requests history
router.get("/history", getWithdrawalHistory);

export default router;
