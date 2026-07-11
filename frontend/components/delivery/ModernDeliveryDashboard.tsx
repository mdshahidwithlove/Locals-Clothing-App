import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import apiClient from '@/api/client';
import { useOnlineStatus } from '@/contexts/OnlineStatusContext';

const formatINR = (value: number) => Math.round(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const ModernDeliveryDashboard: React.FC = () => {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string>('active');
  const router = useRouter();
  
  const { isOnline, isTracking, toggleOnlineStatus } = useOnlineStatus();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [deliveriesResponse, statsResponse] = await Promise.all([
        apiClient.get('/api/v1/delivery'),
        apiClient.get('/api/v1/delivery/stats/overview'),
      ]);
      
      if (deliveriesResponse.data.success) {
        setDeliveries(deliveriesResponse.data.deliveries || []);
      }
      
      if (statsResponse.data.success) {
        setStats(statsResponse.data.stats);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const getActiveDeliveries = () => {
    return deliveries.filter(d => ['Pending', 'Accepted', 'PickedUp', 'OnTheWay'].includes(d.status));
  };

  const getCompletedDeliveries = () => {
    return deliveries.filter(d => d.status === 'Delivered');
  };

  const currentDeliveries = selectedTab === 'active' ? getActiveDeliveries() : getCompletedDeliveries();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pending': return 'time-outline';
      case 'Accepted': return 'checkmark-circle-outline';
      case 'PickedUp': return 'cube-outline';
      case 'OnTheWay': return 'rocket-outline';
      case 'Delivered': return 'checkmark-done-circle';
      default: return 'alert-circle-outline';
    }
  };

  const getStatusGradient = (status: string): [string, string] => {
    switch (status) {
      case 'Pending': return ['#FF9800', '#F57C00'];
      case 'Accepted': return ['#4CAF50', '#388E3C'];
      case 'PickedUp': return ['#2196F3', '#1976D2'];
      case 'OnTheWay': return ['#9C27B0', '#7B1FA2'];
      case 'Delivered': return ['#4CAF50', '#2E7D32'];
      default: return ['#9E9E9E', '#757575'];
    }
  };

  if (loading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your deliveries...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Modern Header with Gradient */}
      <LinearGradient
        colors={['#FFD700', '#FFC107']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Hello, Partner! 👋</Text>
            <Text style={styles.headerSubtitle}>Ready to deliver today?</Text>
          </View>
          
          {/* Online/Offline Toggle */}
          <TouchableOpacity
            style={[styles.trackingBadge, isOnline && styles.trackingBadgeActive]}
            onPress={toggleOnlineStatus}
            activeOpacity={0.8}
          >
            <View style={[styles.toggleDot, isOnline && styles.toggleDotActive]} />
            <Text style={[styles.trackingText, isOnline && styles.trackingTextActive]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            {isTracking && (
              <View style={styles.pulseIndicator}>
                <View style={styles.pulseRing} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statMiniCard}>
            <Text style={styles.statMiniValue}>{stats?.totalDeliveries || 0}</Text>
            <Text style={styles.statMiniLabel}>Total</Text>
          </View>
          <View style={styles.statMiniCard}>
            <Text style={styles.statMiniValue}>{getActiveDeliveries().length}</Text>
            <Text style={styles.statMiniLabel}>Active</Text>
          </View>
          <View style={styles.statMiniCard}>
            <Text style={styles.statMiniValue}>₹{Math.round(stats?.totalEarnings || 0)}</Text>
            <Text style={styles.statMiniLabel}>Earned</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'active' && styles.tabActive]}
          onPress={() => setSelectedTab('active')}
        >
          <Text style={[styles.tabText, selectedTab === 'active' && styles.tabTextActive]}>
            Active ({getActiveDeliveries().length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'completed' && styles.tabActive]}
          onPress={() => setSelectedTab('completed')}
        >
          <Text style={[styles.tabText, selectedTab === 'completed' && styles.tabTextActive]}>
            Completed ({getCompletedDeliveries().length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Deliveries List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FFD700']} tintColor='#FFD700' />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Settlement Summary */}
        {stats && (
          <View style={styles.settlementCard}>
            <Text style={styles.settlementTitle}>Settlement & Cash Summary</Text>
            <View style={styles.settlementRow}>
              <Text style={styles.settlementLabel}>Total Earnings (Delivery Fees)</Text>
              <Text style={styles.settlementValue}>₹{Math.round(stats.totalEarnings || 0)}</Text>
            </View>
            <View style={styles.settlementRow}>
              <Text style={styles.settlementLabel}>COD Cash In Hand (Unsubmitted)</Text>
              <Text style={[styles.settlementValue, { color: '#E53935' }]}>₹{Math.round(stats.cashInHand || 0)}</Text>
            </View>
            <View style={[styles.settlementRow, styles.settlementTotalRow]}>
              <Text style={styles.settlementTotalLabel}>Net Balance Owed to Us</Text>
              <Text style={[styles.settlementTotalValue, { color: '#E53935' }]}>₹{Math.round(stats.netOwed || 0)}</Text>
            </View>
          </View>
        )}
        {currentDeliveries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons 
                name={selectedTab === 'active' ? "bicycle-outline" : "checkmark-done-circle-outline"} 
                size={80} 
                color="#E0E0E0" 
              />
            </View>
            <Text style={styles.emptyTitle}>
              {selectedTab === 'active' ? 'No Active Deliveries' : 'No Completed Deliveries Yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {selectedTab === 'active' 
                ? 'New deliveries will appear here when assigned'
                : 'Your completed deliveries will show up here'
              }
            </Text>
          </View>
        ) : (
          currentDeliveries.map((delivery, index) => {
            const order = typeof delivery.order === 'object' ? delivery.order : null;
            const statusGradient = getStatusGradient(delivery.status);
            
            return (
              <TouchableOpacity
                key={delivery._id}
                style={[styles.deliveryCard, { marginTop: index === 0 ? 0 : 16 }]}
                onPress={() => {
                  router.push({
                    pathname: '/(deliveryTabs)/order-details',
                    params: { deliveryId: delivery._id }
                  } as any);
                }}
                activeOpacity={0.95}
              >
                <LinearGradient
                  colors={['#FFFFFF', '#F8F9FA']}
                  style={styles.cardGradient}
                >
                  {/* Status Banner */}
                  <LinearGradient
                    colors={statusGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.statusBanner}
                  >
                    <Ionicons name={getStatusIcon(delivery.status)} size={18} color="#FFFFFF" />
                    <Text style={styles.statusBannerText}>
                      {delivery.deliveryType === 'RETURN'
                        ? (delivery.status === 'Delivered' ? 'Delivered to Merchant' : delivery.status === 'PickedUp' ? 'Picked Up' : ['Pending', 'Accepted'].includes(delivery.status) ? 'Assigned' : delivery.status)
                        : delivery.status}
                    </Text>
                  </LinearGradient>

                  {/* Order Info */}
                  <View style={styles.cardContent}>
                    <View style={styles.orderHeader}>
                      <View style={styles.orderIdContainer}>
                        <Ionicons name="receipt-outline" size={20} color="#667eea" />
                        <Text style={styles.orderId}>
                          #{order?.orderNumber || delivery._id.slice(-8)}
                        </Text>
                      </View>
                      {delivery.deliveryType === 'RETURN' && (
                        <View style={[styles.codBadge, { backgroundColor: '#E3F2FD' }]}>
                          <Ionicons name="return-down-back" size={14} color="#1976D2" />
                          <Text style={[styles.codBadgeText, { color: '#1976D2' }]}>RETURN</Text>
                        </View>
                      )}
                      {order?.paymentMethod === 'COD' && delivery.deliveryType !== 'RETURN' && (
                        <View style={styles.codBadge}>
                          <Ionicons name="cash" size={14} color="#FF9800" />
                          <Text style={styles.codBadgeText}>COD</Text>
                        </View>
                      )}
                    </View>

                    {/* Addresses */}
                    <View style={styles.addressesContainer}>
                      <View style={styles.addressRow}>
                        <View style={styles.addressIcon}>
                          <Ionicons name={delivery.deliveryType === 'RETURN' ? 'home' : 'storefront'} size={16} color="#4CAF50" />
                        </View>
                        <Text style={styles.addressText} numberOfLines={1}>
                          {delivery.pickupAddress}
                        </Text>
                      </View>
                      
                      <View style={styles.routeLine} />
                      
                      <View style={styles.addressRow}>
                        <View style={styles.addressIcon}>
                          <Ionicons name={delivery.deliveryType === 'RETURN' ? 'storefront' : 'location'} size={16} color="#F44336" />
                        </View>
                        <Text style={styles.addressText} numberOfLines={1}>
                          {delivery.deliveryAddress}
                        </Text>
                      </View>
                    </View>

                    {/* Action */}
                    <View style={styles.cardFooter}>
                      <TouchableOpacity 
                        style={styles.viewButton}
                        onPress={() => {
                          router.push({
                            pathname: '/(deliveryTabs)/order-details',
                            params: { deliveryId: delivery._id }
                          } as any);
                        }}
                      >
                        <Text style={styles.viewButtonText}>View Details</Text>
                        <Ionicons name="arrow-forward" size={16} color="#667eea" />
                      </TouchableOpacity>
                    </View>

                    {/* COD Amount if applicable */}
                    {order?.paymentMethod === 'COD' && order?.paymentStatus !== 'Completed' && (
                      <View style={styles.codAlert}>
                        <Ionicons name="alert-circle" size={16} color="#FF9800" />
                        <Text style={styles.codAlertText}>
                          Collect ₹{formatINR(order.totalAmount)} on delivery
                        </Text>
                      </View>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 8,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2D2D2D',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#2D2D2D',
    marginTop: 4,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  trackingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
    borderWidth: 2,
    borderColor: '#2D2D2D',
  },
  trackingBadgeActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  toggleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF5252',
  },
  toggleDotActive: {
    backgroundColor: '#FFFFFF',
  },
  pulseIndicator: {
    position: 'absolute',
    left: 8,
    top: 8,
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    opacity: 0.6,
  },
  trackingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D2D2D',
  },
  trackingTextActive: {
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statMiniCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  statMiniValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D2D2D',
    marginBottom: 4,
  },
  statMiniLabel: {
    fontSize: 11,
    color: '#6F6F6F',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: '#667eea',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
  deliveryCard: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardGradient: {
    padding: 0,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardContent: {
    padding: 16,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  codBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  codBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF9800',
  },
  addressesContainer: {
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addressIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E0E0E0',
    marginLeft: 15,
    marginVertical: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountContainer: {
    gap: 4,
  },
  amountLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4CAF50',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  codAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  codAlertText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#F57C00',
  },
  settlementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  settlementTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  settlementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  settlementLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  settlementValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  settlementTotalRow: {
    borderBottomWidth: 0,
    paddingTop: 12,
    paddingBottom: 2,
  },
  settlementTotalLabel: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '700',
  },
  settlementTotalValue: {
    fontSize: 16,
    fontWeight: '800',
  },
});

export default ModernDeliveryDashboard;

