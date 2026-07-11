import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { useOnlineStatus } from '@/contexts/OnlineStatusContext';
import apiClient from '@/api/client';
import { useRouter } from 'expo-router';

export default function DeliveryHome() {
  const { user } = useAuth();
  const router = useRouter();
  const { isOnline, isTracking, toggleOnlineStatus } = useOnlineStatus();
  
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    averageRating: 0,
    totalEarnings: 0,
    deliveredDeliveries: 0,
    activeDeliveries: 0,
  } as any);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentDeliveries, setRecentDeliveries] = useState<any[]>([]);

  const loadDeliveryStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/api/v1/delivery/stats/overview');
      if (response.data.success) {
        setStats(response.data.stats);
      }
      const recentsResp = await apiClient.get('/api/v1/delivery', { params: { page: 1, limit: 5 } });
      if (recentsResp.data?.success) {
        setRecentDeliveries(recentsResp.data.deliveries || []);
      }
    } catch (error) {
      console.error('Error loading delivery stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeliveryStats();
  }, [loadDeliveryStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDeliveryStats();
    } finally {
      setRefreshing(false);
    }
  }, [loadDeliveryStats]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FFD700']} tintColor='#FFD700' />
      }
    >
      {/* Header with Online Toggle */}
      <LinearGradient
        colors={['#FFD700', '#FFC107']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()} 👋</Text>
            <Text style={styles.userName}>{user?.name || 'Delivery Partner'}</Text>
          </View>
          
          {/* Online/Offline Toggle */}
          <TouchableOpacity
            style={[styles.onlineToggle, isOnline && styles.onlineToggleActive]}
            onPress={toggleOnlineStatus}
            activeOpacity={0.8}
          >
            <View style={[styles.toggleDot, isOnline && styles.toggleDotActive]} />
            <Text style={[styles.toggleText, isOnline && styles.toggleTextActive]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            {isTracking && (
              <View style={styles.pulseIndicator}>
                <View style={styles.pulseRing} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <TouchableOpacity style={styles.statCard} activeOpacity={0.8} onPress={() => router.push('/(deliveryTabs)/delivery' as any)}>
          <LinearGradient
            colors={['#4CAF50', '#388E3C']}
            style={styles.statGradient}
          >
            <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
            <View style={styles.statContent}>
              <Text style={styles.statNumber}>{isLoading ? '...' : (stats.completed || 0)}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.statCard} activeOpacity={0.8} onPress={() => router.push('/(deliveryTabs)/delivery' as any)}>
          <LinearGradient
            colors={['#2196F3', '#1976D2']}
            style={styles.statGradient}
          >
            <Ionicons name="bicycle" size={24} color="#FFFFFF" />
            <View style={styles.statContent}>
              <Text style={styles.statNumber}>{isLoading ? '...' : (stats.pending || 0)}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard} activeOpacity={0.8}>
          <LinearGradient
            colors={['#FF9800', '#F57C00']}
            style={styles.statGradient}
          >
            <Ionicons name="wallet" size={24} color="#FFFFFF" />
            <View style={styles.statContent}>
              <Text style={styles.statNumber}>{isLoading ? '...' : `₹${Math.round(stats.totalEarnings || 0)}`}</Text>
              <Text style={styles.statLabel}>Earned</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsContainerColumn}>
          <TouchableOpacity 
            style={styles.actionCardFull}
            onPress={() => router.push('/(deliveryTabs)/delivery' as any)}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="bicycle" size={28} color="#FFD700" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Toggle Online</Text>
              <Text style={styles.actionSubtitle}>Start/stop accepting orders</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionCardFull}
            onPress={() => router.push('/(deliveryTabs)/delivery' as any)}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="list" size={28} color="#FFD700" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>View Orders</Text>
              <Text style={styles.actionSubtitle}>Check pending deliveries</Text>
            </View>
          </TouchableOpacity>
          
          {/* Removed Earnings quick action */}
        </View>
      </View>

      {/* Settlement Summary Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settlement & Cash Summary</Text>
        <View style={styles.settlementCard}>
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
          <Text style={styles.settlementNotice}>
            * Submit collected COD cash to stores or admin portal to clear your pending balances.
          </Text>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityList}>
          {isLoading && recentDeliveries.length === 0 ? (
            <View style={styles.loadingCard}>
              <Text style={styles.loadingText}>Loading activities...</Text>
            </View>
          ) : recentDeliveries.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="cube-outline" size={48} color="#E0E0E0" />
              <Text style={styles.emptyText}>No recent deliveries</Text>
              <Text style={styles.emptySubtext}>Your completed orders will appear here</Text>
            </View>
          ) : (
            recentDeliveries.slice(0, 5).map((d) => (
              <TouchableOpacity
                key={d._id}
                style={styles.activityItem}
                onPress={() => router.push({ pathname: '/(deliveryTabs)/order-details', params: { deliveryId: d._id } } as any)}
                activeOpacity={0.7}
              >
                <View style={styles.activityIcon}>
                  <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>
                    Order #{d.order?.orderNumber || String(d.order?._id || '').slice(-8)}
                  </Text>
                  <Text style={styles.activityTime} numberOfLines={1}>
                    {d.order?.store?.storeName || 'Store'} ➔ {d.order?.shippingAddress ? (d.order.shippingAddress.split(',')[0] || '').slice(0, 18) : 'Customer'}
                  </Text>
                  <Text style={styles.activityTime}>
                    {new Date(d.createdAt).toLocaleDateString()} • {new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.activityAmount}>
                  +₹{Math.round(d.deliveryFee || 0)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    color: '#2D2D2D',
    fontWeight: '500',
  },
  userName: {
    fontSize: 26,
    color: '#2D2D2D',
    fontWeight: '700',
    marginTop: 6,
  },
  onlineToggle: {
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
  onlineToggleActive: {
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
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D2D2D',
  },
  toggleTextActive: {
    color: '#FFFFFF',
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
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  statGradient: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statContent: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  actionsContainer: {
    gap: 12,
  },
  actionsContainerColumn: {
    gap: 12,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  actionCardFull: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#757575',
    fontWeight: '500',
  },
  activityList: {
    gap: 12,
    marginBottom: 24,
  },
  activityItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#9E9E9E',
    fontWeight: '500',
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#424242',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9E9E9E',
    marginTop: 6,
    textAlign: 'center',
  },
  settlementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  settlementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  settlementLabel: {
    fontSize: 14,
    color: '#616161',
    fontWeight: '500',
  },
  settlementValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  settlementTotalRow: {
    borderBottomWidth: 0,
    paddingTop: 14,
    paddingBottom: 4,
  },
  settlementTotalLabel: {
    fontSize: 15,
    color: '#212121',
    fontWeight: '700',
  },
  settlementTotalValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  settlementNotice: {
    fontSize: 11,
    color: '#9E9E9E',
    marginTop: 10,
    fontStyle: 'italic',
    lineHeight: 14,
  },
});
