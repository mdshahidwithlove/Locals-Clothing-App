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
import withdrawalRoute from "./routes/withdrawalRoutes";
import { initializeRazorpay } from "./controllers/paymentController";
import { requestTimeout } from "./middleware/timeout";
import { startAssignmentScheduler, stopAssignmentScheduler } from "./services/assignmentScheduler";
import { sanitizeInput } from "./middleware/sanitize";
import { loadConfigCache, getConfig } from "./services/configService";

import path from "path";

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
app.use(express.static(path.join(__dirname, "../public")));

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

import fs from "fs";

const serveDeleteAccountPage = (req: express.Request, res: express.Response) => {
  const fileInRoot = path.join(__dirname, "../public/delete-account.html");
  const fileInDist = path.join(__dirname, "./public/delete-account.html");
  
  if (fs.existsSync(fileInRoot)) {
    return res.sendFile(fileInRoot);
  } else if (fs.existsSync(fileInDist)) {
    return res.sendFile(fileInDist);
  } else {
    // Fallback inline HTML if static file is missing in production bundle
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Locals - Account & Data Deletion Request</title><style>:root{--primary:#FFD21F;--bg:#F8F9FA;--card-bg:#FFFFFF;--text:#1F2937;--text-muted:#6B7280;--border:#E5E7EB;--success:#10B981;}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;padding:20px;display:flex;justify-content:center;align-items:center;min-height:100vh;}.container{width:100%;max-width:600px;background:var(--card-bg);border-radius:20px;box-shadow:0 10px 25px rgba(0,0,0,0.08);overflow:hidden;border:1px solid var(--border);}.header{background:#000000;color:#FFFFFF;padding:30px 25px;text-align:center;}.brand-badge{display:inline-block;background:var(--primary);color:#000000;font-weight:800;font-size:14px;padding:4px 12px;border-radius:20px;text-transform:uppercase;margin-bottom:10px;}.header h1{font-size:24px;font-weight:700;}.header p{color:#9CA3AF;font-size:14px;margin-top:6px;}.content{padding:30px 25px;}.info-box{background:#EFF6FF;border-left:4px solid #3B82F6;padding:16px;border-radius:8px;margin-bottom:24px;font-size:14px;color:#1E40AF;}.section-title{font-size:16px;font-weight:700;margin-bottom:12px;}.data-list{list-style:none;margin-bottom:24px;}.data-list li{font-size:14px;color:var(--text-muted);margin-bottom:8px;display:flex;align-items:center;}.data-list li::before{content:"✓";color:var(--success);font-weight:bold;margin-right:10px;}.form-group{margin-bottom:20px;}label{display:block;font-size:14px;font-weight:600;margin-bottom:8px;}input[type="text"],textarea{width:100%;padding:12px 16px;border:1px solid var(--border);border-radius:12px;font-size:15px;outline:none;}textarea{resize:vertical;min-height:80px;}.btn-submit{width:100%;background:#000000;color:var(--primary);border:none;padding:14px;font-size:16px;font-weight:700;border-radius:12px;cursor:pointer;}.message{margin-top:20px;padding:14px;border-radius:10px;font-size:14px;display:none;text-align:center;}.message.success{background:#D1FAE5;color:#065F46;border:1px solid #A7F3D0;display:block;}.message.error{background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5;display:block;}.footer{text-align:center;padding:20px;font-size:12px;color:var(--text-muted);border-top:1px solid var(--border);}</style></head><body><div class="container"><div class="header"><div class="brand-badge">LOCALS</div><h1>Account Deletion Request</h1><p>Request permanent deletion of your Locals account and data</p></div><div class="content"><div class="info-box">Submitting this form will initiate the permanent deletion process for your Locals user account and associated personal data.</div><div class="section-title">Data Deleted Upon Request:</div><ul class="data-list"><li>User profile (Name, Phone number, Email address)</li><li>Saved delivery addresses</li><li>Active shopping cart items & favorites list</li><li>Authentication tokens & push notification IDs</li></ul><p style="font-size:12px;color:#6B7280;margin-bottom:20px;">* Note: Transactional invoice records are retained for statutory accounting and tax compliance requirements as required by law.</p><form id="deletionForm"><div class="form-group"><label for="identifier">Registered Mobile Number or Email Address *</label><input type="text" id="identifier" name="identifier" placeholder="e.g. +91 9876543210 or user@example.com" required /></div><div class="form-group"><label for="reason">Reason for Deletion (Optional)</label><textarea id="reason" name="reason" placeholder="Tell us why you wish to delete your account..."></textarea></div><button type="submit" class="btn-submit" id="submitBtn">Submit Deletion Request</button></form><div id="responseMessage" class="message"></div></div><div class="footer">&copy; 2026 Locals Clothing & Lifestyle. All rights reserved.</div></div><script>document.getElementById('deletionForm').addEventListener('submit',async function(e){e.preventDefault();const b=document.getElementById('submitBtn'),m=document.getElementById('responseMessage'),i=document.getElementById('identifier').value.trim(),r=document.getElementById('reason').value.trim();if(!i){m.className='message error';m.innerText='Please enter your registered mobile number or email address.';return;}b.disabled=true;b.innerText='Submitting Request...';m.style.display='none';try{const res=await fetch('/api/v1/user/delete-account-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:i,reason:r})});const data=await res.json();if(res.ok&&data.success){m.className='message success';m.innerText=data.message||'Your account deletion request has been submitted successfully.';document.getElementById('deletionForm').reset();}else{m.className='message error';m.innerText=data.message||'Failed to submit deletion request.';}}catch(err){m.className='message error';m.innerText='An error occurred. Please try again.';}finally{b.disabled=false;b.innerText='Submit Deletion Request';}});</script></body></html>`);
  }
};

app.get("/delete-account", serveDeleteAccountPage);
app.get("/delete-account.html", serveDeleteAccountPage);

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
app.use("/api/v1/withdrawals", withdrawalRoute);

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