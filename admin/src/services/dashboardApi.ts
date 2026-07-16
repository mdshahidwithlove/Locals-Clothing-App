import api from './api';

// ─── Analytics ──────────────────────────────────────────────────────────────
export async function fetchAnalyticsOverview(params?: { dateFrom?: string; dateTo?: string }) {
  const res = await api.get('/api/v1/admin/analytics/overview', { params });
  return res.data.data;
}

// ─── Finance ────────────────────────────────────────────────────────────────
export async function fetchFinanceSummary() {
  const res = await api.get('/api/v1/admin/finance/summary');
  return res.data.data;
}

export async function fetchTransactions(params?: {
  page?: number;
  limit?: number;
  status?: string;
  method?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const res = await api.get('/api/v1/admin/finance/transactions', { params });
  return res.data.data;
}

// ─── Orders ─────────────────────────────────────────────────────────────────
export async function fetchAllOrders(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: string;
  paymentStatus?: string;
}) {
  const res = await api.get('/api/v1/admin/orders', { params });
  return res.data.data;
}

export async function fetchOrderById(id: string) {
  const res = await api.get(`/api/v1/admin/orders/${id}`);
  return res.data.data;
}

export async function forceCancelOrder(id: string, reason: string) {
  const res = await api.patch(`/api/v1/admin/orders/${id}/cancel`, { reason });
  return res.data.data;
}

// ─── Users ──────────────────────────────────────────────────────────────────
export async function fetchAllUsers(params?: {
  page?: number;
  limit?: number;
  role?: string;
  search?: string;
}) {
  const res = await api.get('/api/v1/admin/users', { params });
  return res.data.data;
}

export async function fetchUserStats() {
  const res = await api.get('/api/v1/admin/users/stats');
  return res.data.data;
}

// ─── Delivery Partners ─────────────────────────────────────────────────────
export async function fetchDeliveryPartners(params?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  const res = await api.get('/api/v1/admin/delivery-partners', { params });
  return res.data.data;
}

export async function fetchDeliveryStats() {
  const res = await api.get('/api/v1/admin/delivery-partners/stats');
  return res.data.data;
}

// ─── Stores ─────────────────────────────────────────────────────────────────
export async function fetchStorePerformance(params?: {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}) {
  const res = await api.get('/api/v1/admin/stores/performance', { params });
  return res.data.data;
}

export async function fetchStoreDetail(storeId: string) {
  const res = await api.get(`/api/v1/admin/stores/${storeId}/detail`);
  return res.data.data;
}

// ─── Verification ───────────────────────────────────────────────────────────
export async function fetchVerificationQueue(
  role: 'merchants' | 'delivery',
  params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  },
) {
  const res = await api.get(`/api/v1/admin/verification/queue/${role}`, { params });
  return res.data.data;
}

export async function fetchVerificationDetail(userId: string) {
  const res = await api.get(`/api/v1/admin/verification/users/${userId}`);
  return res.data.data;
}

export async function updateVerificationStatus(
  userId: string,
  status: string,
  note?: string,
) {
  const res = await api.patch(`/api/v1/admin/verification/users/${userId}/status`, {
    status,
    note,
  });
  return res.data.data;
}

export async function updateStoreStatus(storeId: string, isActive: boolean) {
  const res = await api.patch(`/api/v1/admin/stores/${storeId}/status`, { isActive });
  return res.data.data;
}

// ─── Settings ───────────────────────────────────────────────────────────────
export async function fetchSettings() {
  const res = await api.get('/api/v1/admin/settings');
  return res.data;
}

export async function updateSettings(settings: { key: string; value: string }[]) {
  const res = await api.patch('/api/v1/admin/settings', { settings });
  return res.data;
}

export async function fetchAdminNotifications() {
  const res = await api.get('/api/v1/admin/notifications');
  return res.data.data;
}

export async function updateStoreCommission(storeId: string, commissionRate: number) {
  const res = await api.patch(`/api/v1/admin/stores/${storeId}/commission`, { commissionRate });
  return res.data.data;
}

export async function settleDeliveryPartnerCash(partnerId: string) {
  const res = await api.post(`/api/v1/admin/delivery-partners/${partnerId}/settle-cash`);
  return res.data.data;
}
