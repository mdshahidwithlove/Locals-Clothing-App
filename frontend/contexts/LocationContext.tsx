import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { Alert } from 'react-native';

export interface LocationData {
  latitude: number;
  longitude: number;
  landmark?: string;
  street?: string;
  city: string;
  state: string;
  country: string;
  pincode?: string;
  formattedAddress: string;
}

interface LocationContextType {
  currentLocation: LocationData | null;
  selectedCity: string;
  isLoading: boolean;
  hasPermission: boolean;
  getCurrentLocation: () => Promise<LocationData | null>;
  setSelectedCity: (city: string) => void;
  requestLocationPermission: () => Promise<boolean>;
  reverseGeocode: (latitude: number, longitude: number) => Promise<LocationData | null>;
  saveLocationData: (locationData: LocationData) => Promise<void>;
  loadStoredLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

interface LocationProviderProps {
  children: ReactNode;
}

const LOCATION_STORAGE_KEY = 'userLocationData';
const CITY_STORAGE_KEY = 'selectedCity';

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [selectedCity, setSelectedCityState] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  // Load stored location data on app start
  const loadStoredLocation = useCallback(async () => {
    try {
      const storedLocation = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
      const storedCity = await AsyncStorage.getItem(CITY_STORAGE_KEY);
      
      if (storedLocation) {
        const locationData = JSON.parse(storedLocation);
        setCurrentLocation(locationData);
        console.log('📍 Loaded stored location:', locationData);
      }
      
      if (storedCity) {
        setSelectedCityState(storedCity);
        console.log('🏙️ Loaded stored city:', storedCity);
      }
    } catch (error) {
      console.error('Error loading stored location:', error);
    }
  }, []);

  useEffect(() => {
    loadStoredLocation();
  }, [loadStoredLocation]);

  // Request location permission
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const hasPermission = status === 'granted';
      setHasPermission(hasPermission);
      
      if (!hasPermission) {
        // Location permission denied - user can still use the app
        console.log('Location permission denied');
      }
      
      return hasPermission;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }, []);

  // Reverse geocoding function
  const reverseGeocode = useCallback(async (latitude: number, longitude: number): Promise<LocationData | null> => {
    try {
      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (addresses.length > 0) {
        const address = addresses[0];
        
        // Extract components
        const landmark = address.name || address.street || '';
        const street = address.street || address.district || '';
        const city = address.city || address.subregion || 'Unknown City';
        const state = address.region || 'Unknown State';
        const country = address.country || 'Unknown Country';
        const pincode = address.postalCode || '';

        // Create formatted address
        const addressParts = [];
        if (landmark) addressParts.push(landmark);
        if (street && street !== landmark) addressParts.push(street);
        addressParts.push(city, state);
        if (pincode) addressParts.push(pincode);
        addressParts.push(country);
        
        const formattedAddress = addressParts.join(', ');

        const locationData: LocationData = {
          latitude,
          longitude,
          landmark,
          street,
          city,
          state,
          country,
          pincode,
          formattedAddress,
        };

        return locationData;
      }
      
      return null;
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return null;
    }
  }, []);

  // Save location data to storage
  const saveLocationData = useCallback(async (locationData: LocationData) => {
    try {
      await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locationData));
      console.log('💾 Location data saved to storage');
    } catch (error) {
      console.error('Error saving location data:', error);
    }
  }, []);

  // Get current location
  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    try {
      setIsLoading(true);

      // Check permission first
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        return null;
      }

      // Try to get last known location first (extremely fast)
      let location = await Location.getLastKnownPositionAsync();

      if (!location) {
        // Fallback to getCurrentPositionAsync with a lower accuracy (balanced) to speed it up
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      const { latitude, longitude } = location.coords;
      
      // Reverse geocode to get address
      const locationData = await reverseGeocode(latitude, longitude);
      
      if (locationData) {
        setCurrentLocation(locationData);
        await saveLocationData(locationData);
        console.log('📍 Current location obtained:', locationData);
      }

      return locationData;
    } catch (error) {
      console.error('Error getting current location:', error);
      // Location error - user can still use the app
      console.log('Location error - unable to get current location');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [requestLocationPermission, reverseGeocode, saveLocationData]);

  // Set selected city
  const setSelectedCity = useCallback(async (city: string) => {
    try {
      setSelectedCityState(city);
      await AsyncStorage.setItem(CITY_STORAGE_KEY, city);
      console.log('🏙️ Selected city updated:', city);
    } catch (error) {
      console.error('Error saving selected city:', error);
    }
  }, []);

  const value: LocationContextType = {
    currentLocation,
    selectedCity,
    isLoading,
    hasPermission,
    getCurrentLocation,
    setSelectedCity,
    requestLocationPermission,
    reverseGeocode,
    saveLocationData,
    loadStoredLocation,
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};
