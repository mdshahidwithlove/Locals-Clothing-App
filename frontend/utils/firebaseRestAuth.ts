import axios from 'axios';

const FIREBASE_API_KEY = "AIzaSyDs1LdPhLRYv7suAyBRgYFZFChhgZJiEhc";

export const verifyFirebaseCode = async (verificationId: string, code: string): Promise<any> => {
  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${FIREBASE_API_KEY}`;
    const response = await axios.post(url, {
      sessionInfo: verificationId,
      code: code.trim(),
    });

    if (response.data && response.data.idToken) {
      return {
        success: true,
        phoneNumber: response.data.phoneNumber,
        idToken: response.data.idToken,
      };
    }
    return { success: false, message: 'Invalid verification code' };
  } catch (error: any) {
    console.error('Firebase verify code error:', error.response?.data || error.message);
    const msg = error.response?.data?.error?.message || 'Invalid or expired OTP code';
    return { success: false, message: msg };
  }
};
