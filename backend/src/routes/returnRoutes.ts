import express from "express";
import { isAuthenticated } from "../middleware/auth";
import { requireRole } from "../middleware/roleAuth";
import { requireApprovedVerification } from "../middleware/verificationAuth";
import {
  createReturnRequest,
  getReturnByOrderId,
  getMerchantReturns,
  approveReturn,
  rejectReturn,
  completeRefund,
  uploadRefundProof,
} from "../controllers/returnController";

const returnRoute = express.Router();

returnRoute.use(isAuthenticated);

returnRoute.post("/", requireRole(["User"]), createReturnRequest);
returnRoute.get("/merchant", requireRole(["Merchant"]), getMerchantReturns);
returnRoute.get("/order/:orderId", requireRole(["User", "Merchant"]), getReturnByOrderId);
returnRoute.post(
  "/:returnId/approve",
  requireRole(["Merchant"]),
  requireApprovedVerification,
  approveReturn
);
returnRoute.post(
  "/:returnId/reject",
  requireRole(["Merchant"]),
  requireApprovedVerification,
  rejectReturn
);
returnRoute.post(
  "/:returnId/complete-refund",
  requireRole(["Merchant"]),
  requireApprovedVerification,
  completeRefund
);
returnRoute.put(
  "/:returnId/refund-proof",
  requireRole(["Merchant"]),
  requireApprovedVerification,
  uploadRefundProof
);

export default returnRoute;
