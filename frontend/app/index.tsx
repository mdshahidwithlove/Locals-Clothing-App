import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { getPostAuthRoute } from '@/utils/authRouting';
import apiClient from '@/api/client';

const splashImage = require('../assets/images/user-splash-full.png');

export default function IndexScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [splashFinished, setSplashFinished] = useState(false);

  // Pre-warm backend server during splash display
  useEffect(() => {
    apiClient.get('/').catch(() => {
      console.log('Backend pre-warm ping initiated');
    });
  }, []);

  // Display user's exact splash screen for 2.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashFinished(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoading && splashFinished) {
      if (isAuthenticated && user) {
        router.replace(getPostAuthRoute(user) as any);
      } else {
        router.replace('/auth/Auth');
      }
    }
  }, [isAuthenticated, isLoading, splashFinished, user, router]);

  return (
    <View style={styles.container}>
      <Image
        source={splashImage}
        style={styles.splashImage}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFC529',
  },
  splashImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
});
