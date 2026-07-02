import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
  ScrollView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { navigateAfterAuth } from '@/utils/authRouting';
import { useAuth } from '@/contexts/AuthContext';

const OtpScreen = () => {
  const router = useRouter();
  const { login } = useAuth();
  const params = useLocalSearchParams<{ phoneNumber?: string }>();
  const phoneNumber = params.phoneNumber || '';
  const [otp, setOtp] = useState(['', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [boxAnimations] = useState([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]);
  const inputRefs = useRef<TextInput[]>([]);


  // Memoized OTP validation
  const isOtpComplete = useMemo(() => {
    return otp.every(digit => digit !== '') && otp.length === 4;
  }, [otp]);

  // Format phone number to show only last 4 digits
  const formatPhoneNumber = useMemo(() => {
    if (phoneNumber.length >= 4) {
      const lastFour = phoneNumber.slice(-4);
      return `+91 ******${lastFour}`;
    }
    return `+91 ${phoneNumber}`;
  }, [phoneNumber]);

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);


  // Verify OTP handler (moved up to avoid dependency issues)
  const handleVerifyOtp = useCallback(async () => {
    const otpString = otp.join('');
    if (!isOtpComplete) {
      return;
    }

    try {
      setIsVerifying(true);
      
      // Verify OTP with backend
      const response = await apiClient.post('/api/v1/user/verify-otp', {
        phone: phoneNumber,
        otp: otpString
      });

      if (response.data.success) {
        const { token, user } = response.data;
        await login(user, token);
        navigateAfterAuth(user, router);
      } else {
        // Wrong OTP - clear without shake
        setOtp(['', '', '', '']);
        setActiveIndex(0);
        inputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      console.error('OTP verification error:', error);
      
      // Error - clear without shake
      setOtp(['', '', '', '']);
      setActiveIndex(0);
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  }, [isOtpComplete, router, phoneNumber, otp, login]);

  // Enhanced OTP change handler with haptic feedback and animations
  const handleOtpChange = useCallback((value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Animate box fill
    if (value) {
      Animated.sequence([
        Animated.timing(boxAnimations[index], {
          toValue: 1.1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(boxAnimations[index], {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }

    // Auto-focus next input
    if (value && index < 3) {
      setActiveIndex(index + 1);
      inputRefs.current[index + 1]?.focus();
    }

    // No auto-verify - user must click verify button
  }, [boxAnimations, otp]);

  // Enhanced key press handler
  const handleKeyPress = useCallback((key: string, index: number) => {
    if (key === 'Backspace') {
      // Haptic feedback for backspace
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      if (otp[index]) {
        // If current box has a number, clear it
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      } else if (index > 0) {
        // If current box is empty, move to previous box and clear it
        setActiveIndex(index - 1);
        inputRefs.current[index - 1]?.focus();
        
        // Clear the previous box
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
      }
    }
  }, [otp]);

  // Resend OTP handler
  const handleResendOtp = useCallback(async () => {
    try {
      setIsVerifying(true);
      
      // Resend OTP request to backend
      const response = await apiClient.post('/api/v1/user/onboarding', {
        phone: phoneNumber
      });

      if (response.data.success) {
        setTimer(60);
        setCanResend(false);
        setOtp(['', '', '', '']);
        setActiveIndex(0);
        inputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      console.error('Resend OTP error:', error);
    } finally {
      setIsVerifying(false);
    }
  }, [phoneNumber]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      <KeyboardAvoidingView 
        style={styles.keyboardContainer} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
          </Pressable>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Modal Container */}
          <View style={styles.modalContainer}>
            {/* Fixed Header Section */}
            <View style={styles.modalHeader}>
              <View style={styles.logoContainer}>
                <Text style={styles.logoText}>Locals</Text>
                <View style={styles.logoUnderline} />
              </View>
              <Text style={styles.title}>Verify Your Number</Text>
              <Text style={styles.subtitle}>
                We&apos;ve sent a 4-digit code to{'\n'}
                <Text style={styles.phoneNumber}>{formatPhoneNumber}</Text>
              </Text>
            </View>

            {/* Scrollable Content Section */}
            <ScrollView 
              style={styles.scrollableContent}
              contentContainerStyle={styles.scrollableContentContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* OTP Input */}
              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <Animated.View
                    key={index}
                    style={{
                      transform: [{ scale: boxAnimations[index] }]
                    }}
                  >
                    <TextInput
                      ref={(ref) => {
                        if (ref) inputRefs.current[index] = ref;
                      }}
                      style={[
                        styles.otpInput,
                        digit && styles.otpInputFilled,
                        activeIndex === index && styles.otpInputActive
                      ]}
                      value={digit}
                      onChangeText={(value) => handleOtpChange(value, index)}
                      onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                      onFocus={() => setActiveIndex(index)}
                      keyboardType="numeric"
                      maxLength={1}
                      textAlign="center"
                      selectTextOnFocus
                      autoFocus={index === 0}
                    />
                  </Animated.View>
                ))}
              </View>
              

              {/* Verify Button */}
              <Animated.View style={{ opacity: fadeAnim }}>
                <TouchableOpacity 
                  style={[
                    styles.verifyButton,
                    (!isOtpComplete || isVerifying) && styles.verifyButtonDisabled
                  ]} 
                  onPress={handleVerifyOtp}
                  disabled={!isOtpComplete || isVerifying}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={isOtpComplete ? Colors.gradients.primary as [string, string] : [Colors.border, Colors.border] as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    <Text style={[
                      styles.verifyButtonText,
                      !isOtpComplete && styles.verifyButtonTextDisabled
                    ]}>
                      {isVerifying ? "Verifying..." : "Verify OTP"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {/* Resend Section */}
              <View style={styles.resendSection}>
                {canResend ? (
                  <Pressable onPress={handleResendOtp} style={styles.resendButton}>
                    <Text style={styles.resendText}>Didn&apos;t receive? Resend OTP</Text>
                  </Pressable>
                ) : (
                  <View style={styles.timerContainer}>
                    {/* <Text style={styles.timerText}>
                      Didn&apos;t receive? Resend in {timer}s
                    </Text> */}
                  </View>
                )}
              </View>

              {/* Security Info */}
              <View style={styles.securityInfo}>
                <View style={styles.securityIconContainer}>
                  <View style={styles.securityIcon} />
                </View>
                <Text style={styles.securityText}>
                  Your OTP is secure and will expire in 5 minutes
                </Text>
              </View>
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
  keyboardContainer: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: 'flex-start',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    marginLeft: 8,
  },
  content: {
    flex: 1,
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
    marginBottom: 20,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.logo,
    letterSpacing: -1,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  logoUnderline: {
    width: 50,
    height: 4,
    backgroundColor: Colors.logo,
    borderRadius: 2,
    marginTop: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  phoneNumber: {
    color: Colors.textPrimary,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  otpInput: {
    width: 56,
    height: 64,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 18,
    backgroundColor: Colors.background,
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  otpInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  otpInputActive: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  demoText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  verifyButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 24,
    marginBottom: 32,
    elevation: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  verifyButtonDisabled: {
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonGradient: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonText: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textInverse,
    letterSpacing: 1.0,
  },
  verifyButtonTextDisabled: {
    color: Colors.textMuted,
  },
  resendSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  resendButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  resendText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  timerContainer: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  timerText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundSecondary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 20,
  },
  securityIconContainer: {
    marginRight: 8,
  },
  securityIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  securityText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});

export default OtpScreen;