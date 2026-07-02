import type { Request, Response } from "express";
import StoreModel from "../Models/storeModel";
import OrderModel from "../Models/orderModel";
import { sendErrorResponse } from "../utils/validation";
import { sanitizeTextField } from "../middleware/sanitize";
import { notifyRatingReceived } from "../utils/notificationUtils";
import z from "zod";

const rateStoreSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  rating: z.number().int().min(1).max(5, "Rating must be between 1 and 5"),
  review: z.string().max(1000, "Review must be less than 1000 characters").optional()
});

/**
 * Rate a store after order delivery (one review per order).
 */
export async function rateStore(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const validatedData = rateStoreSchema.parse(req.body);
    const { orderId, rating } = validatedData;
    const review = validatedData.review ? sanitizeTextField(validatedData.review) : undefined;

    const storeIdLookup = await OrderModel.findOne({ _id: orderId, user: user._id }).select(
      "status store storeRated"
    );

    if (!storeIdLookup) {
      return sendErrorResponse(res, 404, "Order not found");
    }
    if (storeIdLookup.status !== "Delivered") {
      return sendErrorResponse(res, 400, "You can only rate delivered orders");
    }
    if (storeIdLookup.storeRated) {
      return sendErrorResponse(res, 400, "You have already rated this order");
    }

    const store = await StoreModel.findById(storeIdLookup.store);
    if (!store) {
      return sendErrorResponse(res, 404, "Store not found");
    }

    const order = await OrderModel.findOneAndUpdate(
      {
        _id: orderId,
        user: user._id,
        status: "Delivered",
        storeRated: { $ne: true },
      },
      {
        $set: {
          storeRated: true,
          storeRating: rating,
          storeReview: review || "",
          storeRatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!order) {
      return sendErrorResponse(res, 400, "You have already rated this order");
    }

    const currentTotal = (store.rating?.average || 0) * (store.rating?.totalReviews || 0);
    const newCount = (store.rating?.totalReviews || 0) + 1;
    const newAverage = (currentTotal + rating) / newCount;

    if (!store.rating) {
      store.rating = { average: 0, totalReviews: 0 };
    }
    store.rating.average = newAverage;
    store.rating.totalReviews = newCount;

    try {
      await store.save();
    } catch (saveError) {
      console.error("Error saving store rating:", saveError);
      await OrderModel.findByIdAndUpdate(orderId, {
        $set: {
          storeRated: false,
          storeRating: undefined,
          storeReview: "",
          storeRatedAt: undefined,
        },
      });
      return sendErrorResponse(res, 500, "Failed to save rating");
    }

    await notifyRatingReceived(
      order._id,
      order.orderNumber || order._id.toString().slice(-8),
      store.merchantId,
      store._id,
      store.storeName,
      rating,
      review
    );

    return res.status(200).json({
      success: true,
      message: "Store rated successfully",
      storeRating: {
        average: store.rating.average,
        totalReviews: store.rating.totalReviews,
      },
      order: {
        _id: order._id,
        storeRated: order.storeRated,
        storeRating: order.storeRating,
        storeReview: order.storeReview,
        storeRatedAt: order.storeRatedAt,
      },
    });
  } catch (error) {
    console.error("Error rating store:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid input data",
        errors: error.issues.map((err: any) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });
    }

    return sendErrorResponse(res, 500, "Internal server error");
  }
}

/**
 * Get aggregate store rating summary.
 */
export async function getStoreRatings(req: Request, res: Response) {
  try {
    const { storeId } = req.params;

    const store = await StoreModel.findById(storeId);
    if (!store) {
      return sendErrorResponse(res, 404, "Store not found");
    }

    return res.status(200).json({
      success: true,
      message: "Store ratings retrieved successfully",
      rating: store.rating,
    });
  } catch (error) {
    console.error("Error getting store ratings:", error);
    return sendErrorResponse(res, 500, "Internal server error");
  }
}

/**
 * Get paginated list of store reviews (from delivered orders).
 */
export async function getStoreReviews(req: Request, res: Response) {
  try {
    const { storeId } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const store = await StoreModel.findById(storeId);
    if (!store) {
      return sendErrorResponse(res, 404, "Store not found");
    }

    const filter = {
      store: storeId,
      status: "Delivered" as const,
      storeRated: true,
    };

    const [reviews, totalReviews] = await Promise.all([
      OrderModel.find(filter)
        .sort({ storeRatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("user", "name")
        .select("orderNumber storeRating storeReview storeRatedAt user"),
      OrderModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Store reviews retrieved successfully",
      rating: store.rating,
      reviews: reviews.map((order) => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        rating: order.storeRating,
        review: order.storeReview,
        ratedAt: order.storeRatedAt,
        userName:
          typeof order.user === "object" && order.user !== null
            ? (order.user as any).name
            : "Customer",
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalReviews / limit),
        totalReviews,
        hasNextPage: page * limit < totalReviews,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error getting store reviews:", error);
    return sendErrorResponse(res, 500, "Internal server error");
  }
}

/**
 * Get delivered orders awaiting store review for the authenticated customer.
 */
export async function getPendingStoreReviews(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 10));

    const filter = {
      user: user._id,
      status: "Delivered" as const,
      storeRated: { $ne: true } as const,
    };

    const [orders, totalPending] = await Promise.all([
      OrderModel.find(filter)
        .sort({ deliveryDate: -1, updatedAt: -1 })
        .limit(limit)
        .populate("store", "storeName storeImages address")
        .select("orderNumber store totalAmount deliveryDate createdAt updatedAt status storeRated"),
      OrderModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Pending store reviews retrieved successfully",
      totalPending,
      orders,
    });
  } catch (error) {
    console.error("Error getting pending store reviews:", error);
    return sendErrorResponse(res, 500, "Internal server error");
  }
}
