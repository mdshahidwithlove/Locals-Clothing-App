import React, { useRef, useCallback, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export interface WebMapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  color?: string; // hex color
  type?: 'current' | 'pickup' | 'delivery' | 'default';
}

export interface WebMapPolyline {
  coordinates: { latitude: number; longitude: number }[];
  color?: string;
  weight?: number;
}

export interface WebMapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
}

export interface WebMapViewProps {
  initialRegion: WebMapRegion;
  markers?: WebMapMarker[];
  polyline?: WebMapPolyline;
  showCenterPin?: boolean;
  centerPinColor?: string;
  showUserLocation?: boolean;
  userLocation?: { latitude: number; longitude: number } | null;
  onRegionChangeComplete?: (region: WebMapRegion) => void;
  style?: any;
  zoomLevel?: number;
}

export interface WebMapViewRef {
  animateToRegion: (region: WebMapRegion, duration?: number) => void;
  setCenter: (lat: number, lng: number, zoom?: number) => void;
}

const getMarkerIcon = (type?: string, color?: string) => {
  const c = color || (type === 'current' ? '#4285F4' : type === 'pickup' ? '#4CAF50' : type === 'delivery' ? '#FF5722' : '#E53935');
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z" fill="${c}" stroke="#fff" stroke-width="2"/>
      <circle cx="16" cy="16" r="7" fill="#fff"/>
    </svg>
  `;
};

const getUserLocationIcon = () => `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="#4285F4" fill-opacity="0.2" stroke="#4285F4" stroke-width="2"/>
    <circle cx="12" cy="12" r="5" fill="#4285F4"/>
  </svg>
`;

const generateHTML = (
  initialRegion: WebMapRegion,
  markers: WebMapMarker[],
  polyline?: WebMapPolyline,
  showCenterPin?: boolean,
  centerPinColor?: string,
  showUserLocation?: boolean,
  userLocation?: { latitude: number; longitude: number } | null,
  zoomLevel?: number
) => {
  const zoom = zoomLevel || 15;
  const markersJSON = JSON.stringify(markers.map(m => ({
    ...m,
    iconSvg: btoa ? undefined : undefined, // will generate in HTML
  })));
  const polylineJSON = polyline ? JSON.stringify(polyline.coordinates.map(c => [c.latitude, c.longitude])) : '[]';
  const polylineColor = polyline?.color || '#FFD700';
  const polylineWeight = polyline?.weight || 5;
  const pinColor = centerPinColor || '#FFD21F';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #map { width: 100%; height: 100%; }
    .center-pin {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -100%);
      z-index: 1000;
      pointer-events: none;
      display: ${showCenterPin ? 'block' : 'none'};
    }
    .center-pin svg { filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3)); }
    .pulse-dot {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 8px;
      height: 8px;
      background: ${pinColor};
      border-radius: 50%;
      z-index: 999;
      pointer-events: none;
      display: ${showCenterPin ? 'block' : 'none'};
    }
    .pulse-dot::after {
      content: '';
      position: absolute;
      top: -6px; left: -6px;
      width: 20px; height: 20px;
      border-radius: 50%;
      background: ${pinColor};
      opacity: 0.3;
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.8); opacity: 0.4; }
      50% { transform: scale(1.4); opacity: 0.1; }
      100% { transform: scale(0.8); opacity: 0.4; }
    }
    .leaflet-control-zoom { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  ${showCenterPin ? `
  <div class="center-pin">
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="58" viewBox="0 0 32 42">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z" fill="${pinColor}" stroke="#fff" stroke-width="2"/>
      <circle cx="16" cy="16" r="6" fill="#fff"/>
    </svg>
  </div>
  <div class="pulse-dot"></div>
  ` : ''}
  <script>
    var map = L.map('map', {
      center: [${initialRegion.latitude}, ${initialRegion.longitude}],
      zoom: ${zoom},
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      crossOrigin: true
    }).addTo(map);

    // Markers
    var markers = ${JSON.stringify(markers)};
    var leafletMarkers = [];
    markers.forEach(function(m) {
      var color = m.color || (m.type === 'current' ? '#4285F4' : m.type === 'pickup' ? '#4CAF50' : m.type === 'delivery' ? '#FF5722' : '#E53935');
      var svgIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z" fill="' + color + '" stroke="#fff" stroke-width="2"/><circle cx="16" cy="16" r="7" fill="#fff"/></svg>';
      var icon = L.divIcon({
        html: svgIcon,
        className: '',
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -42]
      });
      var marker = L.marker([m.latitude, m.longitude], { icon: icon }).addTo(map);
      if (m.title) marker.bindPopup(m.title);
      leafletMarkers.push(marker);
    });

    // User location
    var userMarker = null;
    ${showUserLocation && userLocation ? `
    (function() {
      var userSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#4285F4" fill-opacity="0.2" stroke="#4285F4" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="#4285F4"/></svg>';
      var userIcon = L.divIcon({
        html: userSvg,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      userMarker = L.marker([${userLocation.latitude}, ${userLocation.longitude}], { icon: userIcon }).addTo(map);
    })();
    ` : ''}

    // Polyline
    ${polyline && polyline.coordinates.length > 1 ? `
    var polyCoords = ${JSON.stringify(polyline.coordinates.map(c => [c.latitude, c.longitude]))};
    L.polyline(polyCoords, {
      color: '${polylineColor}',
      weight: ${polylineWeight},
      opacity: 0.9,
      lineJoin: 'round',
      lineCap: 'round'
    }).addTo(map);
    ` : ''}

    // Region change events
    var moveTimeout;
    map.on('moveend', function() {
      clearTimeout(moveTimeout);
      moveTimeout = setTimeout(function() {
        var center = map.getCenter();
        var bounds = map.getBounds();
        var latDelta = bounds.getNorth() - bounds.getSouth();
        var lngDelta = bounds.getEast() - bounds.getWest();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'regionChange',
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta
        }));
      }, 300);
    });

    // Listen for commands from React Native
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
    function handleMessage(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'setCenter') {
          map.setView([data.latitude, data.longitude], data.zoom || map.getZoom(), { animate: true });
        } else if (data.type === 'updateUserLocation') {
          if (userMarker) {
            userMarker.setLatLng([data.latitude, data.longitude]);
          }
        } else if (data.type === 'updateMarkers') {
          leafletMarkers.forEach(function(m) { map.removeLayer(m); });
          leafletMarkers = [];
          data.markers.forEach(function(m) {
            var color = m.color || (m.type === 'current' ? '#4285F4' : m.type === 'pickup' ? '#4CAF50' : m.type === 'delivery' ? '#FF5722' : '#E53935');
            var svgIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z" fill="' + color + '" stroke="#fff" stroke-width="2"/><circle cx="16" cy="16" r="7" fill="#fff"/></svg>';
            var icon = L.divIcon({ html: svgIcon, className: '', iconSize: [32, 42], iconAnchor: [16, 42] });
            var marker = L.marker([m.latitude, m.longitude], { icon: icon }).addTo(map);
            if (m.title) marker.bindPopup(m.title);
            leafletMarkers.push(marker);
          });
        }
      } catch(e) {}
    }

    // Signal ready
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
  </script>
</body>
</html>
  `;
};

const WebMapView = forwardRef<WebMapViewRef, WebMapViewProps>((props, ref) => {
  const {
    initialRegion,
    markers = [],
    polyline,
    showCenterPin = false,
    centerPinColor,
    showUserLocation = false,
    userLocation = null,
    onRegionChangeComplete,
    style,
    zoomLevel,
  } = props;

  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: WebMapRegion, _duration?: number) => {
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'setCenter',
        latitude: region.latitude,
        longitude: region.longitude,
        zoom: region.latitudeDelta ? Math.round(Math.log2(360 / (region.latitudeDelta || 0.01))) : undefined,
      }));
    },
    setCenter: (lat: number, lng: number, zoom?: number) => {
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'setCenter',
        latitude: lat,
        longitude: lng,
        zoom,
      }));
    },
  }));

  // Update user location when it changes
  useEffect(() => {
    if (isReady && userLocation) {
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'updateUserLocation',
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      }));
    }
  }, [isReady, userLocation?.latitude, userLocation?.longitude]);

  // Update markers when they change
  useEffect(() => {
    if (isReady && markers.length > 0) {
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'updateMarkers',
        markers,
      }));
    }
  }, [isReady, JSON.stringify(markers)]);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'regionChange' && onRegionChangeComplete) {
        onRegionChangeComplete({
          latitude: data.latitude,
          longitude: data.longitude,
          latitudeDelta: data.latitudeDelta,
          longitudeDelta: data.longitudeDelta,
        });
      } else if (data.type === 'mapReady') {
        setIsReady(true);
      }
    } catch (e) {}
  }, [onRegionChangeComplete]);

  const html = generateHTML(
    initialRegion,
    markers,
    polyline,
    showCenterPin,
    centerPinColor,
    showUserLocation,
    userLocation,
    zoomLevel
  );

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webView}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={true}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        originWhitelist={['*']}
        mixedContentMode="compatibility"
        androidLayerType="hardware"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
});

export default WebMapView;
