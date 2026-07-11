import AdminModel from './admin.model';
import { generateOTP } from '../utils/otp';
import { sendPhoneOtp } from '../utils/sms';
import { generateAdminToken } from '../utils/token';
import type { Admin } from '../types/admin';
import UserModel from '../Models/userModel';
import OrderModel from '../Models/orderModel';
import StoreModel from '../Models/storeModel';
import PaymentModel from '../Models/paymentModel';
import DeliveryModel from '../Models/deliveryModel';
import ReturnModel from '../Models/returnModel';
import { resolveVerificationStatus, verificationFieldsForClient } from '../utils/verificationUtils';
import type { VerificationStatus } from '../types/verification';
import { notifyVerificationDecision } from '../utils/notificationUtils';
import { deleteFileFromR2 } from '../utils/fileUpload';

export class AdminService {
  /** Escape user input used inside MongoDB $regex to reduce ReDoS / injection issues */
  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Calendar YYYY-MM-DD → server-local start/end of day for `createdAt` range filters */
  private static parseDateRangeFilter(
    dateFrom?: string,
    dateTo?: string,
  ): { $gte?: Date; $lte?: Date } | null {
    if (!dateFrom && !dateTo) return null;
    const range: { $gte?: Date; $lte?: Date } = {};
    if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      const [y, m, d] = dateFrom.split('-').map(Number);
      range.$gte = new Date(y, m - 1, d, 0, 0, 0, 0);
    }
    if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      const [y, m, d] = dateTo.split('-').map(Number);
      range.$lte = new Date(y, m - 1, d, 23, 59, 59, 999);
    }
    if (range.$gte === undefined && range.$lte === undefined) return null;
    return range;
  }

  // Create new admin
  static async createAdmin(adminData: {
    username: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<{ admin: Admin; token: string }> {
    // Check if admin already exists
    const existingAdmin = await AdminModel.findOne({
      $or: [
        { email: adminData.email },
        { username: adminData.username },
        ...(adminData.phone ? [{ phone: adminData.phone }] : [])
      ]
    });

    if (existingAdmin) {
      if (existingAdmin.email === adminData.email) {
        throw new Error('Admin with this email already exists');
      }
      if (existingAdmin.username === adminData.username) {
        throw new Error('Admin with this username already exists');
      }
      if (existingAdmin.phone === adminData.phone) {
        throw new Error('Admin with this phone number already exists');
      }
    }

    // Create new admin
    const admin = new AdminModel(adminData);
    await admin.save();

    // Generate token
    const token = generateAdminToken(admin._id.toString());

    // Remove password from response
    const adminResponse: any = admin.toObject();
    delete adminResponse.password;
    delete adminResponse.otp;

    return { admin: adminResponse, token };
  }

  // Login with username and password
  static async loginWithPassword(credentials: {
    username: string;
    password: string;
  }): Promise<{ admin: Admin; token: string }> {
    // Find admin by username or email
    const admin = await AdminModel.findOne({
      $or: [
        { username: credentials.username },
        { email: credentials.username }
      ]
    });

    if (!admin) {
      throw new Error('Invalid credentials');
    }

    if (!admin.isActive) {
      throw new Error('Admin account is deactivated');
    }

    // Check password
    const isPasswordValid = await admin.comparePassword(credentials.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate token
    const token = generateAdminToken(admin._id.toString());

    // Remove password from response
    const adminResponse: any = admin.toObject();
    delete adminResponse.password;
    delete adminResponse.otp;

    return { admin: adminResponse, token };
  }

  // Request OTP for phone login
  static async requestOTP(phone: string): Promise<void> {
    // Clean and validate phone number (reuse existing validation)
    const phoneValidation = this.cleanAndValidatePhone(phone);
    if (!phoneValidation.isValid) {
      throw new Error(phoneValidation.error || 'Invalid phone number format');
    }

    const cleanPhone = phoneValidation.cleanPhone;

    // Find admin by phone
    const admin = await AdminModel.findOne({ phone: cleanPhone });
    if (!admin) {
      throw new Error('No admin account found with this phone number');
    }

    if (!admin.isActive) {
      throw new Error('Admin account is deactivated');
    }

    // Generate OTP
    const otp = admin.generateOTP();
    await admin.save();

    // Send OTP
    const smsResult = await sendPhoneOtp(cleanPhone, otp);
    if (!smsResult) {
      throw new Error('Failed to send OTP. Please try again.');
    }
  }

  // Verify OTP and login
  static async verifyOTPAndLogin(phone: string, otp: string): Promise<{ admin: Admin; token: string }> {
    // Clean and validate phone number
    const phoneValidation = this.cleanAndValidatePhone(phone);
    if (!phoneValidation.isValid) {
      throw new Error(phoneValidation.error || 'Invalid phone number format');
    }

    const cleanPhone = phoneValidation.cleanPhone;

    // Find admin by phone
    const admin = await AdminModel.findOne({ phone: cleanPhone });
    if (!admin) {
      throw new Error('No admin account found with this phone number');
    }

    if (!admin.isActive) {
      throw new Error('Admin account is deactivated');
    }

    // Verify OTP
    const isOTPValid = admin.verifyOTP(otp);
    if (!isOTPValid) {
      throw new Error('Invalid or expired OTP');
    }

    // Clear OTP after successful verification
    admin.clearOTP();
    admin.lastLogin = new Date();
    await admin.save();

    // Generate token
    const token = generateAdminToken(admin._id.toString());

    // Remove password from response
    const adminResponse: any = admin.toObject();
    delete adminResponse.password;
    delete adminResponse.otp;

    return { admin: adminResponse, token };
  }

  // Get admin profile
  static async getAdminProfile(adminId: string): Promise<Admin> {
    const admin = await AdminModel.findById(adminId);
    if (!admin) {
      throw new Error('Admin not found');
    }

    if (!admin.isActive) {
      throw new Error('Admin account is deactivated');
    }

    // Remove sensitive data
    const adminResponse: any = admin.toObject();
    delete adminResponse.password;
    delete adminResponse.otp;

    return adminResponse;
  }

  // ─── Dashboard: Analytics Overview ────────────────────────────────────────
  static async getAnalyticsOverview(query?: { dateFrom?: string; dateTo?: string }): Promise<any> {
    const now = new Date();

    // Parse date filters
    let matchRange: any = {};
    if (query?.dateFrom || query?.dateTo) {
      matchRange = AdminService.parseDateRangeFilter(query.dateFrom, query.dateTo) || {};
    }

    // Default to last 30 days if no date range is provided
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dateFilter = matchRange.createdAt || { $gte: thirtyDaysAgo };

    // Run all count queries in parallel
    const [
      totalUsers,
      totalMerchants,
      totalDeliveryPartners,
      totalCustomers,
      totalOrders,
      totalStores,
      newUsersInPeriod,
      roleBreakdown,
      ordersTrendDaily,
      ordersTrendWeekly,
      ordersTrendMonthly,
      categoryWiseSales,
      rangeStatsResult,
      refundsResult
    ] = await Promise.all([
      UserModel.countDocuments(),
      UserModel.countDocuments({ role: 'Merchant' }),
      UserModel.countDocuments({ role: 'Delivery' }),
      UserModel.countDocuments({ role: 'User' }),
      OrderModel.countDocuments(),
      StoreModel.countDocuments(),
      UserModel.countDocuments({ createdAt: dateFilter }),
      UserModel.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      // Daily orders trend (last 30 days or in range)
      OrderModel.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Weekly orders trend (last 12 weeks or in range)
      OrderModel.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: { $isoWeek: '$createdAt' },
            year: { $first: { $isoWeekYear: '$createdAt' } },
            count: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
          },
        },
        { $sort: { year: 1, _id: 1 } },
      ]),
      // Monthly orders trend (last 12 months or in range)
      OrderModel.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Category-wise sales from order items in date range
      OrderModel.aggregate([
        { 
          $match: { 
            status: { $nin: ['Cancelled', 'Rejected'] },
            createdAt: dateFilter
          } 
        },
        { $unwind: '$orderItems' },
        {
          $lookup: {
            from: 'products',
            localField: 'orderItems.product',
            foreignField: '_id',
            as: 'productInfo',
          },
        },
        { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$productInfo.category',
            totalSold: { $sum: '$orderItems.quantity' },
            totalRevenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } },
          },
        },
        { $sort: { totalRevenue: -1 } },
      ]),
      // Detailed Financial Summary in range
      OrderModel.aggregate([
        { $match: { status: { $nin: ['Cancelled', 'Rejected'] }, createdAt: dateFilter } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
            deliveryFees: { $sum: '$deliveryFee' },
            platformFees: {
              $sum: { $cond: [{ $gt: ['$platformFee', 0] }, '$platformFee', { $multiply: ['$totalAmount', 0.05] }] }
            },
            storeEarnings: {
              $sum: { $subtract: ['$itemsTotal', { $cond: [{ $gt: ['$platformFee', 0] }, '$platformFee', { $multiply: ['$totalAmount', 0.05] }] }] }
            }
          }
        }
      ]),
      // Refunded amount in range (Loss)
      PaymentModel.aggregate([
        { $match: { paymentStatus: 'Refunded', createdAt: dateFilter } },
        {
          $group: {
            _id: null,
            totalRefunded: { $sum: '$amount' }
          }
        }
      ])
    ]);

    // Format role breakdown into an object
    const roles: Record<string, number> = {};
    roleBreakdown.forEach((r: any) => {
      roles[r._id || 'Unknown'] = r.count;
    });

    const rangeStats = rangeStatsResult[0] || { totalOrders: 0, revenue: 0, deliveryFees: 0, platformFees: 0, storeEarnings: 0 };
    const totalRefunded = refundsResult[0]?.totalRefunded || 0;

    return {
      totalUsers,
      totalMerchants,
      totalDeliveryPartners,
      totalCustomers,
      totalOrders,
      totalStores,
      newUsersLast30Days: newUsersInPeriod,
      roleBreakdown: roles,
      ordersTrend: {
        daily: ordersTrendDaily.map((d: any) => ({ date: d._id, count: d.count, revenue: d.revenue })),
        weekly: ordersTrendWeekly.map((w: any) => ({ week: w._id, year: w.year, count: w.count, revenue: w.revenue })),
        monthly: ordersTrendMonthly.map((m: any) => ({ month: m._id, count: m.count, revenue: m.revenue })),
      },
      categoryWiseSales: categoryWiseSales.map((c: any) => ({
        category: c._id || 'Unknown',
        totalSold: c.totalSold,
        totalRevenue: c.totalRevenue,
      })),
      financials: {
        totalOrders: rangeStats.totalOrders,
        revenue: Math.round(rangeStats.revenue),
        deliveryFees: Math.round(rangeStats.deliveryFees),
        platformFees: Math.round(rangeStats.platformFees),
        storeEarnings: Math.round(rangeStats.storeEarnings),
        refunds: Math.round(totalRefunded),
        profit: Math.round(rangeStats.platformFees),
        loss: Math.round(totalRefunded)
      }
    };
  }

  // ─── Dashboard: Finance Summary ─────────────────────────────────────────────
  static async getFinanceSummary(): Promise<any> {
    const [
      gmvResult,
      paymentStatusBreakdown,
      paymentMethodBreakdown,
      recentRevenueByMonth,
    ] = await Promise.all([
      // GMV: total value of all non-cancelled orders
      OrderModel.aggregate([
        { $match: { status: { $nin: ['Cancelled', 'Rejected'] } } },
        {
          $group: {
            _id: null,
            gmv: { $sum: '$totalAmount' },
            totalDeliveryFees: { $sum: '$deliveryFee' },
            orderCount: { $sum: 1 },
            platformCommission: {
              $sum: { $cond: [{ $gt: ['$platformFee', 0] }, '$platformFee', { $multiply: ['$totalAmount', 0.05] }] }
            }
          },
        },
      ]),
      // Payment status breakdown
      PaymentModel.aggregate([
        { $group: { _id: '$paymentStatus', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
      // Payment method breakdown
      PaymentModel.aggregate([
        { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
      // Monthly revenue last 6 months
      OrderModel.aggregate([
        {
          $match: {
            status: { $nin: ['Cancelled', 'Rejected'] },
            createdAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            revenue: { $sum: '$totalAmount' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const gmv = gmvResult[0]?.gmv || 0;
    const deliveryFees = gmvResult[0]?.totalDeliveryFees || 0;
    const orderCount = gmvResult[0]?.orderCount || 0;
    const platformCommission = Math.round(gmvResult[0]?.platformCommission || 0);

    // Format payment status into named fields
    const statusMap: Record<string, { count: number; total: number }> = {};
    paymentStatusBreakdown.forEach((p: any) => {
      statusMap[p._id || 'Unknown'] = { count: p.count, total: p.total };
    });

    const methodMap: Record<string, { count: number; total: number }> = {};
    paymentMethodBreakdown.forEach((p: any) => {
      methodMap[p._id || 'Unknown'] = { count: p.count, total: p.total };
    });

    return {
      gmv,
      totalDeliveryFees: deliveryFees,
      totalOrders: orderCount,
      platformCommission,
      successPayments: statusMap['Completed'] || { count: 0, total: 0 },
      failedPayments: statusMap['Failed'] || { count: 0, total: 0 },
      pendingPayments: statusMap['Pending'] || { count: 0, total: 0 },
      refundedPayments: statusMap['Refunded'] || { count: 0, total: 0 },
      paymentMethodBreakdown: methodMap,
      revenueByMonth: recentRevenueByMonth.map((m: any) => ({
        month: m._id,
        revenue: m.revenue,
        orders: m.orders,
      })),
    };
  }

  // ─── Dashboard: Transactions List ───────────────────────────────────────────
  static async getTransactions(query: {
    page?: number;
    limit?: number;
    status?: string;
    method?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<any> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.status && query.status !== 'all') {
      filter.paymentStatus = query.status;
    }
    if (query.method && query.method !== 'all') {
      filter.paymentMethod = query.method;
    }
    const txRange = AdminService.parseDateRangeFilter(query.dateFrom, query.dateTo);
    if (txRange) {
      filter.createdAt = txRange;
    }

    const [transactions, total] = await Promise.all([
      PaymentModel.find(filter)
        .populate('order', 'orderNumber totalAmount status')
        .populate('user', 'name phone email')
        .populate('store', 'storeName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PaymentModel.countDocuments(filter),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Dashboard: All Orders ──────────────────────────────────────────────────
  static async getAllOrders(query: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    paymentMethod?: string;
    paymentStatus?: string;
  }): Promise<any> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    if (query.paymentMethod) {
      filter.paymentMethod = query.paymentMethod;
    }
    if (query.paymentStatus) {
      filter.paymentStatus = query.paymentStatus;
    }
    const ordRange = AdminService.parseDateRangeFilter(query.dateFrom, query.dateTo);
    if (ordRange) {
      filter.createdAt = ordRange;
    }
    if (query.search) {
      const safe = AdminService.escapeRegex(query.search.trim());
      if (safe) {
        filter.$or = [
          { orderNumber: { $regex: safe, $options: 'i' } },
          { shippingAddress: { $regex: safe, $options: 'i' } },
        ];
      }
    }

    const breakdownFilter = { ...filter };
    delete breakdownFilter.status;

    const [orders, total, statusCounts] = await Promise.all([
      OrderModel.find(filter)
        .populate('user', 'name phone email')
        .populate('store', 'storeName')
        .populate('deliveryPerson', 'name phone')
        .select(
          'orderNumber totalAmount status paymentMethod paymentStatus createdAt user store deliveryPerson storeRated storeRating storeReview storeRatedAt shippingAddress',
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      OrderModel.countDocuments(filter),
      OrderModel.aggregate([
        { $match: breakdownFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const statusMap: Record<string, number> = {};
    statusCounts.forEach((s: any) => {
      statusMap[s._id] = s.count;
    });

    return {
      orders,
      statusCounts: statusMap,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Dashboard: Get Order By ID ─────────────────────────────────────────────
  static async getOrderById(orderId: string): Promise<any> {
    const order = await OrderModel.findById(orderId)
      .populate('user', 'name phone email avatar')
      .populate('store', 'storeName address contact')
      .populate('deliveryPerson', 'name phone avatar')
      .populate('orderItems.product', 'name images category subcategory price')
      .populate('paymentId')
      .lean();

    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  }

  // ─── Dashboard: Force Cancel Order ──────────────────────────────────────────
  static async forceCancelOrder(orderId: string, reason: string): Promise<any> {
    const order = await OrderModel.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'Delivered' || order.status === 'Cancelled') {
      throw new Error(`Cannot cancel order with status: ${order.status}`);
    }

    order.status = 'Cancelled';
    order.cancellationReason = reason || 'Force cancelled by admin';
    order.cancelledAt = new Date();
    order.statusHistory.push({
      status: 'Cancelled',
      timestamp: new Date(),
      note: `Force cancelled by admin: ${reason || 'No reason provided'}`,
    });

    await order.save();

    // Also cancel any associated delivery
    await DeliveryModel.updateMany(
      { order: order._id, status: { $nin: ['Delivered', 'Cancelled'] } },
      {
        $set: {
          status: 'Cancelled',
          cancellationReason: 'Order force cancelled by admin',
        },
      }
    );

    // Update payment status if pending
    await PaymentModel.updateMany(
      { order: order._id, paymentStatus: 'Pending' },
      { $set: { paymentStatus: 'Failed' } }
    );

    return order;
  }

  // ─── Dashboard: All Users ───────────────────────────────────────────────────
  static async getAllUsers(query: {
    page?: number;
    limit?: number;
    role?: string;
    search?: string;
  }): Promise<any> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.role && query.role !== 'all') {
      filter.role = query.role;
    }
    if (query.search) {
      const safe = AdminService.escapeRegex(query.search.trim());
      if (safe) {
        filter.$or = [
          { name: { $regex: safe, $options: 'i' } },
          { phone: { $regex: safe, $options: 'i' } },
          { email: { $regex: safe, $options: 'i' } },
        ];
      }
    }

    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .select('-password -otp -otpExpiry')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Dashboard: User Stats ──────────────────────────────────────────────────
  static async getUserStats(): Promise<any> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      roleBreakdown,
      newUsersLast30,
      profileCompletionStats,
      registrationTrend,
    ] = await Promise.all([
      UserModel.countDocuments(),
      UserModel.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      UserModel.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      UserModel.aggregate([
        {
          $group: {
            _id: '$isProfileComplete',
            count: { $sum: 1 },
          },
        },
      ]),
      // Registration trend last 30 days
      UserModel.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const roles: Record<string, number> = {};
    roleBreakdown.forEach((r: any) => {
      roles[r._id || 'Unknown'] = r.count;
    });

    const profileCompletion: Record<string, number> = {};
    profileCompletionStats.forEach((p: any) => {
      profileCompletion[p._id ? 'complete' : 'incomplete'] = p.count;
    });

    return {
      totalUsers,
      roleBreakdown: roles,
      newUsersLast30Days: newUsersLast30,
      profileCompletion,
      registrationTrend: registrationTrend.map((r: any) => ({
        date: r._id,
        count: r.count,
      })),
    };
  }

  // ─── Dashboard: Delivery Partners ───────────────────────────────────────────
  static async getDeliveryPartners(query: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<any> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = { role: 'Delivery' };
    if (query.status === 'online') {
      filter.isActive = true;
      filter.isBusy = false;
    } else if (query.status === 'busy') {
      filter.isBusy = true;
    } else if (query.status === 'offline') {
      filter.isActive = false;
    }

    const [partners, total] = await Promise.all([
      UserModel.find(filter)
        .select('-password -otp -otpExpiry')
        .populate('currentOrder', 'orderNumber status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    // Get delivery stats for each partner
    const partnerIds = partners.map((p: any) => p._id);
    const [deliveryStats, riderStats, codStats] = await Promise.all([
      DeliveryModel.aggregate([
        { $match: { deliveryPerson: { $in: partnerIds } } },
        {
          $group: {
            _id: '$deliveryPerson',
            totalDeliveries: { $sum: 1 },
            completedDeliveries: {
              $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0] },
            },
            avgRating: { $avg: '$rating' },
          },
        },
      ]),
      OrderModel.aggregate([
        { $match: { deliveryPerson: { $in: partnerIds }, status: 'Delivered' } },
        {
          $group: {
            _id: '$deliveryPerson',
            totalEarnings: { $sum: '$deliveryFee' },
          }
        }
      ]),
      PaymentModel.aggregate([
        {
          $match: {
            codCollectedBy: { $in: partnerIds },
            paymentMethod: 'COD',
            paymentStatus: 'Completed',
            codSubmittedToStore: false
          }
        },
        {
          $group: {
            _id: '$codCollectedBy',
            cashInHand: { $sum: '$amount' }
          }
        }
      ])
    ]);

    const statsMap: Record<string, any> = {};
    partnerIds.forEach((id: any) => {
      statsMap[id.toString()] = {
        totalDeliveries: 0,
        completedDeliveries: 0,
        avgRating: null,
        totalEarnings: 0,
        cashInHand: 0,
        netOwed: 0,
      };
    });

    deliveryStats.forEach((s: any) => {
      const id = s._id.toString();
      if (statsMap[id]) {
        statsMap[id].totalDeliveries = s.totalDeliveries;
        statsMap[id].completedDeliveries = s.completedDeliveries;
        statsMap[id].avgRating = s.avgRating ? Math.round(s.avgRating * 10) / 10 : null;
      }
    });

    riderStats.forEach((s: any) => {
      const id = s._id.toString();
      if (statsMap[id]) {
        statsMap[id].totalEarnings = Math.round(s.totalEarnings);
      }
    });

    codStats.forEach((s: any) => {
      const id = s._id.toString();
      if (statsMap[id]) {
        statsMap[id].cashInHand = Math.round(s.cashInHand);
        statsMap[id].netOwed = Math.round(s.cashInHand); // equivalent to cashInHand
      }
    });

    const enrichedPartners = partners.map((p: any) => ({
      ...p,
      verificationStatus: resolveVerificationStatus(p),
      deliveryStats: statsMap[p._id.toString()],
    }));

    return {
      partners: enrichedPartners,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Dashboard: Delivery Stats ──────────────────────────────────────────────
  static async getDeliveryStats(): Promise<any> {
    const [
      totalPartners,
      activePartners,
      busyPartners,
      offlinePartners,
      deliveryStatusBreakdown,
      avgDeliveryRating,
    ] = await Promise.all([
      UserModel.countDocuments({ role: 'Delivery' }),
      UserModel.countDocuments({ role: 'Delivery', isActive: true, isBusy: false }),
      UserModel.countDocuments({ role: 'Delivery', isBusy: true }),
      UserModel.countDocuments({ role: 'Delivery', isActive: false }),
      DeliveryModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      DeliveryModel.aggregate([
        { $match: { rating: { $exists: true, $ne: null } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } },
      ]),
    ]);

    const statusMap: Record<string, number> = {};
    deliveryStatusBreakdown.forEach((s: any) => {
      statusMap[s._id] = s.count;
    });

    return {
      totalPartners,
      activePartners,
      busyPartners,
      offlinePartners,
      deliveryStatusBreakdown: statusMap,
      avgDeliveryRating: avgDeliveryRating[0]?.avgRating
        ? Math.round(avgDeliveryRating[0].avgRating * 10) / 10
        : null,
    };
  }

  // ─── Dashboard: Store Performance ───────────────────────────────────────────
  static async getStorePerformance(query: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<any> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const allowedSort = new Set(['totalRevenue', 'totalOrders', 'returnRate', 'rating']);
    const sortBy = allowedSort.has(query.sortBy || '') ? (query.sortBy as string) : 'totalRevenue';
    const sortDir: 1 | -1 = query.sortOrder === 'asc' ? 1 : -1;

    const sortMongoKey =
      sortBy === 'rating' ? 'ratingAverage' : `orderStats.${sortBy}`;

    const totalStores = await StoreModel.countDocuments();

    const pipeline = [
      {
        $lookup: {
          from: 'orders',
          let: { storeId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$store', '$$storeId'] } } },
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: '$totalAmount' },
                deliveredOrders: {
                  $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0] },
                },
                cancelledOrders: {
                  $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] },
                },
              },
            },
          ],
          as: 'orderAgg',
        },
      },
      {
        $addFields: {
          orderStatsRaw: { $arrayElemAt: ['$orderAgg', 0] },
        },
      },
      {
        $addFields: {
          orderStats: {
            totalOrders: { $ifNull: ['$orderStatsRaw.totalOrders', 0] },
            totalRevenue: { $ifNull: ['$orderStatsRaw.totalRevenue', 0] },
            deliveredOrders: { $ifNull: ['$orderStatsRaw.deliveredOrders', 0] },
            cancelledOrders: { $ifNull: ['$orderStatsRaw.cancelledOrders', 0] },
          },
        },
      },
      {
        $addFields: {
          'orderStats.returnRate': {
            $cond: [
              { $gt: ['$orderStats.totalOrders', 0] },
              {
                $round: [
                  {
                    $multiply: [
                      {
                        $divide: ['$orderStats.cancelledOrders', '$orderStats.totalOrders'],
                      },
                      100,
                    ],
                  },
                  1,
                ],
              },
              0,
            ],
          },
          ratingAverage: { $ifNull: ['$rating.average', 0] },
        },
      },
      { $project: { orderAgg: 0, orderStatsRaw: 0 } },
      { $sort: { [sortMongoKey]: sortDir } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          let: { mid: '$merchantId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$mid'] } } },
            { $project: { name: 1, phone: 1, email: 1 } },
          ],
          as: 'ownerArr',
        },
      },
      {
        $addFields: {
          owner: { $arrayElemAt: ['$ownerArr', 0] },
        },
      },
      { $project: { ownerArr: 0, ratingAverage: 0, merchantId: 0 } },
    ];

    const rows = await StoreModel.aggregate(pipeline);
    const storeIds = rows.map((s: any) => s._id);

    const [allFinAgg, allPaymentAgg] = await Promise.all([
      OrderModel.aggregate([
        { $match: { store: { $in: storeIds }, status: 'Delivered' } },
        {
          $group: {
            _id: '$store',
            totalDeliveredSales: { $sum: '$itemsTotal' },
            totalPlatformFee: {
              $sum: { $cond: [{ $gt: ['$platformFee', 0] }, '$platformFee', { $multiply: ['$itemsTotal', 0.05] }] }
            },
            onlineSales: {
              $sum: { $cond: [{ $eq: ['$paymentMethod', 'Online'] }, '$itemsTotal', 0] }
            }
          }
        }
      ]),
      PaymentModel.aggregate([
        {
          $match: {
            store: { $in: storeIds },
            paymentMethod: 'COD',
            paymentStatus: 'Completed',
            codSubmittedToStore: true
          }
        },
        {
          $group: {
            _id: '$store',
            codSubmittedTotal: { $sum: '$amount' }
          }
        }
      ])
    ]);

    const finMap: Record<string, any> = {};
    const paymentMap: Record<string, any> = {};

    allFinAgg.forEach((f: any) => {
      if (f._id) {
        finMap[f._id.toString()] = f;
      }
    });

    allPaymentAgg.forEach((p: any) => {
      if (p._id) {
        paymentMap[p._id.toString()] = p;
      }
    });

    const stores = rows.map((s: any) => {
      const sidStr = s._id.toString();
      const fin = finMap[sidStr] || { totalDeliveredSales: 0, totalPlatformFee: 0, onlineSales: 0 };
      const pay = paymentMap[sidStr] || { codSubmittedTotal: 0 };

      const totalPlatformFee = Math.round(fin.totalPlatformFee);
      const storeNetEarnings = Math.round(fin.totalDeliveredSales - totalPlatformFee);
      const codCollectedAndHandedOver = Math.round(pay.codSubmittedTotal);
      const netBalance = Math.round(codCollectedAndHandedOver - storeNetEarnings);

      return {
        _id: s._id,
        storeName: s.storeName,
        owner: s.owner || null,
        rating: s.rating,
        isActive: s.isActive,
        createdAt: s.createdAt,
        orderStats: {
          ...s.orderStats,
          totalPlatformFee,
          storeNetEarnings,
          codCollectedAndHandedOver,
          onlineSales: Math.round(fin.onlineSales),
          netBalance,
        },
      };
    });

    return {
      stores,
      pagination: {
        page,
        limit,
        total: totalStores,
        totalPages: Math.ceil(totalStores / limit),
      },
    };
  }

  // ─── Dashboard: Single store detail (performance + recent orders) ───────────
  static async getStoreDetail(storeId: string): Promise<any> {
    const store = await StoreModel.findById(storeId).lean();
    if (!store) {
      throw new Error('Store not found');
    }

    const sid = store._id;
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const owner = await UserModel.findById((store as any).merchantId)
      .select('name phone email role verificationStatus isProfileComplete')
      .lean();

    const [orderAgg, statusBreakdown, ordersTrend, recentOrders, storeReviews, storeOrderIds] =
      await Promise.all([
      OrderModel.aggregate([
        { $match: { store: sid } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            deliveredOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0] },
            },
            cancelledOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] },
            },
          },
        },
      ]),
      OrderModel.aggregate([
        { $match: { store: sid } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      OrderModel.aggregate([
        { $match: { store: sid, createdAt: { $gte: ninetyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            orders: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      OrderModel.find({ store: sid })
        .sort({ createdAt: -1 })
        .limit(30)
        .populate('user', 'name phone')
        .populate('deliveryPerson', 'name phone')
        .select(
          'orderNumber totalAmount status paymentMethod paymentStatus createdAt user deliveryPerson storeRated storeRating',
        )
        .lean(),
      OrderModel.find({
        store: sid,
        status: 'Delivered',
        storeRated: true,
      })
        .sort({ storeRatedAt: -1 })
        .limit(50)
        .populate('user', 'name phone email')
        .select('orderNumber storeRating storeReview storeRatedAt user')
        .lean(),
      OrderModel.find({ store: sid }).distinct('_id'),
    ]);

    const [storeReturns, returnStatusBreakdown] = await Promise.all([
      ReturnModel.find({ order: { $in: storeOrderIds } })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('order', 'orderNumber totalAmount status paymentMethod paymentStatus')
        .populate('customer', 'name phone')
        .populate({
          path: 'returnDelivery',
          select: 'status deliveryType',
        })
        .lean(),
      ReturnModel.aggregate([
        { $match: { order: { $in: storeOrderIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const returnStats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
    };
    returnStatusBreakdown.forEach((row: any) => {
      const status = String(row._id);
      if (status === 'Pending') returnStats.pending = row.count;
      else if (status === 'Approved') returnStats.approved = row.count;
      else if (status === 'Rejected') returnStats.rejected = row.count;
      else if (status === 'Completed') returnStats.completed = row.count;
    });
    returnStats.total = returnStatusBreakdown.reduce(
      (sum: number, row: any) => sum + row.count,
      0,
    );

    const raw = orderAgg[0];
    const totalOrders = raw?.totalOrders ?? 0;
    const cancelledOrders = raw?.cancelledOrders ?? 0;
    const returnRate =
      totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 1000) / 10 : 0;

    const orderStatusBreakdown: Record<string, number> = {};
    statusBreakdown.forEach((s: any) => {
      orderStatusBreakdown[s._id] = s.count;
    });

    const [finAgg, paymentAgg] = await Promise.all([
      OrderModel.aggregate([
        { $match: { store: sid, status: 'Delivered' } },
        {
          $group: {
            _id: null,
            totalDeliveredSales: { $sum: '$itemsTotal' },
            totalPlatformFee: {
              $sum: { $cond: [{ $gt: ['$platformFee', 0] }, '$platformFee', { $multiply: ['$itemsTotal', 0.05] }] }
            },
            onlineSales: {
              $sum: { $cond: [{ $eq: ['$paymentMethod', 'Online'] }, '$itemsTotal', 0] }
            }
          }
        }
      ]),
      PaymentModel.aggregate([
        {
          $match: {
            store: sid,
            paymentMethod: 'COD',
            paymentStatus: 'Completed',
            codSubmittedToStore: true
          }
        },
        {
          $group: {
            _id: null,
            codSubmittedTotal: { $sum: '$amount' }
          }
        }
      ])
    ]);

    const fin = finAgg[0] || { totalDeliveredSales: 0, totalPlatformFee: 0, onlineSales: 0 };
    const pay = paymentAgg[0] || { codSubmittedTotal: 0 };

    const totalPlatformFee = Math.round(fin.totalPlatformFee);
    const storeNetEarnings = Math.round(fin.totalDeliveredSales - totalPlatformFee);
    const codCollectedAndHandedOver = Math.round(pay.codSubmittedTotal);
    const netBalance = Math.round(codCollectedAndHandedOver - storeNetEarnings);

    const s = store as any;

    return {
      store: {
        _id: s._id,
        storeName: s.storeName,
        address: s.address,
        description: s.description,
        isActive: s.isActive,
        rating: s.rating,
        contact: s.contact,
        createdAt: s.createdAt,
        owner: owner
          ? {
              _id: owner._id,
              name: owner.name,
              phone: owner.phone,
              email: owner.email,
              verificationStatus: resolveVerificationStatus(owner),
            }
          : null,
      },
      orderStats: {
        totalOrders,
        totalRevenue: raw?.totalRevenue ?? 0,
        deliveredOrders: raw?.deliveredOrders ?? 0,
        cancelledOrders,
        returnRate,
        totalPlatformFee,
        storeNetEarnings,
        codCollectedAndHandedOver,
        onlineSales: Math.round(fin.onlineSales),
        netBalance,
      },
      orderStatusBreakdown,
      ordersTrendDaily: ordersTrend.map((d: any) => ({
        date: d._id,
        orders: d.orders,
        revenue: d.revenue,
      })),
      recentOrders,
      storeReviews: storeReviews.map((order: any) => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        rating: order.storeRating,
        review: order.storeReview || '',
        ratedAt: order.storeRatedAt,
        userName: order.user?.name || order.user?.phone || 'Customer',
        userPhone: order.user?.phone,
      })),
      returnStats,
      storeReturns: storeReturns.map((ret: any) => ({
        _id: ret._id,
        status: ret.status,
        refundStatus: ret.refundStatus,
        reason: ret.reason,
        notes: ret.notes,
        refundUpiId: ret.refundUpiId,
        refundProofImage: ret.refundProofImage,
        createdAt: ret.createdAt,
        updatedAt: ret.updatedAt,
        order: ret.order
          ? {
              _id: ret.order._id,
              orderNumber: ret.order.orderNumber,
              totalAmount: ret.order.totalAmount,
              status: ret.order.status,
              paymentMethod: ret.order.paymentMethod,
              paymentStatus: ret.order.paymentStatus,
            }
          : null,
        customer: ret.customer
          ? {
              name: ret.customer.name,
              phone: ret.customer.phone,
            }
          : null,
        returnDelivery: ret.returnDelivery
          ? {
              status: ret.returnDelivery.status,
            }
          : null,
      })),
    };
  }

  // ─── Verification queue (merchants & delivery partners) ─────────────────────
  static async getVerificationQueue(params: {
    role: 'Merchant' | 'Delivery';
    page?: number;
    limit?: number;
    status?: VerificationStatus;
    search?: string;
  }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 15;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      role: params.role,
      isProfileComplete: true,
    };

    if (params.status) {
      filter.verificationStatus = params.status;
    } else {
      filter.verificationStatus = { $in: ['pending_documents', 'pending_review', 'rejected'] };
    }

    if (params.search?.trim()) {
      const q = AdminService.escapeRegex(params.search.trim());
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { phone: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
          ],
        },
      ];
    }

    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ verificationSubmittedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          'name phone email role verificationStatus verificationSubmittedAt verificationReviewedAt verificationReviewNote isPhoneVerified isEmailVerified createdAt',
        )
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    const items = await Promise.all(
      users.map(async (user: any) => {
        let storeName: string | null = null;
        if (params.role === 'Merchant') {
          const store = await StoreModel.findOne({ merchantId: user._id })
            .select('storeName')
            .lean();
          storeName = store?.storeName ?? null;
        }
        return {
          _id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          storeName,
          verificationStatus: user.verificationStatus || 'not_required',
          verificationSubmittedAt: user.verificationSubmittedAt,
          verificationReviewedAt: user.verificationReviewedAt,
          verificationReviewNote: user.verificationReviewNote,
          authMethod: user.isPhoneVerified ? 'phone_otp' : user.isEmailVerified ? 'email_password' : 'unknown',
          createdAt: user.createdAt,
        };
      }),
    );

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getVerificationDetail(userId: string) {
    const user = await UserModel.findById(userId).lean();
    if (!user) throw new Error('User not found');
    if (user.role !== 'Merchant' && user.role !== 'Delivery') {
      throw new Error('User is not a merchant or delivery partner');
    }

    let store = null;
    if (user.role === 'Merchant') {
      store = await StoreModel.findOne({ merchantId: user._id }).lean();
    }

    return {
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        gender: user.gender,
        avatar: user.avatar,
        addresses: user.addresses,
        role: user.role,
        isPhoneVerified: user.isPhoneVerified,
        isEmailVerified: user.isEmailVerified,
        isProfileComplete: user.isProfileComplete,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        verificationStatus: user.verificationStatus || 'not_required',
        verificationGrandfathered: !!user.verificationGrandfathered,
        verificationDocuments: user.verificationDocuments || [],
        verificationSubmittedAt: user.verificationSubmittedAt ?? null,
        verificationReviewedAt: user.verificationReviewedAt ?? null,
        verificationReviewNote: user.verificationReviewNote ?? null,
      },
      store,
      authMethod: user.isPhoneVerified ? 'phone_otp' : user.isEmailVerified ? 'email_password' : 'unknown',
    };
  }

  static async updateVerificationStatus(
    userId: string,
    status: VerificationStatus,
    note?: string,
  ) {
    type VerificationDecisionStatus =
      | 'pending_documents'
      | 'pending_review'
      | 'approved'
      | 'rejected';

    const allowed: VerificationDecisionStatus[] = [
      'pending_documents',
      'pending_review',
      'approved',
      'rejected',
    ];
    if (!allowed.includes(status as VerificationDecisionStatus)) {
      throw new Error('Invalid verification status');
    }

    const decisionStatus = status as VerificationDecisionStatus;

    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    if (user.role !== 'Merchant' && user.role !== 'Delivery') {
      throw new Error('User is not a merchant or delivery partner');
    }

    if (decisionStatus === 'pending_review') {
      const hasDocs =
        (user.verificationDocuments?.length ?? 0) > 0 || !!user.verificationSubmittedAt;
      if (!hasDocs) {
        throw new Error('Cannot mark under review — user has not uploaded documents yet');
      }
    }

    const update: Record<string, unknown> = {
      verificationStatus: decisionStatus,
      verificationGrandfathered: false,
      verificationReviewNote: note?.trim() || null,
    };

    if (decisionStatus === 'approved' || decisionStatus === 'rejected') {
      update.verificationReviewedAt = new Date();
    } else if (decisionStatus === 'pending_review') {
      update.verificationReviewedAt = null;
    }

    if (decisionStatus === 'pending_documents') {
      const docs = user.verificationDocuments || [];
      await Promise.all(
        docs.map((doc) => (doc.url ? deleteFileFromR2(doc.url) : Promise.resolve())),
      );
      update.verificationDocuments = [];
      update.verificationSubmittedAt = null;
      update.verificationReviewedAt = null;
    }

    const updated = await UserModel.findByIdAndUpdate(userId, update, { returnDocument: 'after' });
    if (!updated) throw new Error('User not found');

    await notifyVerificationDecision(
      updated._id,
      updated.role as 'Merchant' | 'Delivery',
      decisionStatus,
      note,
    );

    return {
      user: {
        _id: updated._id,
        name: updated.name,
        role: updated.role,
        verificationStatus: updated.verificationStatus,
        verificationGrandfathered: updated.verificationGrandfathered,
        verificationDocuments: updated.verificationDocuments || [],
        verificationSubmittedAt: updated.verificationSubmittedAt ?? null,
        verificationReviewedAt: updated.verificationReviewedAt ?? null,
        verificationReviewNote: updated.verificationReviewNote ?? null,
      },
    };
  }

  static async updateStoreStatus(storeId: string, isActive: boolean) {
    const store = await StoreModel.findByIdAndUpdate(
      storeId,
      { isActive, updatedAt: new Date() },
      { returnDocument: 'after' },
    );
    if (!store) throw new Error('Store not found');
    return {
      _id: store._id,
      storeName: store.storeName,
      isActive: store.isActive,
    };
  }

  // Utility function to clean and validate phone numbers (reused from userController)
  private static cleanAndValidatePhone(phone: string): { cleanPhone: string; isValid: boolean; error?: string } {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Remove country code if present (91 for India)
    const withoutCountryCode = cleaned.replace(/^91/, '');
    
    // Validate length
    if (withoutCountryCode.length !== 10) {
      return {
        cleanPhone: '',
        isValid: false,
        error: 'Phone number must be exactly 10 digits after removing country code'
      };
    }
    
    // Validate that it's a valid Indian mobile number (starts with 6, 7, 8, or 9)
    if (!/^[6-9]/.test(withoutCountryCode)) {
      return {
        cleanPhone: '',
        isValid: false,
        error: 'Invalid phone number. Indian mobile numbers must start with 6, 7, 8, or 9'
      };
    }
    
    return {
      cleanPhone: withoutCountryCode,
      isValid: true
    };
  }
}
