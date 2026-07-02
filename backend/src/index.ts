import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDatabase } from "./config/database";
import userRoute from "./routes/userRoutes";
import storeRoute from "./routes/storeRoutes";
import productRoute from "./routes/productRoutes";
import uploadRoute from "./routes/uploadRoutes";
import orderRoute from "./routes/orderRoutes";
import deliveryRoute from "./routes/deliveryRoutes";
import favoriteRoute from "./routes/favoriteRoutes";
import paymentRoute from "./routes/paymentRoutes";
import merchantOrderRoute from "./routes/merchantOrderRoutes";
import codRoute from "./routes/codRoutes";
import storeRatingRoute from "./routes/storeRatingRoutes";
import deliveryAssignmentRoute from "./routes/deliveryAssignmentRoutes";
import directionsRoute from "./routes/directionsRoutes";
import geocodeRoute from "./routes/geocodeRoutes";
import adminRoute from "./admin/admin.routes";
import verificationRoute from "./routes/verificationRoutes";
import returnRoute from "./routes/returnRoutes";
import { initializeRazorpay } from "./controllers/paymentController";
import { requestTimeout } from "./middleware/timeout";
import { startAssignmentScheduler, stopAssignmentScheduler } from "./services/assignmentScheduler";
import { sanitizeInput } from "./middleware/sanitize";
import { loadConfigCache, getConfig } from "./services/configService";

dotenv.config();
const app = express();

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization middleware
// Note: Disabled in development, enabled in production
if (process.env.NODE_ENV === 'production') {
  app.use(sanitizeInput);
  console.log('✓ Input sanitization enabled for production');
}

// Global request timeout middleware (30 seconds default)
app.use(requestTimeout(30000));

app.get("/", (req, res) => {
  res.send("LOcal backend is running !!!!");
});

app.use("/api/v1/user", userRoute);
app.use("/api/v1/store", storeRoute);
app.use("/api/v1/product", productRoute);
app.use("/api/v1/upload", uploadRoute);
app.use("/api/v1/order", orderRoute);
app.use("/api/v1/delivery", deliveryRoute);
app.use("/api/v1/favorite", favoriteRoute);
app.use("/api/v1/payment", paymentRoute);
app.use("/api/v1/merchant-order", merchantOrderRoute);
app.use("/api/v1/cod", codRoute);
app.use("/api/v1/stores", storeRatingRoute);
app.use("/api/v1/delivery-assignment", deliveryAssignmentRoute);
app.use("/api/v1", directionsRoute);
app.use("/api/v1", geocodeRoute);
app.use("/api/v1/admin", adminRoute);
app.use("/api/v1/user/verification", verificationRoute);
app.use("/api/v1/returns", returnRoute);

const PORT = process.env.PORT || 10000;

async function startServer() {
  try {
    // 1. Connect to MongoDB database
    await connectDatabase();
    console.log("Database connected successfully");

    // 2. Load settings from database into configuration cache
    await loadConfigCache();

    // 3. Start automatic order assignment service (runs every 60 seconds)
    startAssignmentScheduler();

    // 4. Initialize Razorpay (using config cache or environment variable)
    const razorpayKeyId = getConfig("RAZORPAY_KEY_ID") || getConfig("RAZORPAY_KEYID");
    const razorpayKeySecret = getConfig("RAZORPAY_KEY_SECRET") || getConfig("RAZORPAY_API_SECRET");

    if (razorpayKeyId && razorpayKeySecret) {
      initializeRazorpay(razorpayKeyId, razorpayKeySecret);
      console.log("Razorpay initialized successfully");
    } else {
      console.warn("Razorpay credentials not found. Payment functionality will not work.");
    }

    // 5. Start listening
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  stopAssignmentScheduler();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  stopAssignmentScheduler();
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  stopAssignmentScheduler();
  process.exit(1);
});