import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect } from 'react';
import 'react-native-reanimated';
import { useColorScheme } from 'react-native';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { OnlineStatusProvider } from '@/contexts/OnlineStatusContext';
import { NotificationProvider } from '@/components/NotificationProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be hidden on fast reload.
});

// Load icon fonts at startup — keys must match @expo/vector-icons font family names
const iconFonts = {
  ionicons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
  material: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf'),
  anticon: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/AntDesign.ttf'),
};

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts(iconFonts);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationProvider>
          <LocationProvider>
            <OnlineStatusProvider>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <CartProvider>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      animation: 'slide_from_right',
                      animationDuration: 200,
                    }}
                  >
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="auth" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="(merchantTabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="(deliveryTabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="merchant" options={{ headerShown: false }} />
                    <Stack.Screen name="store" options={{ headerShown: false }} />
                    <Stack.Screen name="product" options={{ headerShown: false }} />
                    <Stack.Screen name="order" options={{ headerShown: false }} />
                  </Stack>
                  <StatusBar style="auto" />
                </CartProvider>
              </ThemeProvider>
            </OnlineStatusProvider>
          </LocationProvider>
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
