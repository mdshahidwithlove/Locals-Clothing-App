import type { Request, Response } from "express";
import Settings from "../Models/settingsModel";
import { loadConfigCache, getConfig } from "../services/configService";
import { initializeRazorpay } from "../controllers/paymentController";

/**
 * Get all system settings (mask sensitive keys slightly for UI representation)
 */
export async function getSettings(req: Request, res: Response) {
  try {
    const settings = await Settings.find({}).sort({ key: 1 });
    
    // Mask sensitive credentials so they are not fully exposed in plain text in UI
    const maskedSettings = settings.map((s) => {
      const obj = s.toObject();
      if (s.isEncrypted && s.value) {
        // Show only first 6 and last 4 characters, mask the rest
        const val = s.value;
        if (val.length > 10) {
          obj.value = `${val.substring(0, 6)}...${val.substring(val.length - 4)}`;
        } else {
          obj.value = "******";
        }
      }
      return obj;
    });

    return res.status(200).json({
      success: true,
      settings: maskedSettings,
    });
  } catch (error) {
    console.error("Error getting settings:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching settings",
    });
  }
}

/**
 * Update multiple settings at once
 */
export async function updateSettings(req: Request, res: Response) {
  try {
    const { settings } = req.body; // Expect array: [{ key: "RAZORPAY_KEY_ID", value: "..." }]

    if (!settings || !Array.isArray(settings)) {
      return res.status(400).json({
        success: false,
        message: "Invalid settings format. Expected an array of key-value pairs.",
      });
    }

    let updatedCount = 0;

    for (const item of settings) {
      const { key, value } = item;
      if (!key) continue;

      // Skip placeholder or fully masked inputs (e.g. "******" or containing "...")
      if (value === "******" || (value && value.includes("..."))) {
        continue;
      }

      await Settings.findOneAndUpdate(
        { key },
        { value },
        { upsert: true, new: true }
      );
      updatedCount++;
    }

    // Reload the config service cache in memory
    await loadConfigCache();

    // Re-initialize Razorpay if credentials changed
    const razorpayKeyId = getConfig("RAZORPAY_KEY_ID") || getConfig("RAZORPAY_KEYID");
    const razorpayKeySecret = getConfig("RAZORPAY_KEY_SECRET") || getConfig("RAZORPAY_API_SECRET");

    if (razorpayKeyId && razorpayKeySecret) {
      initializeRazorpay(razorpayKeyId, razorpayKeySecret);
      console.log("[SettingsController] Re-initialized Razorpay with updated credentials");
    }

    return res.status(200).json({
      success: true,
      message: `Successfully updated ${updatedCount} settings`,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating settings",
    });
  }
}
