import express from 'express';
import { onboarding, verifyOtp, getProfile, registerUser, loginUser, googleAuth, appleAuth, completeProfile, updateProfile, getUserStats, deleteAccount, requestPublicDeleteAccount, savePushToken, getUserNotifications, markNotificationRead } from '../controllers/usercontroller';
import { isAuthenticated } from '../middleware/auth';
import { getConfig } from '../services/configService';

const userRoute = express.Router();

// Get public platform fee config
userRoute.get('/platform-fee', (req, res) => {
  const feeType = getConfig("PLATFORM_FEE_TYPE", "flat");
  const feeValue = getConfig("PLATFORM_FEE_VALUE", "5");
  res.json({
    success: true,
    feeType,
    feeValue: parseFloat(feeValue) || 0
  });
});

// Send OTP for phone verification
userRoute.post('/onboarding', onboarding);
// Verify OTP code
userRoute.post('/verify-otp', verifyOtp);
// Register new user account
userRoute.post('/register', registerUser);
// Login existing user
userRoute.post('/login', loginUser);
// Google 1-Tap authentication
userRoute.post('/google-auth', googleAuth);
// Apple Sign-In authentication
userRoute.post('/apple-auth', appleAuth);
// Get user profile (requires authentication)
userRoute.get('/profile', isAuthenticated, getProfile);
// Update user profile (requires authentication)
userRoute.put('/profile', isAuthenticated, updateProfile);
// Get user stats (requires authentication)
userRoute.get('/stats', isAuthenticated, getUserStats);
// Complete user profile with additional details (requires authentication)
userRoute.post('/complete-profile', isAuthenticated, completeProfile);
// Permanently delete authenticated user account and all related data
userRoute.delete('/account', isAuthenticated, deleteAccount);
// Public account deletion request (Google Play Policy)
userRoute.post('/delete-account-request', requestPublicDeleteAccount);
// Register/Update push notifications token
userRoute.post('/push-token', isAuthenticated, savePushToken);
// Get list of recent notifications
userRoute.get('/notifications', isAuthenticated, getUserNotifications);
// Mark notification as read
userRoute.put('/notifications/:notificationId/read', isAuthenticated, markNotificationRead);

export default userRoute;