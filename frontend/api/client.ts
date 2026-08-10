import axios from "axios";
import AsyncStorage from '@react-native-async-storage/async-storage';

export const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://locals-clothing-app.onrender.com';

console.log('API Base URL:', baseUrl);

const apiClient = axios.create({
    baseURL: baseUrl,
    timeout: 60000, // 60 second timeout for Render cold starts
    headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    }
});

apiClient.interceptors.request.use(async (config) => {
    console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`);
    
    if (baseUrl?.includes('ngrok')) {
        config.headers['ngrok-skip-browser-warning'] = 'true';
    }
    if (baseUrl?.includes('loca.lt') || baseUrl?.includes('localtunnel')) {
        config.headers['Bypass-Tunnel-Reminder'] = 'true';
    }
    
    try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (error) {
        console.log('Error adding token to request:', error);
    }
    
    return config;
});

// Auto-retry once on network/timeout errors (especially for Render cold starts)
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config;
        if (!config || config._retry) {
            return Promise.reject(error);
        }
        
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout') || !error.response) {
            config._retry = true;
            console.log('🔄 Retrying request due to cold start timeout:', config.url);
            return apiClient(config);
        }
        
        return Promise.reject(error);
    }
);

export default apiClient;