import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { getPostAuthRoute } from '@/utils/authRouting';
import { Image } from 'expo-image';
import { LOCALS_LOGO } from '@/constants/branding';

export default function IndexScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        console.log('🔍 Navigation Debug:', {
          isAuthenticated,
          user: user ? {
            _id: user._id,
            name: user.name,
            role: user.role,
            isProfileComplete: user.isProfileComplete
          } : null
        });
        
        // Check if user needs to complete profile
        if (user) {
          router.replace(getPostAuthRoute(user) as any);
        }
      } else {
        console.log('🔐 User not authenticated, navigating to Auth');
        router.replace('/auth/Auth');
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={LOCALS_LOGO}
            style={styles.logo}
            contentFit="contain"
            transition={200}
          />
        </View>
        <ActivityIndicator size="large" color="#FFFFFF" style={styles.spinner} />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFD21F',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 300,
    height: 300,
  },
  logo: {
    width: 240,
    height: 240,
  },
  spinner: {
    marginTop: 24,
  },
});

