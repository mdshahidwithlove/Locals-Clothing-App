import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import apiClient from '@/api/client';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationContextType {
  pushToken: string | null;
  notification: Notifications.Notification | null;
}

const NotificationContext = createContext<NotificationContextType>({
  pushToken: null,
  notification: null,
});

export const useNotifications = () => useContext(NotificationContext);

const PUSH_TOKEN_STORAGE_KEY = 'registeredPushToken';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  
  const { user, token: authToken } = useAuth();
  const router = useRouter();

  // Register push notifications and send token to backend
  useEffect(() => {
    const setupNotifications = async () => {
      // Only register push token if user is logged in
      if (!user || !authToken) {
        return;
      }

      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          setPushToken(token);

          // Check if we already registered this token to avoid duplicate API calls
          const lastRegisteredToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
          
          if (lastRegisteredToken !== token) {
            console.log('Sending push token to backend...');
            const response = await apiClient.post(
              '/api/v1/user/push-token',
              { pushToken: token },
              {
                headers: {
                  Authorization: `Bearer ${authToken}`,
                },
              }
            );

            if (response.data?.success) {
              console.log('Push token registered on backend successfully.');
              await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
            }
          } else {
            console.log('Push token already registered on backend. Skipping.');
          }
        }
      } catch (error) {
        console.error('Error during push notification setup:', error);
      }
    };

    setupNotifications();
  }, [user, authToken]);

  // Set up notification event listeners
  useEffect(() => {
    // Listener for foreground notifications
    notificationListener.current = Notifications.addNotificationReceivedListener((notificationData) => {
      console.log('🔔 Foreground Notification Received:', notificationData);
      setNotification(notificationData);

      const { title, body } = notificationData.request.content;
      if (title && body) {
        Alert.alert(title, body, [
          {
            text: "View Details",
            onPress: () => {
              const data = notificationData.request.content.data;
              if (data) {
                handleNotificationAction(data);
              }
            }
          },
          { text: "Dismiss", style: "cancel" }
        ]);
      }
    });

    // Listener for notification clicks/taps
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👉 Notification Clicked:', response);
      
      const data = response.notification.request.content.data;
      if (data) {
        handleNotificationAction(data);
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user]);

  // Route user according to notification payload data
  const handleNotificationAction = (data: any) => {
    try {
      const orderId = data.orderId;
      const type = data.type;

      if (orderId) {
        if (user?.role === 'Merchant') {
          router.push(`/merchant/orders/${orderId}` as any);
        } else if (user?.role === 'Delivery') {
          router.push(`/delivery/orders/${orderId}` as any);
        } else {
          router.push(`/order/${orderId}` as any);
        }
      } else if (type === 'VERIFICATION_APPROVED') {
        if (user?.role === 'Merchant') {
          router.replace('/(merchantTabs)/' as any);
        } else if (user?.role === 'Delivery') {
          router.replace('/(deliveryTabs)/' as any);
        }
      } else if (type === 'VERIFICATION_REJECTED') {
        router.replace('/auth/VerificationPending' as any);
      }
    } catch (err) {
      console.error('Failed to route user from notification tap:', err);
    }
  };

  return (
    <NotificationContext.Provider value={{ pushToken, notification }}>
      {children}
    </NotificationContext.Provider>
  );
};

// Device registration and Expo Push Token generation
async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync() as any;
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync() as any;
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('Notification permissions denied.');
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.warn("No EAS Project ID found. Push notifications will only work in Expo Go.");
    }

    try {
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('📍 Generated Expo Push Token:', token);
      return token;
    } catch (e) {
      console.error('Error generating Expo Push Token:', e);
      return null;
    }
  } else {
    console.warn('Must use physical device for Push Notifications.');
    return null;
  }
}
