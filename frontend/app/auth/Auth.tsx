import React, { useState, useCallback, useMemo } from "react";
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
  ImageBackground,
  ScrollView
} from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import PhoneInput from "@/components/auth/PhoneInput";
import SocialLoginButtons from "@/components/auth/SocialLoginButtons";
import ContinueButton from "@/components/auth/ContinueButton";
import TermsSection from "@/components/auth/TermsSection";
import apiClient from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import { navigateAfterAuth } from '@/utils/authRouting';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');

const Auth = () => {
  const router = useRouter();
  const { login } = useAuth();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));
  
  // Email mode state
  const [showEmailMode, setShowEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Memoized phone number validation
  const isValidPhone = useMemo(() => {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    return cleanNumber.length === 10;
  }, [phoneNumber]);

  // Email validation
  const isValidEmail = useMemo(() => {
    if (!email || email.length === 0) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 320;
  }, [email]);

  const isValidPassword = useMemo(() => {
    return password && password.length >= 6;
  }, [password]);

  const isEmailFormValid = useMemo(() => {
    return isValidEmail && isValidPassword;
  }, [isValidEmail, isValidPassword]);

  const handlePhoneChange = useCallback((text: string) => {
    setPhoneNumber(text);
  }, []);

  const handleGetOtp = useCallback(async () => {
    if (isSendingOtp || !isValidPhone) return;

    try {
      setIsSendingOtp(true);

      // Animate button press
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.7,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      // Format phone number properly - send clean 10-digit number
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const finalPhoneNumber = cleanPhone; // Send 10-digit number to backend

      // Send OTP request to backend
      const response = await apiClient.post('/api/v1/user/onboarding', {
        phone: finalPhoneNumber
      });

      if (response.data.success) {
        // Navigate to OTP screen with phone number
        router.push({
          pathname: '/auth/OtpScreen',
          params: { phoneNumber: finalPhoneNumber }
        });
      } else {
        Alert.alert('Error', response.data.message || 'Failed to send OTP. Please try again.');
      }
    } catch (error: any) {
      console.error('OTP send error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to send OTP. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSendingOtp(false);
    }
  }, [isSendingOtp, isValidPhone, fadeAnim, phoneNumber, router]);

  const handleEmailLogin = useCallback(() => {
    setShowEmailMode(true);
  }, []);

  const handleBackToPhone = useCallback(() => {
    setShowEmailMode(false);
    setEmail('');
    setPassword('');
  }, []);

  const handleEmailChange = useCallback((text: string) => {
    setEmail(text.toLowerCase());
  }, []);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
  }, []);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(!showPassword);
  }, [showPassword]);

  const handleEmailSubmit = useCallback(async () => {
    if (!isEmailFormValid || isLoading) return;

    try {
      setIsLoading(true);

      // Try to login first
      try {
        const loginResponse = await apiClient.post('/api/v1/user/login', {
          email,
          password
        });

        if (loginResponse.data.success) {
          const { token, user } = loginResponse.data;
          await login(user, token);
          navigateAfterAuth(user, router);
          return;
        }
      } catch (loginError: any) {
        // If login fails, try to register
        if (loginError.response?.status === 401) {
          const registerResponse = await apiClient.post('/api/v1/user/register', {
            email,
            password
          });

          if (registerResponse.data.success) {
            const { token, user } = registerResponse.data;
            await login(user, token);
            
            // New users always need to complete profile
            router.replace('/auth/ProfileCompletion' as any);
            return;
          }
        }
        throw loginError;
      }
    } catch (error: any) {
      console.error('Email authentication error:', error);
      const errorMessage = error.response?.data?.message || 'Authentication failed. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isEmailFormValid, isLoading, email, password, login, router]);


  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: 'https://ik.imagekit.io/fhi2xkjg1/locals/locals3.png' }}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={styles.content}>
          <View style={styles.topSection}>
            <View style={styles.brandContainer} />
          </View>

          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.logoContainer}>
                <Text style={styles.logoText}>Locals</Text>
                <View style={styles.logoUnderline} />
              </View>
              <Text style={styles.modalSubtitle}>
                {!showEmailMode 
                  ? "Enter your mobile number to discover premium fashion at your doorstep"
                  : "Enter your email and password to get started"
                }
              </Text>
            </View>

            {/* Back Button - Top Left (only visible in email mode) */}
            {showEmailMode && (
              <TouchableOpacity onPress={handleBackToPhone} style={styles.topBackButton}>
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            )}

            {/* Scrollable Content Section */}
            <ScrollView 
              style={styles.scrollableContent}
              contentContainerStyle={styles.scrollableContentContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {!showEmailMode ? (
                <>
                  {/* Phone Input Section */}
                  <PhoneInput
                    phoneNumber={phoneNumber}
                    onPhoneChange={handlePhoneChange}
                    isValid={isValidPhone}
                  />

                  {/* Continue Button */}
                  <ContinueButton
                    isValid={isValidPhone}
                    isLoading={isSendingOtp}
                    onPress={handleGetOtp}
                    fadeAnim={fadeAnim}
                  />

                  {/* Social Login Buttons */}
                  <SocialLoginButtons onEmailLogin={handleEmailLogin} />

                  {/* Bottom Terms */}
                  <TermsSection />
                </>
              ) : (
                <>
                  {/* Email Input */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons 
                        name="mail-outline" 
                        size={20} 
                        color={email ? Colors.buttonPrimary : Colors.textMuted} 
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.textInput}
                        value={email}
                        onChangeText={handleEmailChange}
                        placeholder="Enter your email"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                      />
                    </View>
                    {email && !isValidEmail && (
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
                        color={password ? Colors.buttonPrimary : Colors.textMuted} 
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[styles.textInput, styles.passwordInput]}
                        value={password}
                        onChangeText={handlePasswordChange}
                        placeholder="Enter your password"
                        placeholderTextColor={Colors.textMuted}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="password"
                      />
                      <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
                        <Ionicons 
                          name={showPassword ? "eye-off-outline" : "eye-outline"} 
                          size={20} 
                          color={Colors.textMuted} 
                        />
                      </TouchableOpacity>
                    </View>
                    {password && !isValidPassword && (
                      <Text style={styles.errorText}>
                        Password must be at least 6 characters long
                      </Text>
                    )}
                  </View>

                  {/* Continue Button */}
                  <Animated.View style={{ opacity: fadeAnim, marginTop: 20 }}>
                    <TouchableOpacity 
                      style={styles.continueButton} 
                      onPress={handleEmailSubmit}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={Colors.gradients.primary as [string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                      >
                        <Text style={styles.continueButtonText}>
                          {isLoading ? "Signing In..." : "Continue"}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: height * 0.4,
  },
  keyboardContainer: {
    flex: 1,
    zIndex: 1,
  },
  content: {
    flex: 1,
  },
  topSection: {
    height: height * 0.25, // Reduced height for better keyboard behavior
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  brandContainer: {
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  scrollableContent: {
    flex: 1,
  },
  scrollableContentContainer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    flexGrow: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.logo,
    letterSpacing: -1,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  logoUnderline: {
    width: 60,
    height: 4,
    backgroundColor: Colors.logo,
    borderRadius: 2,
    marginTop: 4,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  modalSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  topBackButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 16,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  passwordInput: {
    paddingRight: 40,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  continueButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 24,
    elevation: 6,
    shadowColor: Colors.buttonPrimary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  continueButtonDisabled: {
    opacity: 0.7,
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonGradient: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 1.0,
  },
  continueButtonTextDisabled: {
    color: Colors.textPrimary,
    opacity: 0.7,
  },
});

export default Auth;