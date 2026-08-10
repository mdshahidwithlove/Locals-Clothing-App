import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
  Alert,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Keyboard
} from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import PhoneInput from "@/components/auth/PhoneInput";
import ContinueButton from "@/components/auth/ContinueButton";
import TermsSection from "@/components/auth/TermsSection";
import apiClient from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import { navigateAfterAuth } from '@/utils/authRouting';
import { LinearGradient } from 'expo-linear-gradient';
import FirebasePhoneAuthModal from "@/components/auth/FirebasePhoneAuthModal";
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from "expo-video";

const { height } = Dimensions.get('window');

const videoSource = require('../../assets/videos/Design & Development Agency!.mp4');

const Auth = () => {
  const router = useRouter();
  const { login } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));
  
  // Email mode state
  const [showEmailMode, setShowEmailMode] = useState(true);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Phone number validation
  const isValidPhone = useMemo(() => {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    return cleanNumber.length === 10;
  }, [phoneNumber]);

  // Email validation
  const isValidEmail = useMemo(() => {
    if (!email || email.length === 0) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim()) && email.length <= 320;
  }, [email]);

  const isValidPassword = useMemo(() => {
    return password && password.length >= 6;
  }, [password]);

  const handlePhoneChange = useCallback((text: string) => {
    setPhoneNumber(text);
  }, []);

  const [showFirebaseModal, setShowFirebaseModal] = useState(false);

  const handleGetOtp = useCallback(async () => {
    if (isSendingOtp || !isValidPhone) return;
    setShowFirebaseModal(true);
  }, [isSendingOtp, isValidPhone]);

  const handleFirebaseSuccess = useCallback(async (verificationId: string) => {
    try {
      setIsSendingOtp(true);
      setShowFirebaseModal(false);
      const cleanPhone = phoneNumber.replace(/\D/g, '');

      await apiClient.post('/api/v1/user/onboarding', {
        phone: cleanPhone
      });

      router.push({
        pathname: '/auth/OtpScreen',
        params: { phoneNumber: cleanPhone, verificationId }
      });
    } catch (error: any) {
      console.error('Onboarding error:', error);
      Alert.alert('Error', 'Failed to process login. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  }, [phoneNumber, router]);

  const handleFirebaseError = useCallback(async (errorMsg: string) => {
    setShowFirebaseModal(false);
    setIsSendingOtp(true);
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const response = await apiClient.post('/api/v1/user/onboarding', {
        phone: cleanPhone
      });

      if (response.data.success) {
        if (response.data.otp) {
          Alert.alert('OTP Verification Code', `Your 4-digit OTP is: ${response.data.otp}`);
        } else {
          Alert.alert('OTP Sent', response.data.message || 'OTP sent successfully to your phone');
        }

        router.push({
          pathname: '/auth/OtpScreen',
          params: { phoneNumber: cleanPhone }
        });
      } else {
        Alert.alert('Error', response.data.message || 'Failed to send OTP.');
      }
    } catch (err: any) {
      console.error('Fallback OTP error:', err);
      Alert.alert('Firebase Error', errorMsg || 'Could not send SMS. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  }, [phoneNumber, router]);

  const handleEmailChange = useCallback((text: string) => {
    setEmail(text);
  }, []);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
  }, []);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  // Auto-scroll input into view when focused so keyboard never covers it
  const handleInputFocus = useCallback((yOffset: number = 180) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: yOffset, animated: true });
    }, 100);
  }, []);

  const handleEmailSubmit = useCallback(async () => {
    if (isLoading) return;

    if (!isValidEmail) {
      Alert.alert('Invalid Email', 'Please enter a valid email address (e.g. name@gmail.com, name@outlook.com).');
      return;
    }

    if (!isValidPassword) {
      Alert.alert('Password Too Short', 'Password must be at least 6 characters long.');
      return;
    }

    try {
      setIsLoading(true);
      const targetEmail = email.trim().toLowerCase();
      const targetName = name.trim() || targetEmail.split('@')[0];

      if (authMode === 'signin') {
        // --- SIGN IN MODE ---
        try {
          const response = await apiClient.post('/api/v1/user/login', {
            email: targetEmail,
            password
          });

          if (response.data.success) {
            const { token: jwtToken, user: userData } = response.data;
            await login(userData, jwtToken);
            navigateAfterAuth(userData, router);
            return;
          }
        } catch (loginError: any) {
          const status = loginError.response?.status;
          const msg = loginError.response?.data?.message || '';

          if (status === 400 || status === 401 || status === 404 || msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('not found')) {
            Alert.alert(
              'Sign In Failed',
              'Incorrect email or password, or no account exists yet with this email.\n\nTap "Create Account" below to register.',
              [
                {
                  text: 'Create Account',
                  onPress: () => {
                    setAuthMode('signup');
                    if (!name) setName(targetEmail.split('@')[0]);
                  }
                },
                { text: 'Try Again', style: 'cancel' }
              ]
            );
          } else {
            Alert.alert('Sign In Failed', msg || 'Authentication failed. Please try again.');
          }
        }
      } else {
        // --- CREATE ACCOUNT MODE ---
        try {
          const response = await apiClient.post('/api/v1/user/register', {
            email: targetEmail,
            password,
            name: targetName
          });

          if (response.data.success) {
            const { token: jwtToken, user: userData } = response.data;
            await login(userData, jwtToken);
            router.replace('/auth/ProfileCompletion' as any);
            return;
          }
        } catch (regError: any) {
          const status = regError.response?.status;
          const msg = regError.response?.data?.message || '';

          if (status === 409 || msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exist')) {
            Alert.alert(
              'Account Already Exists',
              'An account with this email address already exists in Locals.\n\nTap "Sign In Now" to log in with your password.',
              [
                {
                  text: 'Sign In Now',
                  onPress: () => setAuthMode('signin')
                },
                { text: 'Cancel', style: 'cancel' }
              ]
            );
          } else {
            Alert.alert('Registration Failed', msg || 'Could not create account. Please check your email and try again.');
          }
        }
      }
    } catch (error: any) {
      console.error('Email authentication error:', error);
      Alert.alert('Authentication Error', error.response?.data?.message || 'Authentication failed. Please check your internet connection.');
    } finally {
      setIsLoading(false);
    }
  }, [isValidEmail, isValidPassword, isLoading, authMode, email, password, name, login, router]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header Video Background - 100% Uncropped (contentFit="contain"), No Text Overlays */}
      <View style={styles.videoContainer}>
        <VideoView
          style={styles.videoPlayer}
          player={player}
          contentFit="contain"
          nativeControls={false}
          allowsFullscreen={false}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={styles.cardContainer}>
          <ScrollView 
            ref={scrollViewRef}
            style={styles.scrollableContent}
            contentContainerStyle={styles.scrollableContentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {showEmailMode ? (
              <>
                {/* Sign In vs Create Account Tab Switcher */}
                <View style={styles.authTabContainer}>
                  <TouchableOpacity 
                    style={[styles.authTab, authMode === 'signin' && styles.authTabActive]}
                    onPress={() => setAuthMode('signin')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.authTabText, authMode === 'signin' && styles.authTabTextActive]}>
                      Sign In
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.authTab, authMode === 'signup' && styles.authTabActive]}
                    onPress={() => setAuthMode('signup')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.authTabText, authMode === 'signup' && styles.authTabTextActive]}>
                      Create Account
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Name Input (For Create Account Mode) */}
                {authMode === 'signup' && (
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons 
                        name="person-outline" 
                        size={20} 
                        color={name ? "#000000" : Colors.textMuted} 
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.textInput}
                        value={name}
                        onChangeText={setName}
                        placeholder="Enter your full name"
                        placeholderTextColor={Colors.textMuted}
                        autoCapitalize="words"
                        onFocus={() => handleInputFocus(50)}
                      />
                    </View>
                  </View>
                )}

                {/* Email Input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons 
                      name="mail-outline" 
                      size={20} 
                      color={email ? "#000000" : Colors.textMuted} 
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      value={email}
                      onChangeText={handleEmailChange}
                      placeholder="Enter your email address"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      onFocus={() => handleInputFocus(120)}
                    />
                  </View>
                  {email.length > 0 && !isValidEmail && (
                    <Text style={styles.errorText}>
                      Please enter a valid email address
                    </Text>
                  )}
                </View>

                {/* Password Input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons 
                      name="lock-closed-outline" 
                      size={20} 
                      color={password ? "#000000" : Colors.textMuted} 
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.textInput, styles.passwordInput]}
                      value={password}
                      onChangeText={handlePasswordChange}
                      placeholder="Enter your password (min 6 chars)"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="password"
                      onFocus={() => handleInputFocus(200)}
                    />
                    <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
                      <Ionicons 
                        name={showPassword ? "eye-off-outline" : "eye-outline"} 
                        size={20} 
                        color={Colors.textMuted} 
                      />
                    </TouchableOpacity>
                  </View>
                  {password.length > 0 && !isValidPassword && (
                    <Text style={styles.errorText}>
                      Password must be at least 6 characters long
                    </Text>
                  )}
                </View>

                {/* Submit Action Button */}
                <TouchableOpacity 
                  style={[styles.continueButton, isLoading && styles.continueButtonDisabled]} 
                  onPress={handleEmailSubmit}
                  activeOpacity={0.85}
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={['#FFC529', '#FFB800']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#000000" />
                    ) : (
                      <Text style={styles.continueButtonText}>
                        {authMode === 'signin' ? "SIGN IN" : "CREATE ACCOUNT"}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Phone Input Section */}
                <PhoneInput
                  phoneNumber={phoneNumber}
                  onPhoneChange={handlePhoneChange}
                  isValid={isValidPhone}
                />

                <ContinueButton
                  isValid={isValidPhone}
                  isLoading={isSendingOtp}
                  onPress={handleGetOtp}
                  fadeAnim={fadeAnim}
                />

                <TouchableOpacity onPress={() => setShowEmailMode(true)} style={styles.phoneOptionButton}>
                  <Text style={styles.phoneOptionText}>Back to Email Sign In</Text>
                </TouchableOpacity>

                <TermsSection />
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <FirebasePhoneAuthModal
        visible={showFirebaseModal}
        phoneNumber={phoneNumber}
        onSuccess={handleFirebaseSuccess}
        onError={handleFirebaseError}
        onClose={() => setShowFirebaseModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  videoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: height * 0.32,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  keyboardContainer: {
    flex: 1,
    marginTop: height * 0.26,
  },
  cardContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 16,
  },
  scrollableContent: {
    flex: 1,
  },
  scrollableContentContainer: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: Platform.OS === 'ios' ? 50 : 36,
    flexGrow: 1,
  },
  authTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 4,
    marginBottom: 22,
  },
  authTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  authTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  authTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  authTabTextActive: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
    fontWeight: '500',
  },
  passwordInput: {
    paddingRight: 36,
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    padding: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    marginTop: 4,
    fontWeight: '500',
  },
  continueButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 18,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#FFC529',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1,
  },
  phoneOptionButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  phoneOptionText: {
    fontSize: 14,
    color: '#D97706',
    fontWeight: '800',
  },
});

export default Auth;