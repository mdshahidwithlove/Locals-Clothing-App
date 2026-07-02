import Settings from "../Models/settingsModel";

let configCache: Record<string, string> = {};

const DEFAULT_SETTINGS_KEYS = [
  { key: "RAZORPAY_KEY_ID", description: "Razorpay Payment Gateway Key ID" },
  { key: "RAZORPAY_KEY_SECRET", description: "Razorpay Payment Gateway Key Secret" },
  { key: "TWO_FACTOR_API_KEY", description: "2Factor.in SMS OTP API Key" },
  { key: "GOOGLE_MAPS_API_KEY", description: "Google Maps Platform Geocoding & Directions API Key" },
  { key: "SUPABASE_URL", description: "Supabase Project URL" },
  { key: "SUPABASE_ANON_KEY", description: "Supabase Anon API Key" },
  { key: "SUPABASE_BUCKET_NAME", description: "Supabase Storage Bucket Name" },
];

/**
 * Loads all settings from the database and updates the in-memory cache.
 */
export async function loadConfigCache(): Promise<void> {
  try {
    const count = await Settings.countDocuments({});
    if (count === 0) {
      console.log("[ConfigService] No settings found in database. Initializing with default environment values...");
      const settingsToCreate = DEFAULT_SETTINGS_KEYS.map((item) => {
        const val = process.env[item.key] || "placeholder";
        return {
          key: item.key,
          value: val,
          description: item.description,
          isEncrypted: item.key.includes("SECRET") || item.key.includes("KEY") || item.key.includes("TOKEN")
        };
      });
      await Settings.insertMany(settingsToCreate);
    }

    const allSettings = await Settings.find({});
    const newCache: Record<string, string> = {};
    allSettings.forEach((setting) => {
      newCache[setting.key] = setting.value;
    });
    configCache = newCache;
    console.log(`[ConfigService] Configuration cache loaded with ${allSettings.length} keys from database`);
  } catch (error) {
    console.error("[ConfigService] Error loading configuration cache:", error);
  }
}

/**
 * Get configuration value by key.
 * Resolves in the following priority:
 * 1. Database settings cache
 * 2. Environment variables (process.env)
 * 3. Default value provided
 */
export function getConfig(key: string, defaultValue = ""): string {
  const val = configCache[key] ?? process.env[key] ?? defaultValue;
  return val;
}
