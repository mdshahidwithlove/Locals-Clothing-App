import { AdminService } from './admin.service';
import type { Response, Request } from 'express';
import z from 'zod';
import type { CustomRequest } from '../types';

// Validation schemas
const signupSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50, 'Username must be less than 50 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional()
});

const loginPasswordSchema = z.object({
  username: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required')
});

const requestOtpSchema = z.object({
  phone: z.string().min(1, 'Phone number is required')
});

const verifyOtpSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  otp: z.string().length(6, 'OTP must be 6 digits')
});

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(50_000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const dateYmd = z
  .string()
  .optional()
  .transform(val => (val === '' ? undefined : val))
  .refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
    message: 'Use YYYY-MM-DD',
  });

const transactionsQuerySchema = paginationQuerySchema
  .extend({
    status: z.string().trim().max(64).optional(),
    method: z.enum(['COD', 'Online']).optional(),
    dateFrom: dateYmd,
    dateTo: dateYmd,
  })
  .refine(d => !d.dateFrom || !d.dateTo || d.dateFrom <= d.dateTo, {
    path: ['dateTo'],
    message: 'dateTo must be on or after dateFrom',
  });

const ordersQuerySchema = paginationQuerySchema
  .extend({
    status: z.string().trim().max(64).optional(),
    search: z.string().trim().max(200).optional(),
    dateFrom: dateYmd,
    dateTo: dateYmd,
    paymentMethod: z.enum(['COD', 'Online']).optional(),
    paymentStatus: z.enum(['Pending', 'Completed', 'Failed', 'Refunded']).optional(),
  })
  .refine(d => !d.dateFrom || !d.dateTo || d.dateFrom <= d.dateTo, {
    path: ['dateTo'],
    message: 'dateTo must be on or after dateFrom',
  });

const usersQuerySchema = paginationQuerySchema.extend({
  role: z.string().trim().max(32).optional(),
  search: z.string().trim().max(200).optional(),
});

const deliveryPartnersQuerySchema = paginationQuerySchema.extend({
  status: z.string().trim().max(32).optional(),
});

const storePerformanceQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['totalRevenue', 'totalOrders', 'returnRate', 'rating']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const mongoIdParamSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id'),
});

const forceCancelBodySchema = z.object({
  reason: z.string().max(2000).optional(),
});

const verificationQueueQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['pending_documents', 'pending_review', 'approved', 'rejected']).optional(),
  search: z.string().trim().max(200).optional(),
});

const verificationUpdateBodySchema = z.object({
  status: z.enum(['pending_documents', 'pending_review', 'approved', 'rejected']),
  note: z.string().max(2000).optional(),
});

// Admin signup
export async function adminSignup(req: Request, res: Response): Promise<Response> {
  try {
    const validatedData = signupSchema.parse(req.body);
    
    const result = await AdminService.createAdmin(validatedData);
    
    return res.status(201).json({
      success: true,
      message: 'Admin account created successfully',
      data: result
    });
  } catch (error: any) {
    console.error('Admin signup error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.issues
      });
    }
    
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create admin account'
    });
  }
}

// Admin login with password
export async function adminLoginPassword(req: Request, res: Response): Promise<Response> {
  try {
    const validatedData = loginPasswordSchema.parse(req.body);
    
    const result = await AdminService.loginWithPassword(validatedData);
    
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error: any) {
    console.error('Admin login error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.issues
      });
    }
    
    return res.status(401).json({
      success: false,
      message: error.message || 'Login failed'
    });
  }
}

// Request OTP for admin login
export async function adminRequestOtp(req: Request, res: Response): Promise<Response> {
  try {
    const validatedData = requestOtpSchema.parse(req.body);
    
    await AdminService.requestOTP(validatedData.phone);
    
    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully'
    });
  } catch (error: any) {
    console.error('Admin request OTP error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.issues
      });
    }
    
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to send OTP'
    });
  }
}

// Verify OTP and login
export async function adminVerifyOtp(req: Request, res: Response): Promise<Response> {
  try {
    const validatedData = verifyOtpSchema.parse(req.body);
    
    const result = await AdminService.verifyOTPAndLogin(validatedData.phone, validatedData.otp);
    
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error: any) {
    console.error('Admin verify OTP error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.issues
      });
    }
    
    return res.status(401).json({
      success: false,
      message: error.message || 'OTP verification failed'
    });
  }
}

