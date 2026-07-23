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

    // Pattern 5: /dir/.../lat,lng
    const dirPattern = /\/dir\/[^\/]+\/(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const dirMatch = mapLink.match(dirPattern);
    if (dirMatch) {
      return {
        lat: parseFloat(dirMatch[1]!),
        lng: parseFloat(dirMatch[2]!)
      };
    }

    // Pattern 6: Any raw string containing decimal lat,lng (e.g. 30.209718, 74.936572)
    const rawPattern = /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/;
    const rawMatch = mapLink.match(rawPattern);
    if (rawMatch) {
      return {
        lat: parseFloat(rawMatch[1]!),
        lng: parseFloat(rawMatch[2]!)
      };
    }

    return null;
  } catch (error) {
    console.error('Error extracting coordinates from map link:', error);
    return null;
  }
}

/**
 * Geocode address to coordinates using Google Geocoding API with OpenStreetMap Nominatim fallback
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address || typeof address !== 'string' || address.trim().length === 0) {
    return null;
  }

  // 1. Try Google Maps API if key is present
  const apiKey = getConfig("GOOGLE_MAPS_API_KEY");
  if (apiKey) {
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
      }
    } catch (error) {
      console.error('Error using Google geocoding:', error);
    }
  }

  // 2. Free Fallback: OpenStreetMap Nominatim
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LocalsClothingApp/1.0 (contact@localsclothing.app)'
      }
    });
    const data: any = await response.json();
    if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
  } catch (error) {
    console.error('Free Nominatim geocoding error:', error);
  }

  return null;
}

/**
 * Get store location from store data
 * Tries to extract from mapLink first, then falls back to geocoding address
 */
export async function getStoreLocation(store: { address: string; mapLink: string }): Promise<{ lat: number; lng: number; address: string } | null> {
  // Try to extract from map link first
  if (store.mapLink) {
    let resolvedLink = store.mapLink;
    if (store.mapLink.includes('maps.app.goo.gl') || store.mapLink.includes('goo.gl/maps')) {
      try {
        const axios = require('axios');
        const response = await axios.head(store.mapLink, {
          maxRedirects: 5,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          validateStatus: (status: number) => status >= 200 && status < 400
        });
        resolvedLink = response.request?.res?.responseUrl || response.headers?.location || store.mapLink;
        console.log('Resolved short Google Maps link to:', resolvedLink);
      } catch (error) {
        console.error('Error resolving short map link:', error);
      }
    }
    const coords = extractCoordinatesFromMapLink(resolvedLink);
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
