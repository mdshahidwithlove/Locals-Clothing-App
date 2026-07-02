import type { Request, Response } from 'express';
import { getConfig } from '../services/configService';

/**
 * Get directions from Google Directions API
 * This endpoint proxies the request to keep the API key secure on backend
 */
export async function getDirections(req: Request, res: Response) {
  try {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        message: 'Origin and destination are required'
      });
    }

    const apiKey = getConfig("GOOGLE_MAPS_API_KEY");

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Google Maps API key not configured'
      });
    }

    // Call Google Directions API
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin as string)}&destination=${encodeURIComponent(destination as string)}&key=${apiKey}&mode=driving&alternatives=false`;

    const response = await fetch(url);
    const data: any = await response.json();

    if (data.status === 'OK' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];

      return res.status(200).json({
        success: true,
        data: {
          polyline: route.overview_polyline.points,
          distance: {
            value: leg.distance.value, // in meters
            text: leg.distance.text
          },
          duration: {
            value: leg.duration.value, // in seconds
            text: leg.duration.text
          },
          startAddress: leg.start_address,
          endAddress: leg.end_address
        }
      });
    } else {
      console.error('Google Directions API error:', data.status, data.error_message);
      return res.status(400).json({
        success: false,
        message: `Directions API error: ${data.status}`,
        error: data.error_message
      });
    }
  } catch (error) {
    console.error('Error getting directions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get directions'
    });
  }
}

