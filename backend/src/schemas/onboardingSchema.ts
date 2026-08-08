import z from "zod";

// Phone number validation for 10-digit Indian mobile numbers
const phoneSchema = z.string()
    .min(10, "Phone number must be exactly 10 digits")
    .max(10, "Phone number must be exactly 10 digits")
    .regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number format (must start with 6, 7, 8, or 9)")
    .transform((phone) => {
        // Clean phone number - remove all non-digit characters
        const cleaned = phone.replace(/\D/g, '');
        // Return clean 10-digit number
        return cleaned;
    });

// Email validation
const emailSchema = z.string()
    .min(1, "Email is required")
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address")
    .max(320, "Email is too long");

// Password validation for registration
const passwordRegisterSchema = z.string()
    .min(6, "Password must be at least 6 characters long")
    .max(128, "Password is too long");

// Password validation for login
const passwordLoginSchema = z.string()
    .min(1, "Password is required")
    .max(128, "Password is too long");

export const onbooardingSchema = z.object({
    phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
    phone: phoneSchema,
    otp: z.string()
        .length(4, "OTP must be exactly 4 characters long")
        .regex(/^\d{4}$/, "OTP must contain only digits"),
});

// Email/Password registration schema (legacy)
export const emailRegisterSchemaLegacy = z.object({
    email: emailSchema,
    password: passwordRegisterSchema,
});

// Email/Password login schema
export const emailLoginSchema = z.object({
    email: emailSchema,
    password: passwordLoginSchema,
});

// Unified login schema (supports email+password or phone+password)
export const loginSchema = z.object({
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    password: passwordLoginSchema,
}).refine((data) => {
    // Must have either email OR phone
    return data.email || data.phone;
}, {
    message: "Either email or phone number is required for login",
    path: ["email", "phone"]
});

// Email-only registration schema (simplified)
export const emailRegisterSchema = z.object({
    email: emailSchema,
    password: passwordRegisterSchema,
});

// Profile completion schema
export const profileCompletionSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters long").trim(),
    gender: z.enum(["Male", "Female", "Other"], {
        message: "Gender must be Male, Female, or Other"
    }),
    role: z.enum(["User", "Merchant", "Delivery"], {
        message: "Role must be User, Merchant, or Delivery"
    }),
    avatar: z.string().url("Avatar must be a valid URL").optional(),
});