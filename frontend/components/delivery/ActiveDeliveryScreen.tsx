import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import apiClient from '@/api/client';

interface ActiveDeliveryScreenProps {
  delivery: any;
  onClose: () => void;
  onRefresh: () => void;
}

const formatINR = (value: number) => Math.round(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const ActiveDeliveryScreen: React.FC<ActiveDeliveryScreenProps> = ({ delivery, onClose, onRefresh }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [mapRegion, setMapRegion] = useState<any>(null);
  
  const {
    currentLocation,
    isTracking,
    startTracking,
    stopTracking,
    error: locationError
  } = useLocationTracking({ enableTracking: true });

  const order = typeof delivery.order === 'object' ? delivery.order : null;

  // Set initial map region based on pickup and delivery locations
  useEffect(() => {
    if (delivery.pickupAddress && delivery.deliveryAddress) {
      // For simplicity, center on pickup location
      // In production, you'd geocode addresses or use stored coordinates
      setMapRegion({
        latitude: 28.6139, // Default to Delhi coordinates - replace with actual
        longitude: 77.2090,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  }, [delivery]);

  // Update status handler
  const handleUpdateStatus = async (newStatus: string) => {
    try {
      setIsUpdating(true);
      await apiClient.put(`/api/v1/delivery/${delivery._id}/status`, {
        status: newStatus
      });
      Alert.alert('Success', `Delivery status updated to ${newStatus}`);
      onRefresh();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  // COD collection handler
  const handleCollectCOD = async () => {
    try {
      const orderId = order && (typeof order === 'object' ? order._id : order);
      if (!orderId) {
        throw new Error('Order not found');
      }

      setIsUpdating(true);
      await apiClient.post(`/api/v1/cod/${orderId}/collect`);
      Alert.alert('Success', 'COD amount collected successfully!');
      onRefresh();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to collect COD');
    } finally {
      setIsUpdating(false);
    }
  };

  // Open navigation app
  const openNavigation = (address: string, lat?: number, lng?: number) => {
    const destination = lat && lng 
      ? `${lat},${lng}` 
      : encodeURIComponent(address);

    let url = '';
    if (Platform.OS === 'ios') {
      url = `maps://app?daddr=${destination}`;
    } else {
      url = `google.navigation:q=${destination}`;
    }

    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Fallback to browser-based Google Maps
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
        Linking.openURL(webUrl);
      }
    });
  };

  // Get next action button based on status
  const getNextAction = () => {
    switch (delivery.status) {
      case 'Pending':
        return (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleUpdateStatus('Accepted')}
            disabled={isUpdating}
          >
            <LinearGradient colors={['#4CAF50', '#45A049']} style={styles.actionGradient}>
              <Ionicons name="checkmark" size={24} color="#FFFFFF" />
              <Text style={styles.actionText}>Accept Delivery</Text>
            </LinearGradient>
          </TouchableOpacity>
        );
      
      case 'Accepted':
        return (
          <>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => openNavigation(delivery.pickupAddress)}
            >
              <Ionicons name="navigate-circle" size={24} color={Colors.primary} />
              <Text style={styles.navigationButtonText}>Navigate to Pickup</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleUpdateStatus('PickedUp')}
              disabled={isUpdating}
            >
              <LinearGradient colors={['#2196F3', '#1976D2']} style={styles.actionGradient}>
                <Ionicons name="cube" size={24} color="#FFFFFF" />
                <Text style={styles.actionText}>Mark Picked Up</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        );
      
      case 'PickedUp':
        return (
          <>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => openNavigation(delivery.deliveryAddress)}
            >
              <Ionicons name="navigate-circle" size={24} color={Colors.primary} />
              <Text style={styles.navigationButtonText}>Navigate to Delivery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleUpdateStatus('OnTheWay')}
              disabled={isUpdating}
            >
              <LinearGradient colors={['#9C27B0', '#7B1FA2']} style={styles.actionGradient}>
                <Ionicons name="navigate" size={24} color="#FFFFFF" />
                <Text style={styles.actionText}>Mark On The Way</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        );
      
      case 'OnTheWay':
        return (
          <>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => openNavigation(delivery.deliveryAddress)}
            >
              <Ionicons name="navigate-circle" size={24} color={Colors.primary} />
              <Text style={styles.navigationButtonText}>Continue Navigation</Text>
            </TouchableOpacity>
            {order && order.paymentMethod === 'COD' && order.paymentStatus !== 'Completed' ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleCollectCOD}
                disabled={isUpdating}
              >
                <LinearGradient colors={['#FFA500', '#FF8C00']} style={styles.actionGradient}>
                  <Ionicons name="cash" size={24} color="#FFFFFF" />
                  <Text style={styles.actionText}>Collect ₹{formatINR(order.totalAmount)}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleUpdateStatus('Delivered')}
                disabled={isUpdating}
              >
                <LinearGradient colors={['#4CAF50', '#45A049']} style={styles.actionGradient}>
                  <Ionicons name="checkmark-done" size={24} color="#FFFFFF" />
                  <Text style={styles.actionText}>Mark Delivered</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        );
      
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={Colors.gradients.primary as [string, string]} style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Active Delivery</Text>
          <Text style={styles.headerSubtitle}>
            Delivery #{delivery._id.slice(-8)}
          </Text>
        </View>
        <View style={styles.locationIndicator}>
          {isTracking ? (
            <>
              <Ionicons name="location" size={20} color="#4CAF50" />
              <Text style={styles.trackingText}>Tracking</Text>
            </>
          ) : (
            <TouchableOpacity onPress={startTracking}>
              <Ionicons name="location-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Map View */}
        {mapRegion && (
          <View style={styles.mapContainer}>
            <MapView
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              style={styles.map}
              initialRegion={mapRegion}
              showsUserLocation
              showsMyLocationButton
              followsUserLocation
            >
              {/* Current location marker */}
              {currentLocation && (
                <Marker
                  coordinate={{
                    latitude: currentLocation.lat,
                    longitude: currentLocation.lng,
                  }}
                  title="Your Location"
                  pinColor={Colors.primary}
                />
              )}
            </MapView>
          </View>
        )}

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusLabel}>Current Status</Text>
            <View style={[styles.statusBadge, { 
              backgroundColor: delivery.status === 'OnTheWay' ? '#9C27B0' : 
                              delivery.status === 'PickedUp' ? '#2196F3' : 
                              delivery.status === 'Accepted' ? '#4CAF50' : '#FFA500' 
            }]}>
              <Text style={styles.statusText}>{delivery.status}</Text>
            </View>
          </View>
        </View>

        {/* Delivery Info */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          
          <View style={styles.addressSection}>
            <Ionicons name="storefront" size={20} color={Colors.primary} />
            <View style={styles.addressContent}>
              <Text style={styles.addressLabel}>Pickup Location</Text>
              <Text style={styles.addressText}>{delivery.pickupAddress}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.addressSection}>
            <Ionicons name="location" size={20} color={Colors.error} />
            <View style={styles.addressContent}>
              <Text style={styles.addressLabel}>Delivery Location</Text>
              <Text style={styles.addressText}>{delivery.deliveryAddress}</Text>
            </View>
          </View>

          {order && (
            <>
              <View style={styles.divider} />
              <View style={styles.paymentInfo}>
                <Text style={styles.infoLabel}>Payment Method:</Text>
                <Text style={[styles.infoValue, { 
                  color: order.paymentMethod === 'COD' ? Colors.warning : Colors.success 
                }]}>
                  {order.paymentMethod}
                </Text>
              </View>
              {order.paymentMethod === 'COD' && (
                <View style={styles.paymentInfo}>
                  <Text style={styles.infoLabel}>Amount to Collect:</Text>
                  <Text style={[styles.infoValue, { fontSize: 20, fontWeight: '700' }]}>
                    ₹{formatINR(order.totalAmount)}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {isUpdating ? (
            <ActivityIndicator size="large" color={Colors.primary} />
          ) : (
            getNextAction()
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerContent: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  locationIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trackingText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  mapContainer: {
    height: 300,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  map: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  infoCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  addressSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  addressContent: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  paymentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  actionsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  navigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
    gap: 8,
  },
  navigationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default ActiveDeliveryScreen;

