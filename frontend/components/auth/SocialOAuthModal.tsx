import React, { useState } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Text, SafeAreaView, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface SocialOAuthModalProps {
  visible: boolean;
  provider: 'google' | 'apple';
  onSuccess: (user: { email: string; name: string; avatar?: string }) => void;
  onError: (error: string) => void;
  onClose: () => void;
}

export const SocialOAuthModal: React.FC<SocialOAuthModalProps> = ({
  visible,
  provider,
  onSuccess,
  onError,
  onClose,
}) => {
  const isGoogle = provider === 'google';
  const [loading, setLoading] = useState(true);

  // Direct official Google OAuth 2.0 Authorization Endpoint
  const googleClientId = "78798009324-web.apps.googleusercontent.com";
  const redirectUri = "https://auth.expo.io/@anonymous/Locals";
  
  const googleOAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(googleClientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token%20id_token` +
    `&scope=${encodeURIComponent('openid email profile')}` +
    `&nonce=${Date.now()}` +
    `&prompt=select_account`;

  // Apple OAuth Authorization Endpoint
  const appleOAuthUrl = `https://appleid.apple.com/auth/authorize?` +
    `client_id=com.locals.clothing.app` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code%20id_token` +
    `&response_mode=fragment` +
    `&scope=name%20email`;

  const targetUrl = isGoogle ? googleOAuthUrl : appleOAuthUrl;

  const handleNavigationStateChange = async (navState: any) => {
    const { url } = navState;

    if (url && (url.includes('access_token=') || url.includes('id_token=') || url.includes('auth.expo.io'))) {
      try {
        // Parse token params from URL hash or query string
        const hash = url.split('#')[1] || url.split('?')[1] || '';
        const params: Record<string, string> = {};
        hash.split('&').forEach((part: string) => {
          const [key, value] = part.split('=');
          if (key && value) {
            params[key] = decodeURIComponent(value);
          }
        });

        if (params.access_token) {
          // Fetch Google user profile using access token directly from Google APIs
          const res = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${params.access_token}`);
          const userInfo = await res.json();

          if (userInfo && userInfo.email) {
            onSuccess({
              email: userInfo.email,
              name: userInfo.name || userInfo.email.split('@')[0],
              avatar: userInfo.picture || '',
            });
            return;
          }
        }

        if (params.id_token) {
          // Parse JWT ID token
          const base64Url = params.id_token.split('.')[1];
          if (base64Url) {
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
              atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            );
            const payload = JSON.parse(jsonPayload);
            if (payload && payload.email) {
              onSuccess({
                email: payload.email,
                name: payload.name || payload.email.split('@')[0],
                avatar: payload.picture || '',
              });
              return;
            }
          }
        }
      } catch (err: any) {
        console.error('Failed to parse OAuth response:', err);
        onError('Authentication failed to extract user details.');
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {isGoogle ? 'Sign in with Google' : 'Sign in with Apple'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={isGoogle ? '#DB4437' : '#000000'} />
            <Text style={styles.loadingText}>
              Loading {isGoogle ? 'Google Account Chooser' : 'Apple Sign-In'}...
            </Text>
          </View>
        )}

        <WebView
          source={{ uri: targetUrl }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={handleNavigationStateChange}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          userAgent="Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          style={{ flex: 1 }}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});

export default SocialOAuthModal;
