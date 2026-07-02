import { getConfig } from "../services/configService";

/**
 * Location utilities for extracting coordinates from map links and geocoding addresses
 */

/**
 * Extract coordinates from Google Maps link
 * Supports various Google Maps URL formats:
 * - https://maps.google.com/?q=-33.8688,151.2093
 * - https://maps.app.goo.gl/xxx
 * - https://www.google.com/maps/@-33.8688,151.2093,15z
 * - https://www.google.com/maps/place/.../@-33.8688,151.2093
 * - https://goo.gl/maps/xxx
 */
export function extractCoordinatesFromMapLink(mapLink: string): { lat: number; lng: number } | null {
  if (!mapLink || typeof mapLink !== 'string') {
    return null;
  }

  try {
    // Pattern 1: ?q=lat,lng or &q=lat,lng
    const qPattern = /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const qMatch = mapLink.match(qPattern);
    if (qMatch) {
      return {
        lat: parseFloat(qMatch[1]!),
        lng: parseFloat(qMatch[2]!)
      };
    }

    // Pattern 2: @lat,lng,zoom format
    const atPattern = /@(-?\d+\.?\d*),(-?\d+\.?\d*),/;
    const atMatch = mapLink.match(atPattern);
    if (atMatch) {
      return {
        lat: parseFloat(atMatch[1]!),
        lng: parseFloat(atMatch[2]!)
      };
    }

    // Pattern 3: /place/.../@lat,lng
    const placePattern = /\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const placeMatch = mapLink.match(placePattern);
    if (placeMatch) {
      return {
        lat: parseFloat(placeMatch[1]!),
        lng: parseFloat(placeMatch[2]!)
      };
    }

    // Pattern 4: ll=lat,lng
    const llPattern = /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const llMatch = mapLink.match(llPattern);
    if (llMatch) {
      return {
        lat: parseFloat(llMatch[1]!),
        lng: parseFloat(llMatch[2]!)
      };
    }

    return null;
  } catch (error) {
    console.error('Error extracting coordinates from map link:', error);
    return null;
  }
}

/**
 * Geocode address to coordinates using Google Geocoding API
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address || typeof address !== 'string' || address.trim().length === 0) {
    return null;
  }

  const apiKey = getConfig("GOOGLE_MAPS_API_KEY");
  
  if (!apiKey) {
    console.warn('Google Maps API key not configured. Geocoding disabled.');
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data: any = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng
      };
    } else {
      console.log(`Geocoding failed for address: ${address}. Status: ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
}

/**
 * Get store location from store data
 * Tries to extract from mapLink first, then falls back to geocoding address
 */
export async function getStoreLocation(store: { address: string; mapLink: string }): Promise<{ lat: number; lng: number; address: string } | null> {
  // Try to extract from map link first
  if (store.mapLink) {
    const coords = extractCoordinatesFromMapLink(store.mapLink);
    if (coords) {
      return {
        ...coords,
        address: store.address
      };
    }
  }

  // Fall back to geocoding the address
  if (store.address) {
    const coords = await geocodeAddress(store.address);
    if (coords) {
      return {
        ...coords,
        address: store.address
      };
    }
  }

  // If both methods fail, return null
  // The system should still work with text addresses only
  return null;
}

/**
 * Get delivery location from shipping address
 * Tries to geocode the address
 */
export async function getDeliveryLocation(shippingAddress: string): Promise<{ lat: number; lng: number; address: string } | null> {
  if (!shippingAddress || typeof shippingAddress !== 'string') {
    return null;
  }

  const coords = await geocodeAddress(shippingAddress);
  if (coords) {
    return {
      ...coords,
      address: shippingAddress
    };
  }

  // Return null if geocoding fails
  // The system should still work with text addresses only
  return null;
}

/**
 * Validate coordinates
 */
export function isValidCoordinates(coords: any): boolean {
  if (!coords || typeof coords !== 'object') {
    return false;
  }

  const { lat, lng } = coords;
  
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return false;
  }

  // Check if coordinates are within valid ranges
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return false;
  }

  // Check if coordinates are not zero (unless actually at 0,0)
  if (lat === 0 && lng === 0) {
    return false;
  }

  return true;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