// Get admin profile
export async function getAdminProfile(req: CustomRequest, res: Response): Promise<Response> {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }
    
    const admin = await AdminService.getAdminProfile(req.admin._id);
    
    return res.status(200).json({
      success: true,
      message: 'Admin profile retrieved successfully',
      data: { admin }
    });
  } catch (error: any) {
    console.error('Get admin profile error:', error);
    
    return res.status(404).json({
      success: false,
      message: error.message || 'Failed to get admin profile'
    });
  }
}

// ─── Dashboard Controllers ─────────────────────────────────────────────────

// Analytics Overview
export async function getAnalyticsOverview(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const parsed = z.object({
      dateFrom: dateYmd,
      dateTo: dateYmd,
    }).safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: parsed.error.issues,
      });
    }

    const { dateFrom, dateTo } = parsed.data;
    const data = await AdminService.getAnalyticsOverview({ dateFrom, dateTo });
    return res.status(200).json({
      success: true,
      message: 'Analytics overview retrieved successfully',
      data,
    });
  } catch (error: any) {
    console.error('Analytics overview error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get analytics overview',
    });
  }
}

// Finance Summary
export async function getFinanceSummary(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const data = await AdminService.getFinanceSummary();
    return res.status(200).json({
      success: true,
      message: 'Finance summary retrieved successfully',
      data,
    });
  } catch (error: any) {
    console.error('Finance summary error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get finance summary',
    });
  }
}

// Transactions List
export async function getTransactions(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const parsed = transactionsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: parsed.error.issues,
      });
    }
    const { page, limit, status, method, dateFrom, dateTo } = parsed.data;
    const data = await AdminService.getTransactions({
      page,
      limit,
      status,
      method,
      dateFrom,
      dateTo,
    });
    return res.status(200).json({
      success: true,
      message: 'Transactions retrieved successfully',
      data,
    });
  } catch (error: any) {
    console.error('Transactions error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get transactions',
    });
  }
}

// All Orders
export async function getAllOrders(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const parsed = ordersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: parsed.error.issues,
      });
    }
    const { page, limit, status, search, dateFrom, dateTo, paymentMethod, paymentStatus } =
      parsed.data;
    const data = await AdminService.getAllOrders({
      page,
      limit,
      status,
      search,
      dateFrom,
      dateTo,
      paymentMethod,
      paymentStatus,
    });
    return res.status(200).json({
      success: true,
      message: 'Orders retrieved successfully',
      data,
    });
  } catch (error: any) {
    console.error('All orders error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get orders',
    });
  }
}

// Get Order By ID
export async function getAdminOrderById(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const parsed = mongoIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order id',
        errors: parsed.error.issues,
      });
    }
    const { id } = parsed.data;
    const data = await AdminService.getOrderById(id);
    return res.status(200).json({
      success: true,
      message: 'Order retrieved successfully',
      data,
    });
  } catch (error: any) {
    console.error('Get order by ID error:', error);
    const statusCode = error.message === 'Order not found' ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to get order',
    });
  }
}

// Force Cancel Order
export async function forceCancelOrder(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const idParsed = mongoIdParamSchema.safeParse(req.params);
    if (!idParsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order id',
        errors: idParsed.error.issues,
      });
    }
    const { id } = idParsed.data;
    const bodyParsed = forceCancelBodySchema.safeParse(req.body ?? {});
    if (!bodyParsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: bodyParsed.error.issues,
      });
    }
    const { reason } = bodyParsed.data;
    const data = await AdminService.forceCancelOrder(id, reason ?? '');
    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data,
    });
  } catch (error: any) {
    console.error('Force cancel order error:', error);
    const statusCode = error.message === 'Order not found' ? 404 : 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to cancel order',
    });
  }
}

// All Users
export async function getAllUsers(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const parsed = usersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: parsed.error.issues,
      });
    }
    const { page, limit, role, search } = parsed.data;
    const data = await AdminService.getAllUsers({
      page,
      limit,
      role,
      search,
    });
    return res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data,
    });
  } catch (error: any) {
    console.error('All users error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get users',
    });
  }
}

// User Stats
export async function getAdminUserStats(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const data = await AdminService.getUserStats();
    return res.status(200).json({
      success: true,
      message: 'User stats retrieved successfully',
      data,
    });
  } catch (error: any) {
    console.error('User stats error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get user stats',
    });
  }
}

