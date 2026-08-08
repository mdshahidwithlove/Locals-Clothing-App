import axios from "axios";
import { getConfig } from "../services/configService";

export async function sendPhoneOtp(phone: string, phoneOtp: string): Promise<string | null> {
  try {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      console.error("Invalid phone number:", phone);
      return null;
    }

    const twoFactorKey = getConfig("TWO_FACTOR_API_KEY") || process.env.TWO_FACTOR_API_KEY;
    const fast2smsKey = getConfig("FAST2SMS_API_KEY") || process.env.FAST2SMS_API_KEY;

    // 1. Try Fast2SMS (No DLT required for OTP route in India)
    if (fast2smsKey && fast2smsKey.length > 5 && !fast2smsKey.startsWith('your_')) {
      try {
        const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${fast2smsKey}&route=otp&variables_values=${phoneOtp}&flash=0&numbers=${cleanPhone.slice(-10)}`;
        const res = await axios.get(url, { timeout: 3000 });
        if (res.data && res.data.return) {
          console.log(`✅ Fast2SMS OTP sent successfully to ${phone}`);
          return phoneOtp;
        }
      } catch (err: any) {
        console.warn(`Fast2SMS API error: ${err?.message}`);
      }
    }

    // 2. Try 2Factor.in API
    if (twoFactorKey && twoFactorKey.length > 5 && !twoFactorKey.startsWith('your_')) {
      try {
        const url = `https://2factor.in/API/V1/${twoFactorKey}/SMS/${cleanPhone}/${phoneOtp}`;
        const res = await axios.get(url, { timeout: 3000 });
        if (res.status === 200 && res.data.Status === 'Success') {
          console.log(`✅ 2Factor SMS sent successfully to ${phone}`);
          return phoneOtp;
        }
      } catch (err: any) {
        console.warn(`2Factor API error: ${err?.message}`);
      }
    }

    // Development Mode Fallback
    console.warn(`⚠️ SMS Gateway Key not defined in .env. [DEVELOPMENT MODE] OTP for ${phone} is: ${phoneOtp}`);
    return phoneOtp;
  } catch (error) {
    console.error("Error in sendPhoneOtp helper:", error);
    return phoneOtp;
  }
}
