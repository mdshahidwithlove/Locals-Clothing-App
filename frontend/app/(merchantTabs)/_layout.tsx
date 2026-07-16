import { Tabs, useRouter, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { getPostAuthRoute } from '@/utils/authRouting';
import { needsVerificationScreen } from '@/utils/verificationUtils';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MerchantTabLayout() {
  const { user, isLoading, refreshUserProfile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      if (!isLoading) {
        void refreshUserProfile();
      }
    }, [isLoading, refreshUserProfile]),
  );

  useEffect(() => {
    if (!isLoading && user) {
      const target = getPostAuthRoute(user);
      if (target !== '/(merchantTabs)/') {
        router.replace(target as any);
      }
    }
  }, [user, isLoading, router, user?.verificationStatus, user?.verificationGrandfathered]);

  if (isLoading || !user || !user.isProfileComplete || needsVerificationScreen(user) || user.role !== 'Merchant') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const bottomPadding = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 30 : 10);
  const barHeight = (Platform.OS === 'ios' ? 58 : 50) + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: {
          backgroundColor: Colors.navigationBackground,
          borderTopColor: Colors.border,
          height: barHeight,
          paddingBottom: bottomPadding,
          paddingTop: 8,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shirt" color={color} size={size} />
          ),
        }}
      />
      {/* Removed Settlements route */}
            <Tabs.Screen
        name="orders/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