// Delivery Partners
export async function getDeliveryPartners(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const parsed = deliveryPartnersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: parsed.error.issues,
      });
    }
    const { page, limit, status } = parsed.data;
    const data = await AdminService.getDeliveryPartners({
      page,
      limit,
      status,
    });
    return res.status(200).json({
      success: true,
      message: 'Delivery partners retrieved successfully',
      data,
    });
  } catch (error: any) {
    console.error('Delivery partners error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get delivery partners',
    });
  }
}

// Delivery Stats
export async function getDeliveryStats(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const data = await AdminService.getDeliveryStats();
    return res.status(200).json({
      success: true,
      message: 'Delivery stats retrieved successfully',
      data,
    });
  } catch (error: any) {
    console.error('Delivery stats error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get delivery stats',
    });
  }
}

// Store Performance
export async function getStorePerformance(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const parsed = storePerformanceQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: parsed.error.issues,
      });
    }
    const { page, limit, sortBy, sortOrder } = parsed.data;
    const data = await AdminService.getStorePerformance({
      page,
      limit,
      sortBy,
      sortOrder,
    });
    return res.status(200).json({
      success: true,
      message: 'Store performance retrieved successfully',
      data,
    });
  } catch (error: any) {
    console.error('Store performance error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get store performance',
    });
  }
}

// Single store — overview & performance
export async function getAdminStoreDetail(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const parsed = mongoIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid store id',
        errors: parsed.error.issues,
      });
    }
    const data = await AdminService.getStoreDetail(parsed.data.id);
    return res.status(200).json({
      success: true,
      message: 'Store detail retrieved successfully',
      data,
    });
  } catch (error: any) {
    console.error('Store detail error:', error);
    if (error.message === 'Store not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get store detail',
    });
  }
}

export async function getVerificationQueue(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const roleParam = req.params.role;
    if (roleParam !== 'merchants' && roleParam !== 'delivery') {
      return res.status(400).json({ success: false, message: 'Invalid verification queue' });
    }
    const parsed = verificationQueueQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: parsed.error.issues,
      });
    }
    const data = await AdminService.getVerificationQueue({
      role: roleParam === 'merchants' ? 'Merchant' : 'Delivery',
      page: parsed.data.page,
      limit: parsed.data.limit,
      status: parsed.data.status,
      search: parsed.data.search,
    });
    return res.status(200).json({
      success: true,
      message: 'Verification queue retrieved successfully',
      data,
    });
  } catch (error: any) {
    console.error('Verification queue error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get verification queue',
    });
  }
}

export async function getVerificationDetail(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const parsed = mongoIdParamSchema.safeParse({ id: req.params.userId });
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user id',
        errors: parsed.error.issues,
      });
    }
    const data = await AdminService.getVerificationDetail(parsed.data.id);
    return res.status(200).json({
      success: true,
      message: 'Verification detail retrieved successfully',
      data,
    });
  } catch (error: any) {
    console.error('Verification detail error:', error);
    if (error.message === 'User not found' || error.message.includes('not a merchant')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get verification detail',
    });
  }
}

export async function updateVerificationStatus(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const idParsed = mongoIdParamSchema.safeParse({ id: req.params.userId });
    if (!idParsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user id',
        errors: idParsed.error.issues,
      });
    }
    const bodyParsed = verificationUpdateBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
        errors: bodyParsed.error.issues,
      });
    }
    const data = await AdminService.updateVerificationStatus(
      idParsed.data.id,
      bodyParsed.data.status,
      bodyParsed.data.note,
    );
    return res.status(200).json({
      success: true,
      message: 'Verification status updated successfully',
      data,
    });
  } catch (error: any) {
    console.error('Update verification status error:', error);
    if (error.message === 'User not found' || error.message.includes('not a merchant')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes('Cannot mark under review')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update verification status',
    });
  }
}

const storeStatusBodySchema = z.object({
  isActive: z.boolean(),
});

