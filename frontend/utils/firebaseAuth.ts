import { auth } from '../config/firebase';
import { signInWithPhoneNumber, RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';

let confirmationResultStore: ConfirmationResult | null = null;

export const sendFirebaseOtp = async (phoneNumber: string, recaptchaContainerId: string = 'recaptcha-container'): Promise<boolean> => {
  try {
    const cleanDigits = phoneNumber.replace(/\D/g, '');
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${cleanDigits}`;
    
    // Check if window and DOM exist (Web/Expo)
    if (typeof window !== 'undefined') {
      if (!(window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
          size: 'invisible',
          callback: () => {},
        });
      }

      const appVerifier = (window as any).recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      confirmationResultStore = confirmation;
      return true;
    }
    return false;
  } catch (error: any) {
    console.error('Firebase OTP send error:', error);
    // Reset recaptcha on error so user can retry
    if (typeof window !== 'undefined' && (window as any).recaptchaVerifier) {
      try {
        (window as any).recaptchaVerifier.clear();
        (window as any).recaptchaVerifier = null;
      } catch (e) {}
    }
    throw error;
  }
};

export const verifyFirebaseOtp = async (otpCode: string): Promise<boolean> => {
  try {
    if (!confirmationResultStore) {
      throw new Error('No active OTP session. Please request OTP again.');
    }
    const result = await confirmationResultStore.confirm(otpCode);
    return !!result.user;
  } catch (error: any) {
    console.error('Firebase OTP verify error:', error);
    throw error;
  }
};
