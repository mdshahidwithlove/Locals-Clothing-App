import { Tabs, useRouter, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo } from 'react';
import { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { getPostAuthRoute } from '@/utils/authRouting';
import { needsVerificationScreen } from '@/utils/verificationUtils';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';

export default function DeliveryTabLayout() {
  const { user, isLoading, refreshUserProfile } = useAuth();
  const router = useRouter();

  const canAccessDeliveryTabs = useMemo(() => {
    if (isLoading || !user) return false;
    if (!user.isProfileComplete) return false;
    if (user.role !== 'Delivery') return false;
    if (needsVerificationScreen(user)) return false;
    return true;
  }, [isLoading, user, user?.verificationStatus, user?.verificationGrandfathered]);

  useFocusEffect(
    useCallback(() => {
      if (!isLoading) {
        void refreshUserProfile();
      }
    }, [isLoading, refreshUserProfile]),
  );

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/auth/Auth');
      return;
    }

    const target = getPostAuthRoute(user);
    if (target !== '/(deliveryTabs)/') {
      router.replace(target as any);
    }
  }, [user, isLoading, router, user?.verificationStatus, user?.verificationGrandfathered]);

  if (!canAccessDeliveryTabs) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: {
          backgroundColor: Colors.navigationBackground,
          borderTopColor: Colors.border,
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
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
        name="delivery"
        options={{
          title: 'Delivery',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bicycle" color={color} size={size} />
          ),
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
      <Tabs.Screen
        name="order-details"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="navigation-map"
        options={{
          href: null,
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
