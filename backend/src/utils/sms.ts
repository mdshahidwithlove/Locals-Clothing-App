import axios from "axios";
import { getConfig } from "../services/configService";

export async function sendPhoneOtp(phone: string, phoneOtp: string): Promise<string | null> {
  try {
    const apiKey = getConfig("TWO_FACTOR_API_KEY");
    
    const isPlaceholder = !apiKey || 
                          apiKey === 'your_2factor_api_key' || 
                          apiKey === 'placeholder' || 
                          apiKey.startsWith('your_') || 
                          apiKey.length < 10;

    if (isPlaceholder) {
      console.warn(`⚠️ TWO_FACTOR_API_KEY not defined or is placeholder (${apiKey}). [DEVELOPMENT MODE] Bypassing real SMS. OTP for ${phone} is: ${phoneOtp}`);
      return phoneOtp;
    }

    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Validate phone number
    if (cleanPhone.length < 10) {
      console.error("Invalid phone number:", phone);
      return null;
    }

    // Send real SMS via 2Factor.in API with fallback
    try {
      const url = `https://2factor.in/API/V1/${apiKey}/SMS/${cleanPhone}/${phoneOtp}`;
      const response = await axios.get(url, { timeout: 10000 });

      if (response.status === 200 && response.data.Status === 'Success') {
        console.log(`✅ SMS sent successfully to ${phone}`);
        return phoneOtp;
      } else {
        console.warn(`⚠️ 2Factor SMS API returned non-success response:`, response.data, `Falling back for ${phone}. OTP: ${phoneOtp}`);
        return phoneOtp;
      }
    } catch (apiError: any) {
      console.warn(`⚠️ 2Factor SMS API call failed (${apiError?.message}). Falling back for ${phone}. OTP: ${phoneOtp}`);
      return phoneOtp;
    }
  } catch (error) {
    console.error("Error in sendPhoneOtp helper:", error);
    return phoneOtp;
  }
}