export async function updateStoreStatus(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const idParsed = mongoIdParamSchema.safeParse({ id: req.params.id });
    if (!idParsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid store id' });
    }
    const bodyParsed = storeStatusBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
        errors: bodyParsed.error.issues,
      });
    }
    const data = await AdminService.updateStoreStatus(idParsed.data.id, bodyParsed.data.isActive);
    return res.status(200).json({
      success: true,
      message: `Store ${bodyParsed.data.isActive ? 'activated' : 'deactivated'} successfully`,
      data,
    });
  } catch (error: any) {
    console.error('Update store status error:', error);
    if (error.message === 'Store not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update store status',
    });
  }
}

export async function getAdminNotifications(req: Request, res: Response): Promise<Response | void> {
  try {
    const NotificationModel = require('../Models/notificationModel').default;
    const notifications = await NotificationModel.find({ recipientRole: 'Admin' })
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json({ success: true, data: notifications });
  } catch (error: any) {
    console.error('Fetch admin notifications error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch notifications' });
  }
}

const updateCommissionBodySchema = z.object({
  commissionRate: z.number().min(0).max(100, 'Commission rate must be between 0 and 100')
});

export async function updateStoreCommission(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const idParsed = mongoIdParamSchema.safeParse({ id: req.params.id });
    if (!idParsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid store id' });
    }
    const bodyParsed = updateCommissionBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
        errors: bodyParsed.error.issues,
      });
    }
    const data = await AdminService.updateStoreCommission(idParsed.data.id, bodyParsed.data.commissionRate);
    return res.status(200).json({
      success: true,
      message: 'Store commission updated successfully',
      data,
    });
  } catch (error: any) {
    console.error('Update store commission error:', error);
    if (error.message === 'Store not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update store commission',
    });
  }
}

export async function settleDeliveryPartnerCash(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const idParsed = mongoIdParamSchema.safeParse({ id: req.params.id });
    if (!idParsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid delivery partner id' });
    }
    const data = await AdminService.settleDeliveryPartnerCash(idParsed.data.id);
    return res.status(200).json({
      success: true,
      message: 'Delivery partner cash balance settled successfully',
      data,
    });
  } catch (error: any) {
    console.error('Settle delivery partner cash error:', error);
    if (error.message === 'Delivery partner not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to settle delivery partner cash',
    });
  }
}

const createSettlementBodySchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(['Payout', 'Collection']),
  paymentMethod: z.enum(['BankTransfer', 'UPI', 'Cash', 'Other']),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
});

export async function getStoreSettlements(req: Request, res: Response): Promise<Response> {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const store = req.query.store as string;

    const data = await AdminService.getStoreSettlements({ page, limit, store });
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Fetch store settlements error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch store settlements',
    });
  }
}

export async function createStoreSettlement(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const idParsed = mongoIdParamSchema.safeParse({ id: req.params.id });
    if (!idParsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid store id' });
    }
    const bodyParsed = createSettlementBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
        errors: bodyParsed.error.issues,
      });
    }

    const adminId = req.user?._id;
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { amount, type, paymentMethod, transactionReference, notes } = bodyParsed.data;

    const data = await AdminService.createStoreSettlement(
      idParsed.data.id,
      amount,
      type,
      paymentMethod,
      transactionReference,
      notes,
      adminId.toString()
    );

    return res.status(201).json({
      success: true,
      message: 'Store settlement recorded successfully',
      data,
    });
  } catch (error: any) {
    console.error('Record store settlement error:', error);
    if (error.message === 'Store not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to record store settlement',
    });
  }
}

export async function getAdminWithdrawals(req: Request, res: Response): Promise<Response> {
  try {
    const status = req.query.status as string;
    const role = req.query.role as string;
    const period = req.query.period as string;
    const requests = await AdminService.getAllWithdrawals(status, role, period);
    return res.status(200).json({
      success: true,
      requests
    });
  } catch (error: any) {
    console.error('Fetch withdrawals error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch withdrawal requests',
    });
  }
}

export async function processAdminWithdrawal(req: CustomRequest, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const { status, statusNotes } = req.body;
    const adminId = req.user?._id;

    if (!["Approved", "Rejected", "Pending"].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const withdrawal = await AdminService.updateWithdrawalStatus(
      id as string,
      status,
      statusNotes,
      adminId?.toString()
    );

    return res.status(200).json({
      success: true,
      message: `Withdrawal request status updated to ${status} successfully`,
      withdrawal
    });
  } catch (error: any) {
    console.error('Process withdrawal error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process withdrawal request',
    });
  }
}