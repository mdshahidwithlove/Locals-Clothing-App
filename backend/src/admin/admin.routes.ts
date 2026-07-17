import { Router } from 'express';
import {
  adminSignup,
  adminLoginPassword,
  adminRequestOtp,
  adminVerifyOtp,
  getAdminProfile,
  getAnalyticsOverview,
  getFinanceSummary,
  getTransactions,
  getAllOrders,
  getAdminOrderById,
  forceCancelOrder,
  getAllUsers,
  getAdminUserStats,
  getDeliveryPartners,
  getDeliveryStats,
  getStorePerformance,
  getAdminStoreDetail,
  getVerificationQueue,
  getVerificationDetail,
  updateVerificationStatus,
  updateStoreStatus,
  getAdminNotifications,
  updateStoreCommission,
  settleDeliveryPartnerCash,
  getStoreSettlements,
  createStoreSettlement,
  getAdminWithdrawals,
  processAdminWithdrawal,
} from './admin.controller';
import { getSettings, updateSettings } from './settingsController';
import { isAdminAuthenticated } from './admin.middleware';

const router = Router();

// Public routes
router.post('/auth/signup', adminSignup);
router.post('/auth/login-password', adminLoginPassword);
router.post('/auth/request-otp', adminRequestOtp);
router.post('/auth/verify-otp', adminVerifyOtp);

// Protected routes
router.get('/profile', isAdminAuthenticated, getAdminProfile);

// ─── Dashboard Routes (all protected) ──────────────────────────────────────

// Analytics
router.get('/analytics/overview', isAdminAuthenticated, getAnalyticsOverview);

// Finance
router.get('/finance/summary', isAdminAuthenticated, getFinanceSummary);
router.get('/finance/transactions', isAdminAuthenticated, getTransactions);

// Orders
router.get('/orders', isAdminAuthenticated, getAllOrders);
router.get('/orders/:id', isAdminAuthenticated, getAdminOrderById);
router.patch('/orders/:id/cancel', isAdminAuthenticated, forceCancelOrder);

// Users
router.get('/users', isAdminAuthenticated, getAllUsers);
router.get('/users/stats', isAdminAuthenticated, getAdminUserStats);

// Delivery Partners
router.get('/delivery-partners', isAdminAuthenticated, getDeliveryPartners);
router.get('/delivery-partners/stats', isAdminAuthenticated, getDeliveryStats);

// Stores
router.get('/stores/performance', isAdminAuthenticated, getStorePerformance);
router.get('/stores/:id/detail', isAdminAuthenticated, getAdminStoreDetail);
router.patch('/stores/:id/status', isAdminAuthenticated, updateStoreStatus);
router.patch('/stores/:id/commission', isAdminAuthenticated, updateStoreCommission);
router.get('/stores/settlements', isAdminAuthenticated, getStoreSettlements);
router.post('/stores/:id/settlements', isAdminAuthenticated, createStoreSettlement);

// Delivery partners cash settlement route
router.post('/delivery-partners/:id/settle-cash', isAdminAuthenticated, settleDeliveryPartnerCash);

// Verification (merchants & delivery partners)
router.get('/verification/queue/:role', isAdminAuthenticated, getVerificationQueue);
router.get('/verification/users/:userId', isAdminAuthenticated, getVerificationDetail);
router.patch('/verification/users/:userId/status', isAdminAuthenticated, updateVerificationStatus);

// Notifications
router.get('/notifications', isAdminAuthenticated, getAdminNotifications);

// Settings
router.get('/settings', isAdminAuthenticated, getSettings);
router.patch('/settings', isAdminAuthenticated, updateSettings);

// Withdrawals
router.get('/withdrawals', isAdminAuthenticated, getAdminWithdrawals);
router.put('/withdrawals/:id/status', isAdminAuthenticated, processAdminWithdrawal);

export default router;
