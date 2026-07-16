import express from "express";
import {
  markCodCollected,
  submitCodToStore,
  getCodSummary,
  settleCodOnline
} from "../controllers/codController";
import { isAuthenticated } from "../middleware/auth";
import { requireRole } from "../middleware/roleAuth";
import { requireApprovedVerification } from "../middleware/verificationAuth";

const router = express.Router();

// All routes require delivery role and approved verification
router.use(isAuthenticated, requireRole(['Delivery']), requireApprovedVerification);

// Mark COD as collected after delivery
router.post("/:orderId/collect", markCodCollected);

// Submit collected COD to store/admin
router.post("/submit", submitCodToStore);

// Get COD collection summary
router.get("/summary", getCodSummary);

// Settle COD cash online
router.post("/settle-online", settleCodOnline);

export default router;

