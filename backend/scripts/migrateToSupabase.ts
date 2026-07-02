import mongoose from "mongoose";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Mongoose Models
import User from "../src/Models/userModel";
import Store from "../src/Models/storeModel";
import Product from "../src/Models/productModel";
import Order from "../src/Models/orderModel";
import Settings from "../src/Models/settingsModel";
import Notification from "../src/Models/notificationModel";
import Payment from "../src/Models/paymentModel";
import Return from "../src/Models/returnModel";
import Favorite from "../src/Models/favoriteModel";

// Supabase Credentials
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ ERROR: Please define SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY in your .env file.");
  process.exit(1);
}

// Initialize Supabase Client with admin permissions (to bypass RLS during migration)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function runMigration() {
  try {
    console.log("🔌 Connecting to MongoDB Database...");
    await mongoose.connect(process.env.DB_URL || "mongodb://localhost:27017/locals");
    console.log("✓ Connected to MongoDB.");

    // --- 1. MIGRATE USERS ---
    console.log("👥 Migrating users...");
    const mongoUsers = await User.find({});
    console.log(`Found ${mongoUsers.length} users in MongoDB.`);
    
    for (const u of mongoUsers) {
      const userObj = u.toObject();
      const payload = {
        id: userObj._id.toString(),
        name: userObj.name || null,
        phone: userObj.phone || null,
        email: userObj.email || null,
        password: userObj.password || null,
        avatar: userObj.avatar || null,
        gender: userObj.gender || null,
        addresses: JSON.stringify(userObj.addresses || []),
        role: userObj.role || 'User',
        is_phone_verified: !!userObj.isPhoneVerified,
        is_email_verified: !!userObj.isEmailVerified,
        is_profile_complete: !!userObj.isProfileComplete,
        verification_status: userObj.verificationStatus || 'not_required',
        verification_documents: JSON.stringify(userObj.verificationDocuments || []),
        verification_submitted_at: userObj.verificationSubmittedAt ? new Date(userObj.verificationSubmittedAt).toISOString() : null,
        verification_reviewed_at: userObj.verificationReviewedAt ? new Date(userObj.verificationReviewedAt).toISOString() : null,
        verification_review_note: userObj.verificationReviewNote || null,
        verification_grandfathered: !!userObj.verificationGrandfathered,
        otp: userObj.otp || null,
        otp_expiry: userObj.otpExpiry ? new Date(userObj.otpExpiry).toISOString() : null,
        is_active: userObj.isActive !== false,
        current_location_lat: userObj.currentLocation?.lat || null,
        current_location_lng: userObj.currentLocation?.lng || null,
        is_busy: !!userObj.isBusy,
        current_order_id: userObj.currentOrder ? userObj.currentOrder.toString() : null,
        created_at: userObj.createdAt ? new Date(userObj.createdAt).toISOString() : new Date().toISOString(),
        updated_at: userObj.updatedAt ? new Date(userObj.updatedAt).toISOString() : new Date().toISOString(),
      };

      const { error } = await supabase.from("users").upsert(payload);
      if (error) console.error(`Failed to upsert user ${u._id}:`, error.message);
    }
    console.log("✓ Users migration processed.");

    // --- 2. MIGRATE STORES ---
    console.log("🏬 Migrating stores...");
    const mongoStores = await Store.find({});
    console.log(`Found ${mongoStores.length} stores in MongoDB.`);
    
    for (const s of mongoStores) {
      const storeObj = s.toObject();
      const payload = {
        id: storeObj._id.toString(),
        merchant_id: storeObj.merchantId ? storeObj.merchantId.toString() : null,
        store_name: storeObj.storeName,
        description: storeObj.description || null,
        store_images: JSON.stringify(storeObj.storeImages || []),
        address: storeObj.address,
        map_link: storeObj.mapLink,
        contact_phone: storeObj.contact?.phone || null,
        contact_email: storeObj.contact?.email || null,
        contact_website: storeObj.contact?.website || null,
        working_days: JSON.stringify(storeObj.workingDays || {}),
        rating_average: storeObj.rating?.average || 0.0,
        rating_total_reviews: storeObj.rating?.totalReviews || 0,
        is_active: storeObj.isActive !== false,
        pre_verification_store: !!storeObj.preVerificationStore,
        created_at: storeObj.createdAt ? new Date(storeObj.createdAt).toISOString() : new Date().toISOString(),
        updated_at: storeObj.updatedAt ? new Date(storeObj.updatedAt).toISOString() : new Date().toISOString(),
      };

      const { error } = await supabase.from("stores").upsert(payload);
      if (error) console.error(`Failed to upsert store ${s._id}:`, error.message);
    }
    console.log("✓ Stores migration processed.");

    // --- 3. MIGRATE PRODUCTS ---
    console.log("🛍️ Migrating products...");
    const mongoProducts = await Product.find({});
    console.log(`Found ${mongoProducts.length} products in MongoDB.`);
    
    for (const p of mongoProducts) {
      const prodObj = p.toObject();
      const payload = {
        id: prodObj._id.toString(),
        store_id: prodObj.store ? prodObj.store.toString() : null,
        name: prodObj.name,
        description: prodObj.description || null,
        price: prodObj.price,
        original_price: prodObj.originalPrice || null,
        discount_percent: prodObj.discountPercent || null,
        category: prodObj.category || null,
        images: JSON.stringify(prodObj.images || []),
        status: prodObj.status || 'active',
        in_stock: prodObj.inStock !== false,
        options: JSON.stringify(prodObj.options || []),
        created_at: prodObj.createdAt ? new Date(prodObj.createdAt).toISOString() : new Date().toISOString(),
        updated_at: prodObj.updatedAt ? new Date(prodObj.updatedAt).toISOString() : new Date().toISOString(),
      };

      const { error } = await supabase.from("products").upsert(payload);
      if (error) console.error(`Failed to upsert product ${p._id}:`, error.message);
    }
    console.log("✓ Products migration processed.");

    // --- 4. MIGRATE ORDERS ---
    console.log("📦 Migrating orders...");
    const mongoOrders = await Order.find({});
    console.log(`Found ${mongoOrders.length} orders in MongoDB.`);
    
    for (const o of mongoOrders) {
      const orderObj = o.toObject();
      const payload = {
        id: orderObj._id.toString(),
        order_number: orderObj.orderNumber,
        user_id: orderObj.user ? orderObj.user.toString() : null,
        store_id: orderObj.store ? orderObj.store.toString() : null,
        items: JSON.stringify(orderObj.items || []),
        total_amount: orderObj.totalAmount,
        payment_status: orderObj.paymentStatus || 'Pending',
        payment_method: orderObj.paymentMethod || 'COD',
        status: orderObj.status || 'Pending',
        delivery_address: orderObj.deliveryAddress,
        delivery_location_lat: orderObj.deliveryLocation?.lat || null,
        delivery_location_lng: orderObj.deliveryLocation?.lng || null,
        delivery_date: orderObj.deliveryDate ? new Date(orderObj.deliveryDate).toISOString() : null,
        payment_details: JSON.stringify(orderObj.paymentDetails || {}),
        delivery_partner_id: orderObj.deliveryPartner ? orderObj.deliveryPartner.toString() : null,
        otp: orderObj.otp || null,
        otp_verified: !!orderObj.otpVerified,
        rejection_reason: orderObj.rejectionReason || null,
        store_rating: orderObj.storeRating || null,
        store_review: orderObj.storeReview || null,
        store_rated: !!orderObj.storeRated,
        store_rated_at: orderObj.storeRatedAt ? new Date(orderObj.storeRatedAt).toISOString() : null,
        delivery_rating: orderObj.deliveryRating || null,
        delivery_review: orderObj.deliveryReview || null,
        delivery_rated: !!orderObj.deliveryRated,
        delivery_rated_at: orderObj.deliveryRatedAt ? new Date(orderObj.deliveryRatedAt).toISOString() : null,
        status_history: JSON.stringify(orderObj.statusHistory || []),
        created_at: orderObj.createdAt ? new Date(orderObj.createdAt).toISOString() : new Date().toISOString(),
        updated_at: orderObj.updatedAt ? new Date(orderObj.updatedAt).toISOString() : new Date().toISOString(),
      };

      const { error } = await supabase.from("orders").upsert(payload);
      if (error) console.error(`Failed to upsert order ${o._id}:`, error.message);
    }
    console.log("✓ Orders migration processed.");

    // --- 5. MIGRATE SYSTEM SETTINGS ---
    console.log("⚙️ Migrating settings...");
    const mongoSettings = await Settings.find({});
    console.log(`Found ${mongoSettings.length} settings in MongoDB.`);
    
    for (const s of mongoSettings) {
      const setObj = s.toObject();
      const payload = {
        id: setObj._id.toString(),
        key: setObj.key,
        value: setObj.value,
        description: setObj.description || null,
        is_encrypted: !!setObj.isEncrypted,
        created_at: setObj.createdAt ? new Date(setObj.createdAt).toISOString() : new Date().toISOString(),
        updated_at: setObj.updatedAt ? new Date(setObj.updatedAt).toISOString() : new Date().toISOString(),
      };

      const { error } = await supabase.from("system_settings").upsert(payload);
      if (error) console.error(`Failed to upsert setting ${s.key}:`, error.message);
    }
    console.log("✓ Settings migration processed.");

    // --- 6. MIGRATE NOTIFICATIONS ---
    console.log("🔔 Migrating notifications...");
    const mongoNotifications = await Notification.find({});
    
    for (const n of mongoNotifications) {
      const notifObj = n.toObject();
      const payload = {
        id: notifObj._id.toString(),
        user_id: notifObj.user ? notifObj.user.toString() : null,
        title: notifObj.title,
        message: notifObj.message,
        type: notifObj.type,
        read: !!notifObj.read,
        order_id: notifObj.orderId ? notifObj.orderId.toString() : null,
        created_at: notifObj.createdAt ? new Date(notifObj.createdAt).toISOString() : new Date().toISOString(),
        updated_at: notifObj.updatedAt ? new Date(notifObj.updatedAt).toISOString() : new Date().toISOString(),
      };

      const { error } = await supabase.from("notifications").upsert(payload);
      if (error) console.error(`Failed to upsert notification ${n._id}:`, error.message);
    }
    console.log("✓ Notifications migration processed.");

    // --- 7. MIGRATE PAYMENTS ---
    console.log("💳 Migrating payments...");
    const mongoPayments = await Payment.find({});
    
    for (const p of mongoPayments) {
      const payObj = p.toObject();
      const payload = {
        id: payObj._id.toString(),
        order_id: payObj.order ? payObj.order.toString() : null,
        payment_id: payObj.paymentId || null,
        razorpay_order_id: payObj.razorpayOrderId || null,
        razorpay_signature: payObj.razorpaySignature || null,
        amount: payObj.amount,
        status: payObj.status,
        method: payObj.method || null,
        refund_id: payObj.refundId || null,
        refund_status: payObj.refundStatus || null,
        refund_amount: payObj.refundAmount || null,
        created_at: payObj.createdAt ? new Date(payObj.createdAt).toISOString() : new Date().toISOString(),
        updated_at: payObj.updatedAt ? new Date(payObj.updatedAt).toISOString() : new Date().toISOString(),
      };

      const { error } = await supabase.from("payments").upsert(payload);
      if (error) console.error(`Failed to upsert payment ${p._id}:`, error.message);
    }
    console.log("✓ Payments migration processed.");

    // --- 8. MIGRATE RETURNS ---
    console.log("🔄 Migrating returns...");
    const mongoReturns = await Return.find({});
    
    for (const r of mongoReturns) {
      const retObj = r.toObject();
      const payload = {
        id: retObj._id.toString(),
        order_id: retObj.order ? retObj.order.toString() : null,
        items: JSON.stringify(retObj.items || []),
        reason: retObj.reason,
        images: JSON.stringify(retObj.images || []),
        status: retObj.status || 'Pending',
        store_notes: retObj.storeNotes || null,
        refund_amount: retObj.refundAmount || null,
        refund_status: retObj.refundStatus || null,
        refund_id: retObj.refundId || null,
        created_at: retObj.createdAt ? new Date(retObj.createdAt).toISOString() : new Date().toISOString(),
        updated_at: retObj.updatedAt ? new Date(retObj.updatedAt).toISOString() : new Date().toISOString(),
      };

      const { error } = await supabase.from("returns").upsert(payload);
      if (error) console.error(`Failed to upsert return ${r._id}:`, error.message);
    }
    console.log("✓ Returns migration processed.");

    // --- 9. MIGRATE FAVORITES ---
    console.log("❤️ Migrating favorites...");
    const mongoFavorites = await Favorite.find({});
    
    for (const f of mongoFavorites) {
      const favObj = f.toObject();
      const payload = {
        id: favObj._id.toString(),
        user_id: favObj.user ? favObj.user.toString() : null,
        stores: JSON.stringify(favObj.stores || []),
        products: JSON.stringify(favObj.products || []),
        created_at: favObj.createdAt ? new Date(favObj.createdAt).toISOString() : new Date().toISOString(),
        updated_at: favObj.updatedAt ? new Date(favObj.updatedAt).toISOString() : new Date().toISOString(),
      };

      const { error } = await supabase.from("favorites").upsert(payload);
      if (error) console.error(`Failed to upsert favorite ${f._id}:`, error.message);
    }
    console.log("✓ Favorites migration processed.");

    console.log("🎉 MIGRATION SUCCESSFUL! All collections have been successfully mirrored in Supabase.");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ MIGRATION ERROR:", err.message || err);
    process.exit(1);
  }
}

runMigration();
