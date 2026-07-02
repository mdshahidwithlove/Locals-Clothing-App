import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "https://your-supabase-project.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "your-supabase-anon-key";

// Initialize the Supabase Client
export const supabase = createClient(supabaseUrl, supabaseKey);

console.log("[Supabase] Client initialized successfully");
