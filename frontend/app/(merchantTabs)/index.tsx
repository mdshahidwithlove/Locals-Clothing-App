import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, RefreshControl, Alert, Image } from 'react-native';
import { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import apiClient from '@/api/client';

export default function MerchantHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalEarnings: 0,
    storeRating: 0,
    isStoreActive: false
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storeStatusOpen, setStoreStatusOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [activeSectionTab, setActiveSectionTab] = useState<'financials' | 'riderCash' | 'products'>('financials');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerifyCodReceipt = async (riderHolding: any) => {
    const paymentIds = riderHolding.payments.map((p: any) => p.paymentId);
    if (!paymentIds || paymentIds.length === 0) return;

    Alert.alert(
      "Confirm Cash Received",
      `Are you sure you received ₹${Math.round(riderHolding.cashAmount)} cash from rider ${riderHolding.riderName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              setIsVerifying(true);
              const res = await apiClient.post('/api/v1/merchant-order/verify-cod', { paymentIds });
              if (res.data?.success) {
                Alert.alert("Success", `Receipt of ₹${Math.round(riderHolding.cashAmount)} verified successfully!`);
                loadMerchantStats();
              } else {
                Alert.alert("Error", res.data?.message || "Failed to verify receipt.");
              }
            } catch (err: any) {
              console.error("Error verifying COD receipt:", err);
              Alert.alert("Error", err?.response?.data?.message || err.message || "Failed to verify receipt.");
            } finally {
              setIsVerifying(false);
            }
          }
        }
      ]
    );
  };

  const loadMerchantStats = useCallback(async () => {
    try {
      setIsLoading(true);
      // Products count from merchant products endpoint (first page)
      const productsResp = await apiClient.get('/api/v1/product/merchant', { params: { page: 1, limit: 1 } });
      if (productsResp.data?.success) {
        setStats(prev => ({ ...prev, totalProducts: productsResp.data.pagination?.totalProducts || 0 }));
      }

      // Recent orders for the merchant (fetch few for dashboard)
      const ordersResp = await apiClient.get('/api/v1/merchant-order', { params: { page: 1, limit: 5 } });
      if (ordersResp.data?.success) {
        setRecentOrders(ordersResp.data.orders || []);
        setStats(prev => ({ ...prev, totalOrders: ordersResp.data.pagination?.totalOrders || 0 }));
      }

      // Pending orders count for merchant acceptance
      const pendingResp = await apiClient.get('/api/v1/merchant-order', { params: { status: 'Pending', page: 1, limit: 1 } });
      if (pendingResp.data?.success) {
        setStats(prev => ({ ...prev, pendingOrders: pendingResp.data.pagination?.totalOrders || 0 }));
      }

      // Removed settlements snapshot
      
      // Fetch analytics
      const analyticsResp = await apiClient.get('/api/v1/merchant-order/analytics');
      if (analyticsResp.data?.success) {
        setAnalytics(analyticsResp.data.analytics);
      }

      // Store rating from store details
      const storeResp = await apiClient.get('/api/v1/store/details');
      if (storeResp.data?.success) {
        const ratingAvg = storeResp.data.store?.rating?.average || 0;
        const isStoreActive = !!storeResp.data.store?.isActive;
        setStats(prev => ({ ...prev, storeRating: ratingAvg, isStoreActive }));
      }
    } catch (error) {
      console.error('Error loading merchant stats:', error);
      // don't spam alerts on dashboard
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMerchantStats();
  }, [loadMerchantStats]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadMerchantStats();
    } finally {
      setRefreshing(false);
    }
  }, [loadMerchantStats]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning!';
    if (hour < 18) return 'Good Afternoon!';
    return 'Good Evening!';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={Colors.gradients.primary as [string, string]}
          style={styles.header}
        >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.name || 'Store Owner'}</Text>
          </View>
          {/* <View style={styles.notificationIcon}>
            <Ionicons name="notifications" size={24} color={Colors.textPrimary} />
          </View> */}
        </View>
      </LinearGradient>

      {/* Stats - Horizontal Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsScroll}
        contentContainerStyle={styles.statsScrollContent}
      >
        <TouchableOpacity style={styles.statCard} activeOpacity={0.8} onPress={() => router.push('/products' as any)}>
          <View style={styles.statIcon}>
            <Ionicons name="shirt" size={24} color={Colors.primary} />
          </View>
          <Text style={styles.statNumber}>{isLoading ? '...' : stats.totalProducts}</Text>
          <Text style={styles.statLabel}>Total Products</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} activeOpacity={0.8} onPress={() => router.push('/orders' as any)}>
          <View style={styles.statIcon}>
            <Ionicons name="receipt" size={24} color={Colors.success} />
          </View>
          <Text style={styles.statNumber}>{isLoading ? '...' : stats.totalOrders}</Text>
          <Text style={styles.statLabel}>Total Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} activeOpacity={0.8} onPress={() => router.push({ pathname: '/orders', params: { status: 'Pending' } } as any)}>
          <View style={styles.statIcon}>
            <Ionicons name="time" size={24} color={Colors.warning} />
          </View>
          <Text style={styles.statNumber}>{isLoading ? '...' : stats.pendingOrders}</Text>
          <Text style={styles.statLabel}>Pending Acceptance</Text>
        </TouchableOpacity>
        {/* Removed settlements earnings card */}
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="star" size={24} color={Colors.warning} />
          </View>
          <Text style={styles.statNumber}>{isLoading ? '...' : stats.storeRating.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Store Rating</Text>
        </View>
        <TouchableOpacity style={styles.statCard} activeOpacity={0.8} onPress={() => setStoreStatusOpen(true)}>
          <View style={styles.statIcon}>
            <Ionicons name={stats.isStoreActive ? 'checkmark-circle' : 'close-circle'} size={24} color={stats.isStoreActive ? Colors.success : Colors.error} />
          </View>
          <Text style={styles.statNumber}>{stats.isStoreActive ? 'Active' : 'Inactive'}</Text>
          <Text style={styles.statLabel}>Store Status</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Revenue & Sales Analytics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Store Revenue & Performance</Text>
        
        {/* Tab Headers */}
        <View style={styles.tabHeaderContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeSectionTab === 'financials' && styles.tabButtonActive]}
            onPress={() => setActiveSectionTab('financials')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabButtonText, activeSectionTab === 'financials' && styles.tabButtonTextActive]}>Financials</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabButton, activeSectionTab === 'riderCash' && styles.tabButtonActive]}
            onPress={() => setActiveSectionTab('riderCash')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabButtonText, activeSectionTab === 'riderCash' && styles.tabButtonTextActive]}>Rider Cash</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabButton, activeSectionTab === 'products' && styles.tabButtonActive]}
            onPress={() => setActiveSectionTab('products')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabButtonText, activeSectionTab === 'products' && styles.tabButtonTextActive]}>Products</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Contents */}
        {activeSectionTab === 'financials' && (
          <View style={styles.gridContainer}>
            <View style={styles.gridCard}>
              <Text style={styles.gridLabel}>Gross Sales</Text>
              <Text style={[styles.gridValue, { color: '#2D2D2D' }]}>
                ₹{Math.round(analytics?.financials?.totalSales || 0)}
              </Text>
              <Text style={styles.gridSubtext}>From delivered orders</Text>
            </View>

            <View style={styles.gridCard}>
              <Text style={styles.gridLabel}>Net Earnings (Profit)</Text>
              <Text style={[styles.gridValue, { color: Colors.success }]}>
                ₹{Math.round(analytics?.financials?.netEarnings || 0)}
              </Text>
              <Text style={styles.gridSubtext}>Sales minus platform fee</Text>
            </View>

            <View style={styles.gridCard}>
              <Text style={styles.gridLabel}>Platform Fees Paid</Text>
              <Text style={[styles.gridValue, { color: Colors.error }]}>
                ₹{Math.round(analytics?.financials?.platformFees || 0)}
              </Text>
              <Text style={styles.gridSubtext}>Fees charged by platform</Text>
            </View>

            <View style={styles.gridCard}>
              <Text style={styles.gridValue}>
                {analytics?.financials?.totalOrders || 0}
              </Text>
              <Text style={styles.gridLabel}>Delivered Orders</Text>
              <Text style={styles.gridSubtext}>Delivered orders count</Text>
            </View>
          </View>
        )}

        {activeSectionTab === 'riderCash' && (
          <View>
            <View style={[styles.gridContainer, { marginBottom: 16 }]}>
              <View style={[styles.gridCard, { width: '48%' }]}>
                <Text style={styles.gridLabel}>Rider Cash Holding</Text>
                <Text style={[styles.gridValue, { color: '#E53935' }]}>
                  ₹{Math.round(analytics?.codSummary?.unsubmittedCodAmount || 0)}
                </Text>
                <Text style={styles.gridSubtext}>COD cash yet to reach you</Text>
              </View>
              
              <View style={[styles.gridCard, { width: '48%' }]}>
                <Text style={styles.gridLabel}>Rider Cash Handed Over</Text>
                <Text style={[styles.gridValue, { color: Colors.success }]}>
                  ₹{Math.round(analytics?.codSummary?.submittedCodAmount || 0)}
                </Text>
                <Text style={styles.gridSubtext}>COD cash submitted successfully</Text>
              </View>
            </View>

            <Text style={{ fontSize: 13, fontWeight: '700', color: '#2D2D2D', marginBottom: 8 }}>Riders Holding Cash</Text>
            {!analytics?.codSummary?.riderHoldings || analytics.codSummary.riderHoldings.length === 0 ? (
              <View style={{ padding: 16, backgroundColor: '#F9F9F9', borderRadius: 12, alignItems: 'center' }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>No riders holding cash for your store.</Text>
              </View>
            ) : (
              analytics.codSummary.riderHoldings.map((riderGroup: any) => (
                <View key={riderGroup.riderId} style={styles.riderCard}>
                  <View style={styles.riderHeader}>
                    <View>
                      <Text style={styles.riderName}>{riderGroup.riderName}</Text>
                      <Text style={styles.riderPhone}>{riderGroup.riderPhone}</Text>
                    </View>
                    <Text style={styles.riderAmount}>₹{Math.round(riderGroup.cashAmount)}</Text>
                  </View>
                  <Text style={{ fontSize: 10, color: '#6F6F6F', marginBottom: 4 }}>
                    Pending payments for: {riderGroup.payments.map((p: any) => `#${p.orderNumber}`).join(', ')}
                  </Text>
                  <TouchableOpacity
                    style={styles.verifyButton}
                    onPress={() => handleVerifyCodReceipt(riderGroup)}
                    disabled={isVerifying}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.verifyButtonText}>
                      {isVerifying ? "Verifying..." : "Confirm Cash Received"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {activeSectionTab === 'products' && (
          <View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#2D2D2D', marginBottom: 8 }}>Best Selling Products</Text>
            {!analytics?.bestSellers || analytics.bestSellers.length === 0 ? (
              <View style={{ padding: 16, backgroundColor: '#F9F9F9', borderRadius: 12, alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>No sales records found.</Text>
              </View>
            ) : (
              <View style={{ marginBottom: 16 }}>
                {analytics.bestSellers.map((item: any) => (
                  <View key={item._id} style={styles.productListItem}>
                    <View style={styles.productThumbnail}>
                      {item.product.images && item.product.images[0] ? (
                        <Image source={{ uri: item.product.images[0] }} style={{ width: 44, height: 44, borderRadius: 8 }} />
                      ) : (
                        <Ionicons name="shirt-outline" size={20} color="#9E9E9E" />
                      )}
                    </View>
                    <View style={styles.productDetails}>
                      <Text style={styles.productNameText}>{item.product.name}</Text>
                      <Text style={styles.productMetaText}>{item.product.category || 'Clothing'} • ₹{item.product.price}</Text>
                    </View>
                    <View>
                      <Text style={styles.productSalesText}>{item.totalSold} sold</Text>
                      <Text style={[styles.productMetaText, { textAlign: 'right' }]}>₹{Math.round(item.revenue)} revenue</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <Text style={{ fontSize: 13, fontWeight: '700', color: '#2D2D2D', marginBottom: 8 }}>Trending & In Demand (Last 14 Days)</Text>
            {!analytics?.trending || analytics.trending.length === 0 ? (
              <View style={{ padding: 16, backgroundColor: '#F9F9F9', borderRadius: 12, alignItems: 'center' }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>No trending items in the last 14 days.</Text>
              </View>
            ) : (
              <View>
                {analytics.trending.map((item: any) => (
                  <View key={item._id} style={styles.productListItem}>
                    <View style={styles.productThumbnail}>
                      {item.product.images && item.product.images[0] ? (
                        <Image source={{ uri: item.product.images[0] }} style={{ width: 44, height: 44, borderRadius: 8 }} />
                      ) : (
                        <Ionicons name="shirt-outline" size={20} color="#9E9E9E" />
                      )}
                    </View>
                    <View style={styles.productDetails}>
                      <Text style={styles.productNameText}>{item.product.name}</Text>
                      <Text style={styles.productMetaText}>{item.product.category || 'Clothing'} • ₹{item.product.price}</Text>
                    </View>
                    <View>
                      <Text style={styles.productSalesText}>{item.recentSold} sold recently</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/merchant/CreateProduct')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="add-circle" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.actionTitle}>Add Product</Text>
            <Text style={styles.actionSubtitle}>Add new items to your store</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/(merchantTabs)/products')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="list" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.actionTitle}>Manage Products</Text>
            <Text style={styles.actionSubtitle}>View and edit your products</Text>
          </TouchableOpacity>
          
          {/* <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => Alert.alert('Coming Soon', 'Analytics feature will be available soon!')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="analytics" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.actionTitle}>Analytics</Text>
            <Text style={styles.actionSubtitle}>View sales and performance</Text>
          </TouchableOpacity> */}
          


          {/* Removed settlements quick action */}

          {/* <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/(merchantTabs)/profile?openStore=true' as any)}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="storefront" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.actionTitle}>Store Settings</Text>
            <Text style={styles.actionSubtitle}>Manage store information</Text>
          </TouchableOpacity> */}
        </View>
      </View>

      {/* Recent Orders from API */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Orders</Text>
        <View style={styles.ordersList}>
          {recentOrders.length === 0 ? (
            <Text style={{ color: Colors.textSecondary }}>No recent orders</Text>
          ) : (
            recentOrders.map((o) => (
              <View key={o._id} style={styles.orderItem}>
                <View style={styles.orderHeader}>
                  <Text style={styles.orderNumber}>#{o.orderNumber || String(o._id).slice(-8)}</Text>
                  <View style={[
                    styles.statusBadge,
                    o.status === 'Pending' ? styles.statusBadgePending :
                    o.status === 'Accepted' ? styles.statusBadgeAccepted :
                    o.status === 'Processing' ? styles.statusBadgeProcessing :
                    o.status === 'ReadyForPickup' ? styles.statusBadgeReady :
                    o.status === 'Delivered' ? styles.statusBadgeCompleted :
                    (o.status === 'Rejected' || o.status === 'Cancelled') ? styles.statusBadgeCancelled : null
                  ]}>
                    <Text style={styles.statusText}>{o.status}</Text>
                  </View>
                </View>
                <Text style={styles.customerName}>{o.user?.name || 'Customer'}</Text>
                <Text style={styles.orderAmount}>₹{Math.round(o.totalAmount)} • {o.orderItems?.length || 0} items</Text>
                {/* Payment chip */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <View style={[styles.paymentBadge, o.paymentStatus === 'Completed' ? styles.paymentCompleted : (o.paymentStatus === 'Pending' ? styles.paymentPending : styles.paymentFailed)]}>
                    <Ionicons name={o.paymentMethod === 'Online' ? 'card' : 'cash'} size={12} color={Colors.textPrimary} />
                    <Text style={styles.paymentText}>{o.paymentMethod} • {o.paymentStatus}</Text>
                  </View>
                </View>
                <Text style={styles.orderTime}>{new Date(o.createdAt).toLocaleString()}</Text>
              </View>
            ))
          )}
        </View>
      </View>
      </ScrollView>

      {/* Store status action sheet */}
      {storeStatusOpen && (
        <View style={styles.storeStatusOverlay}>
          <TouchableOpacity style={styles.storeStatusBackdrop} activeOpacity={1} onPress={() => setStoreStatusOpen(false)} />
          <View style={styles.storeStatusSheet}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 }}>Set Store Status</Text>
            <View style={styles.storeStatusList}>
              <TouchableOpacity
                style={styles.storeStatusItem}
                onPress={async () => {
                  try {
                    await apiClient.put('/api/v1/store/update', { isActive: true });
                    setStats((prev) => ({ ...prev, isStoreActive: true }));
                  } catch {}
                  setStoreStatusOpen(false);
                }}
              >
                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                <Text style={styles.storeStatusText}>Open</Text>
              </TouchableOpacity>
              <View style={styles.storeStatusDivider} />
              <TouchableOpacity
                style={styles.storeStatusItem}
                onPress={async () => {
                  try {
                    await apiClient.put('/api/v1/store/update', { isActive: false });
                    setStats((prev) => ({ ...prev, isStoreActive: false }));
                  } catch {}
                  setStoreStatusOpen(false);
                }}
              >
                <Ionicons name="close-circle" size={20} color={Colors.error} />
                <Text style={styles.storeStatusText}>Closed</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.storeStatusCancel} onPress={() => setStoreStatusOpen(false)}>
              <Text style={{ color: Colors.primary, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  userName: {
    fontSize: 24,
    color: Colors.textPrimary,
    fontWeight: '700',
    marginTop: 4,
  },
  notificationIcon: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -20,
    gap: 12,
  },
  statsScroll: {
    paddingHorizontal: 20,
    marginTop: -20,
  },
  statsScrollContent: {
    gap: 12,
    paddingRight: 20,
  },
  statCard: {
    width: 140,
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIcon: {
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D2D2D',
    marginBottom: 12,
  },
  // Tab styles
  tabHeaderContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6F6F6F',
  },
  tabButtonTextActive: {
    color: '#2D2D2D',
  },
  // Grid styles
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6F6F6F',
    textTransform: 'uppercase',
  },
  gridValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D2D2D',
    marginTop: 4,
  },
  gridSubtext: {
    fontSize: 9,
    color: '#999999',
    marginTop: 4,
  },
  // Rider card styles
  riderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    marginBottom: 10,
  },
  riderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  riderName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2D',
  },
  riderPhone: {
    fontSize: 11,
    color: '#6F6F6F',
    marginTop: 1,
  },
  riderAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E23744',
  },
  verifyButton: {
    backgroundColor: '#28A745',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  // Product item styles
  productListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  productThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  productDetails: {
    flex: 1,
  },
  productNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2D',
  },
  productMetaText: {
    fontSize: 11,
    color: '#6F6F6F',
    marginTop: 2,
  },
  productSalesText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2D',
    textAlign: 'right',
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  ordersList: {
    gap: 12,
  },
  orderItem: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statusBadge: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgePending: { backgroundColor: Colors.warning },
  statusBadgeAccepted: { backgroundColor: Colors.success },
  statusBadgeProcessing: {
    backgroundColor: Colors.primary,
  },
  statusBadgeReady: { backgroundColor: '#9C27B0' },
  statusBadgeCompleted: {
    backgroundColor: Colors.success,
  },
  statusBadgeCancelled: { backgroundColor: Colors.error },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  orderAmount: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  orderTime: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  storeStatusSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.backgroundSecondary,
    marginRight: 8,
  },
  paymentCompleted: { backgroundColor: '#E8F5E9' },
  paymentPending: { backgroundColor: '#FFF8E1' },
  paymentFailed: { backgroundColor: '#FFEBEE' },
  paymentText: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  storeStatusOverlay: {
    ...StyleSheet.absoluteFillObject as any,
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  storeStatusBackdrop: {
    ...StyleSheet.absoluteFillObject as any,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  storeStatusList: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storeStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  storeStatusText: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  storeStatusDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  storeStatusCancel: {
    alignSelf: 'flex-end',
    marginTop: 10,
  },
});
