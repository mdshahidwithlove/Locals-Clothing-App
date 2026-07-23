import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, RefreshControl, Alert, Image, Modal, TextInput, ActivityIndicator } from 'react-native';
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
  const [activeSectionTab, setActiveSectionTab] = useState<'financials' | 'products' | 'settlements'>('financials');
  
  // Withdrawal states
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'UPI' | 'BankTransfer'>('UPI');
  const [upiId, setUpiId] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [withdrawalHistory, setWithdrawalHistory] = useState<any[]>([]);
  const [merchantReturns, setMerchantReturns] = useState<any[]>([]);

  const handleApproveReturn = async (returnId: string) => {
    try {
      const res = await apiClient.post(`/api/v1/returns/${returnId}/approve`);
      if (res.data?.success) {
        Alert.alert('Success', 'Return request approved! Delivery partner assigned for pickup.');
        loadMerchantStats();
      }
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to approve return');
    }
  };

  const handleRejectReturn = async (returnId: string) => {
    try {
      const res = await apiClient.post(`/api/v1/returns/${returnId}/reject`);
      if (res.data?.success) {
        Alert.alert('Success', 'Return request rejected.');
        loadMerchantStats();
      }
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to reject return');
    }
  };

  const handleCompleteRefund = async (returnId: string) => {
    try {
      const res = await apiClient.post(`/api/v1/returns/${returnId}/complete-refund`);
      if (res.data?.success) {
        Alert.alert('Success', 'Refund marked as completed.');
        loadMerchantStats();
      }
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to complete refund');
    }
  };

  const handleRequestWithdrawal = async () => {
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) {
      Alert.alert("Error", "Please enter a valid amount.");
      return;
    }
    
    const maxWithdrawable = Math.abs(Math.round(analytics?.financials?.netBalance || 0));
    if (amt > maxWithdrawable) {
      Alert.alert("Error", `Cannot request more than available balance (₹${maxWithdrawable}).`);
      return;
    }
    
    if (withdrawMethod === 'UPI' && !upiId.trim()) {
      Alert.alert("Error", "Please enter your UPI ID.");
      return;
    }
    
    if (withdrawMethod === 'BankTransfer') {
      if (!bankName.trim() || !accountNumber.trim() || !ifscCode.trim() || !accountHolderName.trim()) {
        Alert.alert("Error", "Please fill in all bank details.");
        return;
      }
    }

    try {
      setIsSubmittingWithdraw(true);
      const paymentDetails = withdrawMethod === 'UPI' 
        ? { method: 'UPI', upiId: upiId.trim() }
        : { 
            method: 'BankTransfer', 
            bankName: bankName.trim(), 
            accountNumber: accountNumber.trim(), 
            ifscCode: ifscCode.trim(), 
            accountHolderName: accountHolderName.trim() 
          };

      const res = await apiClient.post('/api/v1/withdrawals/request', {
        amount: amt,
        paymentDetails
      });

      if (res.data?.success) {
        Alert.alert("Success", "Withdrawal request submitted successfully!");
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        loadMerchantStats();
      }
    } catch (error: any) {
      console.error('Error requesting withdrawal:', error);
      Alert.alert("Error", error?.response?.data?.message || error.message || "Failed to request withdrawal.");
    } finally {
      setIsSubmittingWithdraw(false);
    }
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

      // Load withdrawal history
      try {
        const res = await apiClient.get('/api/v1/withdrawals/history');
        if (res.data?.success) {
          setWithdrawalHistory(res.data.history || []);
        }
      } catch (error) {
        console.error('Error loading withdrawal history:', error);
      }

      // Load merchant return requests
      try {
        const returnsResp = await apiClient.get('/api/v1/returns/merchant');
        if (returnsResp.data?.success) {
          setMerchantReturns(returnsResp.data.returns || []);
        }
      } catch (error) {
        console.error('Error loading merchant returns:', error);
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

      {/* HIGHLIGHTED TOP ALERT BANNER FOR CUSTOMER RETURN REQUESTS */}
      {merchantReturns.length > 0 && (
        <TouchableOpacity
          style={{ marginHorizontal: 16, marginTop: 12, borderRadius: 16, overflow: 'hidden', elevation: 6, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
          activeOpacity={0.95}
          onPress={() => router.push({ pathname: '/orders', params: { status: 'Returns' } } as any)}
        >
          <LinearGradient
            colors={['#FF416C', '#FF4B2B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ padding: 16 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="alert-circle" size={24} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFF' }}>
                  🚨 RETURN REQUEST RECEIVED ({merchantReturns.filter(r => r.status === 'Pending').length} Pending)
                </Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>
                  A customer has requested a return. Tap to review & respond.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#FFF" />
            </View>

            {merchantReturns.filter(r => r.status === 'Pending').slice(0, 2).map((item: any) => (
              <View key={item._id} style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: 12, marginTop: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>Order #{item.order?.orderNumber || item.order?._id?.substring(0, 8)}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#EF4444' }}>₹{Math.round(item.order?.totalAmount || 0)}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 4 }}>👤 Customer: {item.customer?.name} ({item.customer?.phone || 'No phone'})</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626', marginTop: 2 }}>⚠️ Reason: {item.reason}</Text>
                {item.notes ? <Text style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic', marginTop: 2 }}>Notes: "{item.notes}"</Text> : null}
                {item.refundUpiId ? <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB', marginTop: 2 }}>UPI ID: {item.refundUpiId}</Text> : null}
                
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#10B981', paddingVertical: 8, borderRadius: 8 }}
                    onPress={() => handleApproveReturn(item._id)}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                    <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>Approve Return</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EF4444', paddingVertical: 8, borderRadius: 8 }}
                    onPress={() => handleRejectReturn(item._id)}
                  >
                    <Ionicons name="close-circle" size={16} color="#FFF" />
                    <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </LinearGradient>
        </TouchableOpacity>
      )}

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
        <TouchableOpacity style={styles.statCard} activeOpacity={0.8} onPress={() => router.push({ pathname: '/orders', params: { status: 'Returns' } } as any)}>
          <View style={styles.statIcon}>
            <Ionicons name="refresh-circle" size={24} color={Colors.error} />
          </View>
          <Text style={styles.statNumber}>{isLoading ? '...' : merchantReturns.length}</Text>
          <Text style={styles.statLabel}>Return Requests</Text>
        </TouchableOpacity>
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
            style={[styles.tabButton, activeSectionTab === 'products' && styles.tabButtonActive]}
            onPress={() => setActiveSectionTab('products')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabButtonText, activeSectionTab === 'products' && styles.tabButtonTextActive]}>Products</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, activeSectionTab === 'settlements' && styles.tabButtonActive]}
            onPress={() => setActiveSectionTab('settlements')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabButtonText, activeSectionTab === 'settlements' && styles.tabButtonTextActive]}>Payouts</Text>
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

        {activeSectionTab === 'settlements' && (
          <View>
            {/* Balance Banner */}
            <View style={[
              styles.balanceBanner,
              (analytics?.financials?.netBalance || 0) < 0
                ? { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' }
                : (analytics?.financials?.netBalance || 0) > 0
                  ? { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' }
                  : { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' }
            ]}>
              <Ionicons 
                name={(analytics?.financials?.netBalance || 0) < 0 ? "wallet-outline" : "alert-circle-outline"} 
                size={22} 
                color={(analytics?.financials?.netBalance || 0) < 0 ? '#2E7D32' : (analytics?.financials?.netBalance || 0) > 0 ? '#C62828' : '#757575'} 
              />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <Text style={styles.balanceTitle}>Outstanding Account Balance</Text>
                <Text style={[
                  styles.balanceValue,
                  { color: (analytics?.financials?.netBalance || 0) < 0 ? '#2E7D32' : (analytics?.financials?.netBalance || 0) > 0 ? '#C62828' : '#212121' }
                ]}>
                  {(analytics?.financials?.netBalance || 0) < 0 
                    ? `Platform owes you: ₹${Math.abs(Math.round(analytics.financials.netBalance))}`
                    : (analytics?.financials?.netBalance || 0) > 0
                      ? `You owe Platform: ₹${Math.round(analytics.financials.netBalance)}`
                      : 'Fully Settled (₹0)'
                  }
                </Text>
              </View>
            </View>

            {/* Request Withdrawal Button */}
            {(analytics?.financials?.netBalance || 0) < 0 && (
              <TouchableOpacity 
                style={styles.withdrawButton} 
                onPress={() => setShowWithdrawModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="cash-outline" size={18} color="#000000" style={{ marginRight: 6 }} />
                <Text style={styles.withdrawButtonText}>Request Withdrawal</Text>
              </TouchableOpacity>
            )}

            {/* Payout Totals */}
            <View style={[styles.gridContainer, { marginBottom: 16 }]}>
              <View style={[styles.gridCard, { width: '48%' }]}>
                <Text style={styles.gridLabel}>Platform Payouts</Text>
                <Text style={[styles.gridValue, { color: '#2E7D32' }]}>
                  ₹{Math.round(analytics?.settlementSummary?.totalPayouts || 0)}
                </Text>
                <Text style={styles.gridSubtext}>UPI / bank settlements paid to you</Text>
              </View>
              
              <View style={[styles.gridCard, { width: '48%' }]}>
                <Text style={styles.gridLabel}>Cash Collected</Text>
                <Text style={[styles.gridValue, { color: '#C62828' }]}>
                  ₹{Math.round(analytics?.settlementSummary?.totalCollections || 0)}
                </Text>
                <Text style={styles.gridSubtext}>Commissions/Cash collected from you</Text>
              </View>
            </View>

            {/* Settlements Ledger */}
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#2D2D2D', marginBottom: 8 }}>Settlement History Log</Text>
            {!analytics?.settlementSummary?.recentSettlements || analytics.settlementSummary.recentSettlements.length === 0 ? (
              <View style={{ padding: 16, backgroundColor: '#F9F9F9', borderRadius: 12, alignItems: 'center' }}>
                <Text style={{ color: '#6F6F6F', fontSize: 13 }}>No past settlement transactions found.</Text>
              </View>
            ) : (
              analytics.settlementSummary.recentSettlements.map((tx: any) => (
                <View key={tx._id} style={styles.ledgerCard}>
                  <View style={styles.ledgerHeader}>
                    <View>
                      <Text style={styles.ledgerType}>
                        {tx.type === 'Payout' ? 'Platform Paid You' : 'Collected from Store'}
                      </Text>
                      <Text style={styles.ledgerDate}>
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </Text>
                    </View>
                    <Text style={[
                      styles.ledgerAmount,
                      { color: tx.type === 'Payout' ? '#2E7D32' : '#C62828' }
                    ]}>
                      {tx.type === 'Payout' ? '+' : '-'}₹{Math.round(tx.amount)}
                    </Text>
                  </View>
                  {tx.transactionReference && (
                    <Text style={styles.ledgerRef}>Ref: {tx.transactionReference} ({tx.paymentMethod})</Text>
                  )}
                  {tx.notes && (
                    <Text style={styles.ledgerNotes}>Note: {tx.notes}</Text>
                  )}
                </View>
              ))
            )}

            {/* Withdrawal Requests Log */}
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#2D2D2D', marginTop: 16, marginBottom: 8 }}>Withdrawal Requests</Text>
            {withdrawalHistory.length === 0 ? (
              <View style={{ padding: 16, backgroundColor: '#F9F9F9', borderRadius: 12, alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ color: '#6F6F6F', fontSize: 13 }}>No past withdrawal requests found.</Text>
              </View>
            ) : (
              withdrawalHistory.map((tx: any) => (
                <View key={tx._id} style={[styles.ledgerCard, { marginBottom: 12 }]}>
                  <View style={styles.ledgerHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.ledgerType}>
                        {tx.paymentDetails.method === 'UPI' ? `Withdrawal to UPI (${tx.paymentDetails.upiId})` : `Withdrawal to Bank (${tx.paymentDetails.bankName})`}
                      </Text>
                      <Text style={styles.ledgerDate}>
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.ledgerAmount, { color: '#C62828', marginBottom: 4 }]}>
                        -₹{Math.round(tx.amount)}
                      </Text>
                      <View style={[
                        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
                        tx.status === 'Approved' ? { backgroundColor: '#E8F5E9' } : tx.status === 'Rejected' ? { backgroundColor: '#FFEBEE' } : { backgroundColor: '#FFF9C4' }
                      ]}>
                        <Text style={[
                          { fontSize: 10, fontWeight: '700' },
                          tx.status === 'Approved' ? { color: '#2E7D32' } : tx.status === 'Rejected' ? { color: '#C62828' } : { color: '#F57F17' }
                        ]}>
                          {tx.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {tx.statusNotes && (
                    <Text style={styles.ledgerNotes}>Note: {tx.statusNotes}</Text>
                  )}
                </View>
              ))
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

      {/* Withdrawal Request Modal */}
      <Modal
        visible={showWithdrawModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request Payout / Withdrawal</Text>
            
            <Text style={styles.inputLabel}>Available Balance: ₹{Math.abs(Math.round(analytics?.financials?.netBalance || 0))}</Text>
            
            <Text style={styles.inputLabel}>Amount to Withdraw (₹)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter amount"
              keyboardType="numeric"
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
            />

            <Text style={styles.inputLabel}>Payout Method</Text>
            <View style={styles.methodContainer}>
              <TouchableOpacity
                style={[styles.methodButton, withdrawMethod === 'UPI' && styles.methodButtonActive]}
                onPress={() => setWithdrawMethod('UPI')}
              >
                <Text style={[styles.methodButtonText, withdrawMethod === 'UPI' && styles.methodButtonTextActive]}>UPI</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.methodButton, withdrawMethod === 'BankTransfer' && styles.methodButtonActive]}
                onPress={() => setWithdrawMethod('BankTransfer')}
              >
                <Text style={[styles.methodButtonText, withdrawMethod === 'BankTransfer' && styles.methodButtonTextActive]}>Bank Transfer</Text>
              </TouchableOpacity>
            </View>

            {withdrawMethod === 'UPI' ? (
              <View>
                <Text style={styles.inputLabel}>UPI ID</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. name@upi"
                  autoCapitalize="none"
                  value={upiId}
                  onChangeText={setUpiId}
                />
              </View>
            ) : (
              <View>
                <Text style={styles.inputLabel}>Account Holder Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Full Name"
                  value={accountHolderName}
                  onChangeText={setAccountHolderName}
                />
                
                <Text style={styles.inputLabel}>Bank Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Bank Name"
                  value={bankName}
                  onChangeText={setBankName}
                />

                <Text style={styles.inputLabel}>Account Number</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Account Number"
                  keyboardType="numeric"
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                />

                <Text style={styles.inputLabel}>IFSC Code</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="IFSC Code"
                  autoCapitalize="characters"
                  value={ifscCode}
                  onChangeText={setIfscCode}
                />
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowWithdrawModal(false)}
                disabled={isSubmittingWithdraw}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalSubmitButton}
                onPress={handleRequestWithdrawal}
                disabled={isSubmittingWithdraw}
              >
                <Text style={styles.modalSubmitButtonText}>
                  {isSubmittingWithdraw ? 'Submitting...' : 'Submit Request'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  balanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  balanceTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6F6F6F',
    textTransform: 'uppercase',
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  ledgerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    marginBottom: 8,
  },
  ledgerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ledgerType: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2D',
  },
  ledgerDate: {
    fontSize: 10,
    color: '#999999',
    marginTop: 2,
  },
  ledgerAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  ledgerRef: {
    fontSize: 10,
    color: '#6F6F6F',
    marginTop: 6,
  },
  ledgerNotes: {
    fontSize: 11,
    color: '#757575',
    fontStyle: 'italic',
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 4,
  },
  withdrawButton: {
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  withdrawButtonText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#212121',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6F6F6F',
    marginBottom: 4,
    marginTop: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#212121',
    backgroundColor: '#F9F9F9',
  },
  methodContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    marginTop: 6,
  },
  methodButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
  },
  methodButtonActive: {
    borderColor: '#FFD700',
    backgroundColor: '#FFFDE7',
  },
  methodButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6F6F6F',
  },
  methodButtonTextActive: {
    color: '#FFC107',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6F6F6F',
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: '#FFD700',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSubmitButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  returnHighlightBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#FFF5F5',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    padding: 14,
    elevation: 3,
  },
  returnHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
    paddingBottom: 8,
  },
  returnTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991B1B',
  },
  returnBadgeCount: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  returnBadgeCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  returnCardItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  returnOrderNum: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  returnStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  returnStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  returnCustomerText: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 4,
  },
  returnReasonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 2,
  },
  returnNotesText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 2,
  },
  returnAmountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  returnActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  returnActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
  },
  returnActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
