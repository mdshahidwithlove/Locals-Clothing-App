import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { getPostAuthRoute } from '@/utils/authRouting';

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
          <Text style={styles.logoText}>Locals</Text>
        </View>
        
        <View style={styles.footerContainer}>
          <Text style={styles.footerCopyright}>© 2024 Locals Inc.</Text>
          <Text style={styles.footerLoading}>Loading...</Text>
        </View>
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
  },
  logoText: {
    fontSize: 56,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Georgia-Bold' : 'serif',
    color: '#000000',
    letterSpacing: -1,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center',
  },
  footerCopyright: {
    fontSize: 11,
    color: '#000000',
    opacity: 0.9,
    fontWeight: '700',
    marginBottom: 4,
  },
  footerLoading: {
    fontSize: 11,
    color: '#000000',
    opacity: 0.7,
    fontWeight: '600',
  },
});

