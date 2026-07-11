import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Animated, Alert, TextInput } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useLocation } from '@/contexts/LocationContext';
import * as Location from 'expo-location';

interface LocationPickerScreenProps {
  initialRegion?: Region; // ignored: we always start from the user's current location
  title?: string;
  onClose: () => void;
  onConfirm: (params: { latitude: number; longitude: number; formattedAddress: string }) => void;
}

const LocationPickerScreen: React.FC<LocationPickerScreenProps> = ({ 
  initialRegion, 
  onClose, 
  onConfirm 
}) => {
  const { getCurrentLocation, reverseGeocode, currentLocation } = useLocation();
  const [region, setRegion] = useState<Region | null>(null);
  const [address, setAddress] = useState<string>('');
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);
  
  const mapRef = useRef<MapView>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  
  // Pulsing animation for precise point
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Start pulsing animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Always start from user current location
        let lat = currentLocation?.latitude;
        let lng = currentLocation?.longitude;
        if (lat == null || lng == null) {
          const loc = await getCurrentLocation();
          lat = loc?.latitude;
          lng = loc?.longitude;
        }
        if (lat != null && lng != null) {
          const next: Region = {
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
          setRegion(next);
          setIsGeocoding(true);
          const addr = await reverseGeocode(next.latitude, next.longitude);
          setAddress(addr?.formattedAddress || '');
        }
      } finally {
        setIsBootstrapping(false);
        setIsGeocoding(false);
      }
    };
    bootstrap();
  }, [currentLocation, getCurrentLocation, reverseGeocode]);

  const onRegionChangeComplete = async (next: Region) => {
    setRegion(next);
    setIsGeocoding(true);
    try {
      const addr = await reverseGeocode(next.latitude, next.longitude);
      setAddress(addr?.formattedAddress || '');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await Location.geocodeAsync(searchQuery);
      if (results.length > 0) {
        const { latitude, longitude } = results[0];
        const nextRegion: Region = {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setRegion(nextRegion);
        mapRef.current?.animateToRegion(nextRegion, 1000);
        
        setIsGeocoding(true);
        const addr = await reverseGeocode(latitude, longitude);
        setAddress(addr?.formattedAddress || searchQuery || '');
      } else {
        Alert.alert('Location Not Found', 'Could not find the location you searched for. Please try a different query.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      Alert.alert('Search Error', 'Failed to search for location. Please check your internet connection.');
    } finally {
      setIsGeocoding(false);
      setIsSearching(false);
    }
  };

  const handleConfirm = () => {
    if (!address || !region) return;
    onConfirm({ 
      latitude: region.latitude, 
      longitude: region.longitude, 
      formattedAddress: address 
    });
  };

  return (
    <View style={styles.container}>
      {/* Integrated Back Button & Search Bar at the top */}
      <View style={styles.searchContainer}>
        <TouchableOpacity 
          onPress={onClose}
          style={styles.backButtonInline}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for area, street, or landmark..."
          placeholderTextColor={Colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleSearch} style={styles.searchButton} disabled={isSearching}>
          {isSearching ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="search" size={20} color={Colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {isBootstrapping ? (
        <View style={styles.center}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        </View>
      ) : !region ? (
        <View style={styles.center}>
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>Enable location services to pick a place</Text>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={region}
            onRegionChangeComplete={onRegionChangeComplete}
            zoomControlEnabled={Platform.OS === 'android'}
            showsUserLocation={true}
            showsMyLocationButton={false}
          />
          
          {/* Center Pin - Sharp and Precise */}
          <View pointerEvents="none" style={styles.centerPinContainer}>
            <Ionicons name="location-sharp" size={56} color={Colors.primary} />
            {/* Precise Point Indicator with Pulse Animation */}
            <Animated.View 
              style={[
                styles.precisePoint,
                {
                  transform: [{ scale: pulseAnim }]
                }
              ]} 
            />
          </View>

          {/* Drag Instruction Card */}
          {!isGeocoding && (
            <View style={styles.instructionCard}>
              <View style={styles.instructionInner}>
                <Ionicons name="move" size={18} color={Colors.primary} />
                <Text style={styles.instructionText}>Drag map to adjust pin</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Enhanced Bottom Address Card */}
      <View style={styles.bottomCard}>
        <View style={styles.dragIndicator} />
        
        <View style={styles.addressSection}>
          <View style={styles.addressHeader}>
            <View style={styles.addressIconCircle}>
              <Ionicons 
                name={isGeocoding ? "sync" : "location"} 
                size={20} 
                color={Colors.primary} 
              />
            </View>
            <Text style={styles.addressLabel}>
              {isGeocoding ? 'Detecting address...' : 'Selected Location'}
            </Text>
          </View>

          <View style={styles.addressContent}>
            {isGeocoding ? (
              <View style={styles.geocodingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.geocodingText}>Fetching address details...</Text>
              </View>
            ) : (
              <View style={styles.addressTextContainer}>
                <Ionicons name="pin" size={16} color={Colors.textSecondary} />
                <Text style={styles.addressText} numberOfLines={3}>
                  {address || 'Move the map to select a location'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.confirmButton, 
              (!address || isGeocoding) && styles.confirmButtonDisabled
            ]}
            onPress={handleConfirm}
            disabled={!address || isGeocoding}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={20} color={Colors.textPrimary} />
            <Text style={styles.confirmText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 54,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backButtonInline: {
    padding: 4,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
    marginHorizontal: 4,
  },
  searchButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingBackButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 16,
    left: 16,
    zIndex: 20,
    padding: 4,
  },
  floatingBackCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingCard: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  centerPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -28, // Half of icon size (56/2)
    marginTop: -56, // Full icon size for sharp bottom point
    alignItems: 'center',
  },
  precisePoint: {
    position: 'absolute',
    bottom: 0,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 5,
  },
  instructionCard: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 80,
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.backgroundSecondary,
    padding: 0,
  },
  instructionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  instructionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  bottomCard: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  addressSection: {
    marginBottom: 20,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressContent: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 80,
  },
  geocodingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
  },
  geocodingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  addressTextContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  addressText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});

export default LocationPickerScreen;