import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, UrlTile } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Colors } from '@/constants/colors';
import NavigationMarker from './markers/NavigationMarker';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

interface LocationCoords {
  latitude: number;
  longitude: number;
}

const NavigationMapScreen: React.FC = () => {
  const params = useLocalSearchParams();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const hasCalculatedRoute = useRef(false);

  // Parse locations from params - useMemo to keep stable references
  const pickupLocation = React.useMemo(() => 
    params.pickupLocation ? JSON.parse(params.pickupLocation as string) : null,
    [params.pickupLocation]
  );
  
  const deliveryLocation = React.useMemo(() =>
    params.deliveryLocation ? JSON.parse(params.deliveryLocation as string) : null,
    [params.deliveryLocation]
  );
  
  const navigationType = params.navigationType as string; // 'pickup' or 'delivery'
  const orderId = params.orderId as string; // Get orderId for back navigation

  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null);
  const [loading, setLoading] = useState(true);
  const [followUser, setFollowUser] = useState(true);
  const [routeCoordinates, setRouteCoordinates] = useState<LocationCoords[]>([]);
  const [distance, setDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [geocodedPickup, setGeocodedPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [geocodedDelivery, setGeocodedDelivery] = useState<{ lat: number; lng: number } | null>(null);
  const previousNavigationType = useRef<string | null>(null);
  const [currentRegion, setCurrentRegion] = useState({
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
  });

  // Extract coordinates from Google Maps link
  const extractCoordinatesFromMapLink = (mapLink: string): { lat: number; lng: number } | null => {
    try {
      // Pattern 1: @lat,lng format
      const atMatch = mapLink.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (atMatch) {
        return {
          lat: parseFloat(atMatch[1]),
          lng: parseFloat(atMatch[2])
        };
      }

      // Pattern 2: ll=lat,lng format
      const llMatch = mapLink.match(/ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (llMatch) {
        return {
          lat: parseFloat(llMatch[1]),
          lng: parseFloat(llMatch[2])
        };
      }

      // Pattern 3: q=lat,lng format
      const qMatch = mapLink.match(/q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (qMatch) {
        return {
          lat: parseFloat(qMatch[1]),
          lng: parseFloat(qMatch[2])
        };
      }

      // Pattern 4: /dir/.../lat,lng
      const dirMatch = mapLink.match(/\/dir\/[^\/]+\/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (dirMatch) {
        return {
          lat: parseFloat(dirMatch[1]),
          lng: parseFloat(dirMatch[2])
        };
      }

      return null;
    } catch (error) {
      console.error('Error extracting coordinates from map link:', error);
      return null;
    }
  };

  // Geocode an address to get coordinates
  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      console.log('Geocoding address:', address);
      const apiClient = (await import('@/api/client')).default;
      
      // Call backend geocoding endpoint
      const response = await apiClient.post('/api/v1/geocode', { address });
      
      if (response.data.success && response.data.data) {
        const { lat, lng } = response.data.data;
        console.log('Geocoded successfully:', { lat, lng });
        return { lat, lng };
      }
      
      console.log('Geocoding failed');
      return null;
    } catch (error) {
      console.error('Error geocoding address:', error);
      return null;
    }
  };

  // Get user's current location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required for navigation');
          router.back();
          return;
        }

        // Get current location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        // Watch location updates
        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 10,
          },
          (newLocation) => {
            setCurrentLocation({
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
            });
          }
        );

        setLoading(false);
      } catch (error) {
        console.error('Error getting location:', error);
        Alert.alert('Error', 'Failed to get your location');
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Decode Google Maps polyline to coordinates
  const decodePolyline = (encoded: string): LocationCoords[] => {
    const points: LocationCoords[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  };

  // Calculate distance helper - pure function (fallback)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of Earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  };

  // Fetch route from backend API
  const fetchDirections = async (origin: LocationCoords, destination: LocationCoords): Promise<LocationCoords[] | null> => {
    try {
      setLoadingRoute(true);
      
      const originStr = `${origin.latitude},${origin.longitude}`;
      const destStr = `${destination.latitude},${destination.longitude}`;
      
      const apiClient = (await import('@/api/client')).default;
      const response = await apiClient.get('/api/v1/directions', {
        params: {
          origin: originStr,
          destination: destStr
        }
      });

      if (response.data.success && response.data.data) {
        const { polyline, distance: distData, duration: durData } = response.data.data;
        
        console.log('Directions API success:', {
          distance: distData.text,
          duration: durData.text,
          polylineLength: polyline.length
        });
        
        // Decode polyline to get route coordinates
        const routePoints = decodePolyline(polyline);
        
        console.log('Decoded route points:', routePoints.length);
        
        setRouteCoordinates(routePoints);
        setDistance(distData.value / 1000); // Convert meters to km
        setDuration(durData.value / 60); // Convert seconds to minutes
        
        return routePoints;
      }
      
      console.log('Directions API failed or no data');
      return null;
    } catch (error) {
      console.error('Error fetching directions:', error);
      return null;
    } finally {
      setLoadingRoute(false);
    }
  };

  // Extract coordinates from mapLink or geocode addresses
  useEffect(() => {
    if (!pickupLocation || !deliveryLocation) return;
    
    (async () => {
      // Get pickup coordinates - ALWAYS try mapLink first for stores (more accurate)
      let pickupCoords: { lat: number; lng: number } | null = null;
      
      // Try extracting from mapLink first (for stores)
      if ((pickupLocation as any).mapLink) {
        console.log('Extracting coordinates from pickup mapLink...');
        let mapLink = (pickupLocation as any).mapLink;
        if (mapLink.includes('maps.app.goo.gl') || mapLink.includes('goo.gl/maps')) {
          try {
            console.log('Resolving short URL on client:', mapLink);
            const res = await fetch(mapLink, { method: 'GET', redirect: 'follow' });
            if (res.url) {
              mapLink = res.url;
              console.log('Resolved short URL to:', mapLink);
            }
          } catch (e) {
            console.warn('Failed to resolve short URL on client:', e);
          }
        }
        pickupCoords = extractCoordinatesFromMapLink(mapLink);
        console.log('Extracted from mapLink:', pickupCoords);
      }
      
      // If no mapLink or extraction failed, try geocoding the address
      if (!pickupCoords && pickupLocation.address && !pickupLocation.lat) {
        console.log('Geocoding pickup address...');
        pickupCoords = await geocodeAddress(pickupLocation.address);
      }
      
      if (pickupCoords) {
        setGeocodedPickup(pickupCoords);
        // Reset route calculation if this is the active navigation type
        if (navigationType === 'pickup') {
          console.log('Pickup coordinates obtained, resetting route calculation');
          hasCalculatedRoute.current = false;
        }
      }
      
      // Get delivery coordinates - geocode address if needed
      if (deliveryLocation.address && !deliveryLocation.lat) {
        console.log('Geocoding delivery address...');
        const deliveryCoords = await geocodeAddress(deliveryLocation.address);
        if (deliveryCoords) {
          setGeocodedDelivery(deliveryCoords);
          // Reset route calculation if this is the active navigation type
          if (navigationType === 'delivery') {
            console.log('Delivery coordinates obtained, resetting route calculation');
            hasCalculatedRoute.current = false;
          }
        }
      }
    })();
  }, [pickupLocation, deliveryLocation, navigationType]);

  // Reset route calculation when navigation type changes
  useEffect(() => {
    if (previousNavigationType.current !== null && previousNavigationType.current !== navigationType) {
      console.log('Navigation type changed from', previousNavigationType.current, 'to', navigationType);
      console.log('Resetting route calculation...');
      hasCalculatedRoute.current = false;
      setRouteCoordinates([]);
      setDistance(0);
      setDuration(0);
    }
    previousNavigationType.current = navigationType;
  }, [navigationType]);

  // Calculate route - run only once when location is first available
  useEffect(() => {
    if (!currentLocation || loading || hasCalculatedRoute.current) {
      return;
    }

    const destination = navigationType === 'pickup' 
      ? pickupLocation 
      : deliveryLocation;

    console.log('Route calculation for', navigationType);
    console.log('Destination object:', destination);

    if (!destination) {
      console.log('No destination available');
      return;
    }

    // Get coordinates - PRIORITIZE geocoded coordinates (from mapLink or geocoding)
    const geocoded = navigationType === 'pickup' ? geocodedPickup : geocodedDelivery;
    
    console.log('Geocoded coordinates:', geocoded);
    console.log('Original coordinates:', { lat: destination.lat, lng: destination.lng });
    
    let destLat = geocoded?.lat || destination.lat;
    let destLng = geocoded?.lng || destination.lng;
    
    if (!destLat || !destLng) {
      // Still no coordinates available, can't calculate route yet
      console.log('❌ No coordinates available yet for', navigationType);
      return;
    }
    
    console.log('✅ Using coordinates for', navigationType, ':', { lat: destLat, lng: destLng });

    const destCoords = {
      latitude: destLat,
      longitude: destLng,
    };

    // Fetch real route from backend
    (async () => {
      console.log('🚀 Fetching directions from', currentLocation, 'to', destCoords);
      console.log('📍 Navigation type:', navigationType);
      
      const routePoints = await fetchDirections(currentLocation, destCoords);
      
      let finalRoute: LocationCoords[];
      
      if (routePoints && routePoints.length > 0) {
        // Successfully got route from API
        console.log('Using Google Directions route with', routePoints.length, 'points');
        finalRoute = routePoints;
      } else {
        // Fallback to straight line if API fails
        console.log('Using fallback straight line route');
        const route = [currentLocation, destCoords];
        
        const dist = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          destCoords.latitude,
          destCoords.longitude
        );
        
        const estimatedDuration = (dist / 30) * 60;
        
        setRouteCoordinates(route);
        setDistance(dist);
        setDuration(estimatedDuration);
        
        finalRoute = route;
      }
      
      // Mark as calculated
      hasCalculatedRoute.current = true;

      // Fit map to show the complete route
      setTimeout(() => {
        if (mapRef.current && finalRoute.length > 0) {
          console.log('Fitting map to', finalRoute.length, 'coordinates');
          mapRef.current.fitToCoordinates(finalRoute, {
            edgePadding: { top: 120, right: 60, bottom: 300, left: 60 },
            animated: true,
          });
        }
      }, 1000);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation, loading, pickupLocation, deliveryLocation, navigationType, geocodedPickup, geocodedDelivery]);

  const handleBack = () => {
    if (orderId) {
      router.push({
        pathname: '/(deliveryTabs)/order-details',
        params: { deliveryId: orderId }
      } as any);
    } else {
      router.back();
    }
  };

  const centerOnUser = () => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          ...currentLocation,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01 * ASPECT_RATIO,
        },
        1000
      );
      setFollowUser(true);
    }
  };

  const zoomIn = async () => {
    if (mapRef.current) {
      const camera = await mapRef.current.getCamera();
      if (camera) {
        const newLatDelta = currentRegion.latitudeDelta * 0.5;
        const newLngDelta = currentRegion.longitudeDelta * 0.5;
        
        setCurrentRegion({
          latitudeDelta: newLatDelta,
          longitudeDelta: newLngDelta,
        });

        mapRef.current.animateToRegion(
          {
            latitude: camera.center.latitude,
            longitude: camera.center.longitude,
            latitudeDelta: newLatDelta,
            longitudeDelta: newLngDelta,
          },
          300
        );
      }
    }
  };

  const zoomOut = async () => {
    if (mapRef.current) {
      const camera = await mapRef.current.getCamera();
      if (camera) {
        const newLatDelta = currentRegion.latitudeDelta * 2;
        const newLngDelta = currentRegion.longitudeDelta * 2;
        
        // Limit max zoom out
        if (newLatDelta < 0.5) {
          setCurrentRegion({
            latitudeDelta: newLatDelta,
            longitudeDelta: newLngDelta,
          });

          mapRef.current.animateToRegion(
            {
              latitude: camera.center.latitude,
              longitude: camera.center.longitude,
              latitudeDelta: newLatDelta,
              longitudeDelta: newLngDelta,
            },
            300
          );
        }
      }
    }
  };

  if (loading || !currentLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>
          {loadingRoute ? 'Loading route...' : 'Loading navigation...'}
        </Text>
      </View>
    );
  }

  const destination = navigationType === 'pickup' ? pickupLocation : deliveryLocation;

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={{
          ...currentLocation,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        showsTraffic={false}
        showsBuildings={false}
        showsIndoors={false}
        followsUserLocation={followUser}
        onPanDrag={() => setFollowUser(false)}
        onRegionChangeComplete={(region) => {
          setCurrentRegion({
            latitudeDelta: region.latitudeDelta,
            longitudeDelta: region.longitudeDelta,
          });
        }}
        mapType="standard"
      >
        {/* Current Location Marker */}
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <NavigationMarker type="current" size={20} />
          </Marker>
        )}

        {/* Pickup Location Marker */}
        {pickupLocation && navigationType === 'pickup' && (pickupLocation.lat || geocodedPickup) && (
          <Marker
            coordinate={{ 
              latitude: pickupLocation.lat || geocodedPickup?.lat || 0, 
              longitude: pickupLocation.lng || geocodedPickup?.lng || 0 
            }}
            title="Pickup Location"
            description={pickupLocation.address}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <NavigationMarker type="pickup" size={20} />
          </Marker>
        )}

        {/* Delivery Location Marker */}
        {deliveryLocation && navigationType === 'delivery' && (deliveryLocation.lat || geocodedDelivery) && (
          <Marker
            coordinate={{ 
              latitude: deliveryLocation.lat || geocodedDelivery?.lat || 0, 
              longitude: deliveryLocation.lng || geocodedDelivery?.lng || 0 
            }}
            title="Delivery Location"
            description={deliveryLocation.address}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <NavigationMarker type="delivery" size={20} />
          </Marker>
        )}

        {/* Route Polyline */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#FFD700"
            strokeWidth={5}
            lineJoin="round"
            lineCap="round"
          />
        )}
      </MapView>

      {/* Top Header */}
      <LinearGradient
        colors={['rgba(0,0,0,0.7)', 'transparent']}
        style={styles.topGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {navigationType === 'pickup' ? 'Navigate to Pickup' : 'Navigate to Delivery'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {destination?.address || 'Destination'}
            </Text>
          </View>
          <View style={styles.headerRight} />
        </View>
      </LinearGradient>

      {/* Navigation Info Card */}
      {(distance > 0 || loadingRoute) && (
        <View style={styles.navInfoCard}>
          <LinearGradient
            colors={[Colors.primary, '#667eea']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.navInfoGradient}
          >
            {loadingRoute ? (
              <View style={styles.navInfoContent}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={[styles.navInfoLabel, { marginLeft: 10 }]}>
                  Calculating route...
                </Text>
              </View>
            ) : (
              <View style={styles.navInfoContent}>
                <View style={styles.navInfoItem}>
                  <Ionicons name="navigate" size={28} color="#FFFFFF" />
                  <View style={styles.navInfoTextContainer}>
                    <Text style={styles.navInfoValue}>{distance.toFixed(2)} km</Text>
                    <Text style={styles.navInfoLabel}>Distance</Text>
                  </View>
                </View>
                <View style={styles.navInfoDivider} />
                <View style={styles.navInfoItem}>
                  <Ionicons name="time" size={28} color="#FFFFFF" />
                  <View style={styles.navInfoTextContainer}>
                    <Text style={styles.navInfoValue}>{Math.round(duration)} min</Text>
                    <Text style={styles.navInfoLabel}>ETA</Text>
                  </View>
                </View>
              </View>
            )}
          </LinearGradient>
        </View>
      )}

      {/* Map Controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity style={styles.mapControlButton} onPress={centerOnUser}>
          <Ionicons name="locate" size={24} color={followUser ? Colors.primary : Colors.textSecondary} />
        </TouchableOpacity>
        
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomButton} onPress={zoomIn}>
            <Ionicons name="add" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity style={styles.zoomButton} onPress={zoomOut}>
            <Ionicons name="remove" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Address Info Card - Show when coordinates not available */}
      {!destination?.lat || !destination?.lng ? (
        <View style={styles.addressInfoCard}>
          <View style={styles.addressInfoContent}>
            <Ionicons name="information-circle" size={24} color="#FF9800" />
            <View style={styles.addressInfoText}>
              <Text style={styles.addressInfoTitle}>Navigation to Address</Text>
              <Text style={styles.addressInfoDescription}>
                Coordinates not available. Using address: {destination?.address}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  navInfoCard: {
    position: 'absolute',
    top: 140,
    left: 20,
    right: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  navInfoGradient: {
    padding: 20,
  },
  navInfoContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navInfoTextContainer: {
    alignItems: 'flex-start',
  },
  navInfoValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navInfoLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  navInfoDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  mapControls: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    gap: 12,
  },
  mapControlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  zoomControls: {
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  zoomButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  addressInfoCard: {
    position: 'absolute',
    top: 140,
    left: 20,
    right: 20,
    backgroundColor: '#FFF3E0',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  addressInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addressInfoText: {
    flex: 1,
  },
  addressInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 4,
  },
  addressInfoDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
});

export default NavigationMapScreen;
