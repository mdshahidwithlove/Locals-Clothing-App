import type { Request, Response } from "express";
import WithdrawalRequest from "../Models/withdrawalRequestModel";
import OrderModel from "../Models/orderModel";
import DeliveryModel from "../Models/deliveryModel";
import StoreModel from "../Models/storeModel";
import PaymentModel from "../Models/paymentModel";
import { sendErrorResponse } from "../utils/validation";

export async function requestWithdrawal(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { amount, paymentDetails } = req.body;

    const withdrawAmount = parseFloat(amount);
    if (!withdrawAmount || withdrawAmount <= 0) {
      return sendErrorResponse(res, 400, "Invalid withdrawal amount");
    }

    if (!paymentDetails || !paymentDetails.method) {
      return sendErrorResponse(res, 400, "Payment details are required");
    }

    // Verify user balance
    let availableBalance = 0;
    if (user.role === "Merchant") {
      // Find store
      const store = await StoreModel.findOne({ merchantId: user._id });
      if (!store) {
        return sendErrorResponse(res, 404, "Store not found");
      }
      
      // Calculate earnings (total completed online sales + storeNetEarnings)
      // For simplicity, we can get this from completed payments of this store minus platform commission
      const completedOrders = await OrderModel.find({ store: store._id, status: "Delivered" });
      const totalSales = completedOrders.reduce((sum, o) => sum + (o.itemsTotal || 0), 0);
      const commissionTotal = completedOrders.reduce((sum, o) => sum + (o.platformFee || 0), 0);
      const storeNetEarnings = totalSales - commissionTotal;

      // Deduct already approved/pending withdrawals
      const pastWithdrawals = await WithdrawalRequest.find({ user: user._id, status: { $ne: "Rejected" } });
      const withdrawnAmount = pastWithdrawals.reduce((sum, w) => sum + w.amount, 0);

      availableBalance = Math.max(0, storeNetEarnings - withdrawnAmount);
    } else if (user.role === "Delivery") {
      // Calculate delivery partner earnings (total completed deliveries fees)
      const completedDeliveries = await DeliveryModel.find({ deliveryPerson: user._id, status: "Delivered" });
      const totalEarnings = completedDeliveries.reduce((sum, d) => sum + (d.deliveryFee || 0), 0);

      // Deduct cash-in-hand (unsubmitted COD collected by this rider)
      const cashInHandResult = await PaymentModel.aggregate([
        {
          $match: {
            codCollectedBy: user._id,
            paymentMethod: "COD",
            paymentStatus: "Completed",
            codSubmittedToStore: false
          }
        },
        {
          $group: {
            _id: null,
            cashInHand: { $sum: "$amount" }
          }
        }
      ]);
      const cashInHand = cashInHandResult[0]?.cashInHand || 0;

      // Deduct already approved/pending withdrawals
      const pastWithdrawals = await WithdrawalRequest.find({ user: user._id, status: { $ne: "Rejected" } });
      const withdrawnAmount = pastWithdrawals.reduce((sum, w) => sum + w.amount, 0);

      availableBalance = Math.max(0, totalEarnings - cashInHand - withdrawnAmount);
    } else {
      return sendErrorResponse(res, 403, "Only merchants and riders can request withdrawals");
    }

    if (withdrawAmount > availableBalance) {
      return sendErrorResponse(res, 400, `Insufficient balance. Available: ₹${Math.round(availableBalance)}`);
    }

    // Create withdrawal request
    const request = new WithdrawalRequest({
      user: user._id,
      amount: withdrawAmount,
      paymentDetails
    });

    await request.save();

    return res.status(201).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      request
    });
  } catch (error) {
    console.error("Error creating withdrawal request:", error);
    return sendErrorResponse(res, 500, "Internal server error");
  }
}

export async function getWithdrawalHistory(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const history = await WithdrawalRequest.find({ user: user._id }).sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      history
    });
  } catch (error) {
    console.error("Error fetching withdrawal history:", error);
    return sendErrorResponse(res, 500, "Internal server error");
  }
}
