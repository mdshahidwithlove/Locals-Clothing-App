import type { Request, Response } from 'express';
import { getConfig } from '../services/configService';

/**
 * Helper to fetch directions from OSRM as a free fallback
 */
async function fetchOsrmDirections(originLat: number, originLng: number, destLat: number, destLng: number) {
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=polyline&steps=true`;
  const res = await fetch(osrmUrl);
  const data: any = await res.json();

  if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
    const route = data.routes[0];
    const leg = route.legs[0];

    const steps = (leg.steps || []).map((s: any) => {
      const type = s.maneuver?.type || 'turn';
      const modifier = s.maneuver?.modifier || '';
      const street = s.name ? `onto ${s.name}` : '';
      let instruction = `${type.toUpperCase()} ${modifier} ${street}`.trim();
      if (type === 'depart') instruction = 'Start route towards destination';
      if (type === 'arrive') instruction = 'Arrive at destination';

      return {
        instruction,
        distance: s.distance ? `${Math.round(s.distance)} m` : '',
        duration: s.duration ? `${Math.round(s.duration / 60)} min` : '',
        type,
        modifier
      };
    });

    return {
      polyline: route.geometry,
      distance: {
        value: route.distance,
        text: `${(route.distance / 1000).toFixed(1)} km`
      },
      duration: {
        value: route.duration,
        text: `${Math.round(route.duration / 60)} mins`
      },
      steps,
      source: 'OSRM'
    };
  }
  return null;
}

export async function getDirections(req: Request, res: Response) {
  try {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        message: 'Origin and destination are required'
      });
    }

    const [origLat, origLng] = (origin as string).split(',').map(Number);
    const [destLat, destLng] = (destination as string).split(',').map(Number);

    const apiKey = getConfig("GOOGLE_MAPS_API_KEY");

    if (apiKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin as string)}&destination=${encodeURIComponent(destination as string)}&key=${apiKey}&mode=driving&alternatives=false`;
        const response = await fetch(url);
        const data: any = await response.json();

        if (data.status === 'OK' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const leg = route.legs[0];

          const steps = (leg.steps || []).map((s: any) => ({
            instruction: s.html_instructions ? s.html_instructions.replace(/<[^>]*>?/gm, '') : s.instructions || 'Continue',
            distance: s.distance?.text || '',
            duration: s.duration?.text || '',
            maneuver: s.maneuver || ''
          }));

          return res.status(200).json({
            success: true,
            data: {
              polyline: route.overview_polyline.points,
              distance: {
                value: leg.distance.value,
                text: leg.distance.text
              },
              duration: {
                value: leg.duration.value,
                text: leg.duration.text
              },
              startAddress: leg.start_address,
              endAddress: leg.end_address,
              steps,
              source: 'Google'
            }
          });
        }
      } catch (gErr) {
        console.warn('Google Directions failed, trying OSRM fallback:', gErr);
      }
    }

    // Fallback to OSRM
    if (!isNaN(origLat) && !isNaN(origLng) && !isNaN(destLat) && !isNaN(destLng)) {
      const osrmData = await fetchOsrmDirections(origLat, origLng, destLat, destLng);
      if (osrmData) {
        return res.status(200).json({
          success: true,
          data: osrmData
        });
      }
    }

    return res.status(400).json({
      success: false,
      message: 'Could not calculate directions route'
    });
  } catch (error) {
    console.error('Error getting directions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get directions'
    });
  }
}

