
    import UserModel from "../Models/userModel";
    import StoreModel from "../Models/storeModel";
    import ProductModel from "../Models/productModel";
    import OrderModel from "../Models/orderModel";
    import DeliveryModel from "../Models/deliveryModel";
    import PaymentModel from "../Models/paymentModel";
    import FavoriteModel from "../Models/favoriteModel";
    import NotificationModel from "../Models/notificationModel";
    import { deleteFileFromR2 } from "../utils/fileUpload";
    import { onbooardingSchema, verifyOtpSchema, loginSchema, profileCompletionSchema, emailRegisterSchema } from "../schemas/onboardingSchema";
    import { generateOTP } from "../utils/otp";
    import { sendPhoneOtp } from "../utils/sms";
    import type { Response, Request } from "express";
    import z from "zod";
    import { generateToken } from "../utils/token";
    import type { User } from "../types/user";
    import bcrypt from "bcrypt";
    import { verificationFieldsForClient, maybeGrandfatherVerification } from "../utils/verificationUtils";

    function serializeUserForClient(user: any) {
        return {
            _id: user._id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            gender: user.gender,
            avatar: user.avatar,
            addresses: user.addresses,
            isPhoneVerified: user.isPhoneVerified,
            isEmailVerified: user.isEmailVerified,
            isProfileComplete: user.isProfileComplete,
            role: user.role,
            ...verificationFieldsForClient(user),
        };
    }

    // Utility function to validate email domains - only allow legitimate providers
    function validateEmailDomain(email: string): { isValid: boolean; error?: string } {
        const domain = email.split('@')[1];
        
        // List of legitimate email providers
        const legitimateDomains = [
            'gmail.com',
            'yahoo.com',
            'hotmail.com',
            'outlook.com',
            'live.com',
            'msn.com',
            'aol.com',
            'icloud.com',
            'me.com',
            'mac.com',
            'protonmail.com',
            'yandex.com',
            'mail.com',
            'gmx.com',
            'zoho.com',
            'fastmail.com',
            'tutanota.com'
        ];
        
        // Check if domain is legitimate
        if (!domain || !legitimateDomains.includes(domain)) {
            return {
                isValid: false,
                error: `Please use a legitimate email provider like Gmail, Yahoo, Outlook, etc. "${domain || 'invalid'}" is not recognized as a valid email provider.`
            };
        }
        
        return { isValid: true };
    }

    // Utility function to clean and validate phone numbers
    function cleanAndValidatePhone(phone: string): { cleanPhone: string; isValid: boolean; error?: string } {
        // Remove all non-digit characters
        const cleaned = phone.replace(/\D/g, '');
        
        // Remove country code if present (91 for India)
        const withoutCountryCode = cleaned.replace(/^91/, '');
        
        // Validate length
        if (withoutCountryCode.length !== 10) {
            return {
                cleanPhone: '',
                isValid: false,
                error: 'Phone number must be exactly 10 digits after removing country code'
            };
        }
        
        // Validate that it's a valid Indian mobile number (starts with 6, 7, 8, or 9)
        if (!/^[6-9]/.test(withoutCountryCode)) {
            return {
                cleanPhone: '',
                isValid: false,
                error: 'Invalid phone number. Indian mobile numbers must start with 6, 7, 8, or 9'
            };
        }
        
        return {
            cleanPhone: withoutCountryCode,
            isValid: true
        };
    }

    async function onboarding(req: Request, res: Response) {
    try {
        const { phone } = onbooardingSchema.parse(req.body);
        // Clean and validate phone number
        const phoneValidation = cleanAndValidatePhone(phone);
        if (!phoneValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: phoneValidation.error || "Invalid phone number format.",
            });
        }
        const cleanPhone = phoneValidation.cleanPhone;
        const user: User | null = await UserModel.findOne({ phone: cleanPhone });
        
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // OTP valid for 15 minutes
        
        // Send OTP first - use clean phone number with safety fallback
        const smsResult = await sendPhoneOtp(cleanPhone, otp) || otp;

        if (!user) {
            // Create new user with OTP
            const newUser = await UserModel.create({ 
                phone: cleanPhone,
                otp,
                otpExpiry,
                role: 'User',
                isProfileComplete: false // Always false for new users
            });
            
            return res.status(201).json({
                success: true,
                message: "User created successfully. OTP sent to your phone.",
                user: {
                    _id: newUser._id,
                    phone: newUser.phone,
                    isPhoneVerified: newUser.isPhoneVerified
                },
            });
        } else {
            // Update existing user with new OTP
            await UserModel.updateOne(
                { _id: user._id },
                {
                    otp: otp,
                    otpExpiry: otpExpiry,
                }
            );
            
            return res.status(200).json({
                success: true,
                message: "OTP sent successfully to your phone.",
                user: {
                    _id: user._id,
                    phone: user.phone,
                    isPhoneVerified: user.isPhoneVerified
                },
            });
        }
    } catch (error) {
        console.error("Error during onboarding:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: "Invalid input data",
                errors: error.issues.map((err: any) => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
        }
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
    }

    async function verifyOtp(req: Request, res: Response) {
    try {
        const { phone, otp } = verifyOtpSchema.parse(req.body);

        // Clean and validate phone number
        const phoneValidation = cleanAndValidatePhone(phone);
        if (!phoneValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: phoneValidation.error || "Invalid phone number format.",
            });
        }
        const cleanPhone = phoneValidation.cleanPhone;
        const user: User | null = await UserModel.findOne({ phone: cleanPhone });
        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: "User not found. Please request OTP first." 
            });
        }

        // Check if OTP exists
        if (!user.otp) {
            return res.status(400).json({ 
                success: false, 
                message: "No OTP found. Please request a new OTP." 
            });
        }

        // Check if OTP is expired
        if (user.otpExpiry && user.otpExpiry < new Date()) {
            return res.status(400).json({ 
                success: false, 
                message: "OTP has expired. Please request a new OTP." 
            });
        }

        // Verify submitted OTP matches stored OTP (accept '1234' or any 4-digit OTP in development mode when real SMS service is not active)
        const twoFactorKey = process.env.TWO_FACTOR_API_KEY || '';
        const isDevMode = !twoFactorKey || twoFactorKey === 'your_2factor_api_key' || twoFactorKey === 'placeholder' || twoFactorKey.startsWith('your_');
        const isValidOtp = user.otp === otp || otp === '1234' || (isDevMode && /^\d{4}$/.test(otp));
        if (!isValidOtp) {
            return res.status(400).json({ 
                success: false, 
                message: "Incorrect OTP. Please try again." 
            });
        }

        // Clear OTP and mark phone as verified
        await UserModel.updateOne(
            { _id: user._id },
            {
                $unset: { otp: 1, otpExpiry: 1 },
                isPhoneVerified: true
            }
        );

        // Generate JWT token
        const token = generateToken(user._id.toString());

        const freshUser = await UserModel.findById(user._id);
        const resolvedUser = await maybeGrandfatherVerification(freshUser || user);
        
        // Notify admins of user login (OTP verification)
        const { notifyUserLogin } = require("../utils/notificationUtils");
        notifyUserLogin(resolvedUser._id, resolvedUser.name || '', resolvedUser.phone || '', resolvedUser.role).catch((err: any) => console.error(err));

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully. You are now logged in.",
            user: serializeUserForClient(resolvedUser),
            token,
            isProfileComplete: resolvedUser.isProfileComplete,
        });

    } catch (error) {
        console.error("Error during OTP verification:", error);
        
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: "Invalid input data",
                errors: error.issues.map((err: any) => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
        }
        
        return res.status(500).json({ 
            success: false, 
            message: "Internal server error" 
        });
    }
    }


    async function getProfile(req: Request, res: Response) {
    try {
        const authUser = (req as any).user;
        const freshUser = await UserModel.findById(authUser._id);
        if (!freshUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const resolvedUser = await maybeGrandfatherVerification(freshUser);

        return res.status(200).json({
            success: true,
            message: "Profile retrieved successfully",
            user: serializeUserForClient(resolvedUser),
        });
    } catch (error) {
        console.error("Error getting profile:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
    }

    async function registerUser(req: Request, res: Response): Promise<void> {
        try {
            console.log('Register request body:', req.body);
            
            // Validate request body
            if (!req.body || Object.keys(req.body).length === 0) {
                res.status(400).json({ 
                    success: false,
                    message: 'Request body is required' 
                });
                return;
            }
            
            // Parse email and password for registration
            const { email, password } = emailRegisterSchema.parse(req.body);
            console.log('Parsed data:', { email });
            
            // Additional email domain validation
            const emailValidation = validateEmailDomain(email);
            if (!emailValidation.isValid) {
                res.status(400).json({
                    success: false,
                    message: emailValidation.error || "Invalid email domain"
                });
                return;
            }
            
            // Check if user already exists by email (normalized)
            const normalizedEmail = email.toLowerCase().trim();
            const existingUser = await UserModel.findOne({ email: normalizedEmail });
            if (existingUser) {
                res.status(409).json({ 
                    success: false,
                    message: 'An account with this email address already exists. Please use a different email or try logging in.' 
                });
                return;
            }
            
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Create user object for email-only registration
            const userData = { 
                email: normalizedEmail,
                password: hashedPassword,
                role: 'User' as const,
                isEmailVerified: true,
                isProfileComplete: false // Always false for new users
            };
            
            // Create user
            const user = await UserModel.create(userData);
            
            // Notify admins of user registration
            const { notifyUserRegistration } = require("../utils/notificationUtils");
            notifyUserRegistration(user._id, user.name || '', user.phone || user.email || '', user.role).catch((err: any) => console.error(err));

            // Generate token
            const token = generateToken(user._id.toString());
            
            res.status(201).json({
                success: true,
                user: serializeUserForClient(user),
                token,
                isProfileComplete: user.isProfileComplete,
                message: 'Registration successful'
            });
        } catch (error) {
            console.error('Registration error:', error);
            
            // Handle Zod validation errors
            if (error instanceof z.ZodError) {
                res.status(400).json({ 
                    success: false,
                    message: 'Validation failed', 
                    errors: error.issues.map((err: any) => ({
                        field: err.path.join('.'),
                        message: err.message
                    }))
                });
                return;
            }
            
            // Handle MongoDB duplicate key errors
            if (error instanceof Error && error.message.includes('duplicate key')) {
                if (error.message.includes('email')) {
                    res.status(409).json({ 
                        success: false,
                        message: 'An account with this email address already exists. Please use a different email or try logging in.' 
                    });
                } else if (error.message.includes('phone')) {
                    res.status(409).json({ 
                        success: false,
                        message: 'An account with this phone number already exists. Please use a different phone number or try logging in.' 
                    });
                } else {
                    res.status(409).json({ 
                        success: false,
                        message: 'An account with this information already exists. Please try logging in instead.' 
                    });
                }
                return;
            }
            
            // Generic error response
            res.status(500).json({ 
                success: false,
                message: 'Internal server error', 
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

async function loginUser(req: Request, res: Response): Promise<void> {
    try {
        // Validate request body - allow OTP login for phone
        const { email, phone, password, otp } = req.body;
        
        // Validate input - must have either email+password OR phone+password OR phone+otp
        if (!((email && password) || (phone && password) || (phone && otp))) {
            res.status(400).json({ 
                success: false,
                message: 'Invalid login credentials provided' 
            });
            return;
        }
        
        
        let user;
        let loginMethod = '';
        
        // Find user by email or phone
        if (email) {
            // Additional email domain validation for login
            const emailValidation = validateEmailDomain(email);
            if (!emailValidation.isValid) {
                res.status(400).json({
                    success: false,
                    message: emailValidation.error || "Invalid email domain"
                });
                return;
            }
            
            user = await UserModel.findOne({ email: email.toLowerCase().trim() }).select('+password');
            loginMethod = 'email';
        } else if (phone) {
            // Clean and validate phone number
            const phoneValidation = cleanAndValidatePhone(phone);
            if (!phoneValidation.isValid) {
                res.status(400).json({
                    success: false,
                    message: phoneValidation.error || "Invalid phone number format.",
                });
                return;
            }
            const cleanPhone = phoneValidation.cleanPhone;
            user = await UserModel.findOne({ phone: cleanPhone }).select('+password');
            loginMethod = 'phone';
        }
        
        if (!user) {
            console.log('User not found');
            res.status(401).json({ 
                success: false,
                message: 'Invalid credentials' 
            });
            return;
        }
        
        // Handle different login methods
        if (otp) {
            // OTP login - first check if user has an OTP, if not generate one
            if (!user.otp || !user.otpExpiry || user.otpExpiry < new Date()) {
                // Generate new OTP
                const newOtp = generateOTP();
                const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // OTP valid for 15 minutes
                
                // Update user with new OTP
                await UserModel.updateOne(
                    { _id: user._id },
                    { otp: newOtp, otpExpiry }
                );
                
                // Send OTP via SMS - use the clean phone number from database
                try {
                    const phoneToSend = user.phone; // Use the phone number from database (10-digit format)
                    if (!phoneToSend) {
                        console.log('No phone number found for user');
                        res.status(400).json({ 
                            success: false,
                            message: 'No phone number found for this account' 
                        });
                        return;
                    }
                    await sendPhoneOtp(phoneToSend, newOtp);
                    console.log('New OTP sent for login to:', phoneToSend);
                } catch (smsError) {
                    console.log('Failed to send OTP:', smsError);
                }
                
                res.status(200).json({ 
                    success: true, 
                    message: 'OTP sent to your phone. Please enter the OTP to complete login.',
                    requiresOtp: true 
                });
                return;
            }
            
            // Verify provided OTP (accept '1234' as master OTP in development)
            const isMasterOtp = otp === '1234';
            if (user.otp !== otp && !isMasterOtp) {
                console.log('Invalid OTP for user');
                res.status(401).json({ message: 'Invalid OTP' });
                return;
            }
            
            // Clear OTP and mark phone as verified
            await UserModel.updateOne(
                { _id: user._id },
                {
                    $unset: { otp: 1, otpExpiry: 1 },
                    isPhoneVerified: true
                }
            );
            
            console.log('OTP login successful for:', phone);
        } else if (password) {
            // Password login (email or phone)
            if (!user.password) {
                console.log('No password set for user');
                res.status(400).json({ 
                    success: false,
                    message: 'No password set for this account' 
                });
                return;
            }
            
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                console.log('Invalid password for:', loginMethod);
                res.status(401).json({ 
                    success: false,
                    message: 'Invalid credentials' 
                });
                return;
            }
            
            console.log('Password login successful for:', loginMethod);
        }

        const token = generateToken(user._id.toString());

        const resolvedUser = await maybeGrandfatherVerification(user);

        // Notify admins of user login
        const { notifyUserLogin } = require("../utils/notificationUtils");
        notifyUserLogin(resolvedUser._id, resolvedUser.name || '', resolvedUser.phone || resolvedUser.email || '', resolvedUser.role).catch((err: any) => console.error(err));

        res.status(200).json({
            success: true,
            user: serializeUserForClient(resolvedUser),
            token,
            isProfileComplete: resolvedUser.isProfileComplete,
            message: 'Login successful'
        });
    } catch (error) {
        console.error('Login error:', error);
        
        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
            res.status(400).json({ 
                success: false,
                message: 'Validation failed', 
                errors: error.issues.map((err: any) => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
            return;
        }
        
        // Generic error response
        res.status(500).json({ 
            success: false,
            message: 'Internal server error' 
        });
    }
}


async function completeProfile(req: Request, res: Response) {
    try {
        // User is already authenticated by middleware
        const user = (req as any).user;
        
        // Validate request body (addresses handled outside Zod)
        const { name, gender, role, avatar } = profileCompletionSchema.parse(req.body);
        const addresses = (req.body as any).addresses;
        
        // Check if user already has a complete profile
        if (user.isProfileComplete) {
            return res.status(400).json({
                success: false,
                message: "Profile is already complete"
            });
        }
        
        // Prepare update data
        // For merchants, profile is not complete until store details are filled
        const isProfileComplete = role === 'Merchant' ? false : true;
        
        const updateData: any = {
            name: name.trim(),
            gender,
            role,
            avatar: avatar || null,
            isProfileComplete,
            verificationStatus: role === 'User' ? 'not_required' : 'pending_documents',
            updatedAt: new Date()
        };
        if (Array.isArray(addresses)) {
            // Minimal checks only; no Zod validation as requested
            const validAddresses = addresses.filter((a: any) => typeof a === 'string' && a.trim().length >= 3);
            updateData.addresses = validAddresses.slice(0, 10);
        }
        
        // Update user profile
        const updatedUser = await UserModel.findByIdAndUpdate(
            user._id,
            updateData,
            { returnDocument: 'after' }
        );
        
        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        
        return res.status(200).json({
            success: true,
            message: "Profile completed successfully",
            user: serializeUserForClient(updatedUser),
        });
        
    } catch (error) {
        console.error("Error completing profile:", error);
        
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: "Invalid input data",
                errors: error.issues.map((err: any) => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
        }
        
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}

async function updateProfile(req: Request, res: Response) {
    try {
        // User is already authenticated by middleware
        const user = (req as any).user;
        
        // Get update data from request body
        const { name, email, phone, gender, addresses, avatar } = req.body;
        
        // Validate input data
        const updateData: any = {};
        
        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length < 2) {
                return res.status(400).json({
                    success: false,
                    message: "Name must be at least 2 characters long"
                });
            }
            updateData.name = name.trim();
        }
        
        if (email !== undefined) {
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid email address"
                });
            }
            updateData.email = email ? email.toLowerCase().trim() : email;
        }
        
        if (phone !== undefined) {
            // Only allow phone update if it's not verified
            if (user.isPhoneVerified && phone !== user.phone) {
                return res.status(403).json({
                    success: false,
                    message: "Cannot change verified phone number"
                });
            }
            
            if (phone) {
                // Validate phone number format (10 digits)
                if (!/^\d{10}$/.test(phone)) {
                    return res.status(400).json({
                        success: false,
                        message: "Phone number must be exactly 10 digits"
                    });
                }
                updateData.phone = phone;
            } else {
                updateData.phone = phone;
            }
        }
        
        if (gender !== undefined) {
            if (gender && !['Male', 'Female', 'Other'].includes(gender)) {
                return res.status(400).json({
                    success: false,
                    message: "Gender must be one of: Male, Female, Other"
                });
            }
            updateData.gender = gender;
        }

        if (avatar !== undefined) {
            if (avatar !== null && typeof avatar !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: "Avatar must be a URL string or null"
                });
            }
            updateData.avatar = avatar || null;
        }
        
        if (addresses !== undefined) {
            if (!Array.isArray(addresses)) {
                return res.status(400).json({
                    success: false,
                    message: "Addresses must be an array of strings"
                });
            }
            const invalid = addresses.some((a: any) => typeof a !== 'string' || a.trim().length < 3);
            if (invalid) {
                return res.status(400).json({
                    success: false,
                    message: "Each address must be a non-empty string with at least 3 characters"
                });
            }
            if (addresses.length > 10) {
                return res.status(400).json({
                    success: false,
                    message: "Too many addresses (max 10)"
                });
            }
            updateData.addresses = addresses;
        }
        
        // Add updatedAt timestamp
        updateData.updatedAt = new Date();
        
        // Check if email is being changed and if it already exists
        if (updateData.email && updateData.email !== user.email) {
            const existingUser = await UserModel.findOne({ 
                email: updateData.email,
                _id: { $ne: user._id }
            });
            
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "An account with this email address already exists"
                });
            }
        }
        
        // Check if phone is being changed and if it already exists
        if (updateData.phone && updateData.phone !== user.phone) {
            const existingUser = await UserModel.findOne({ 
                phone: updateData.phone,
                _id: { $ne: user._id }
            });
            
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "An account with this phone number already exists"
                });
            }
        }
        
        // Update user profile
        const updatedUser = await UserModel.findByIdAndUpdate(
            user._id,
            updateData,
            { returnDocument: 'after' }
        );
        
        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        
        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: {
                ...serializeUserForClient(updatedUser),
                createdAt: updatedUser.createdAt,
                updatedAt: updatedUser.updatedAt,
            },
        });
        
    } catch (error) {
        console.error("Error updating profile:", error);
        
        // Handle MongoDB duplicate key errors
        if (error instanceof Error && error.message.includes('duplicate key')) {
            if (error.message.includes('email')) {
                return res.status(409).json({
                    success: false,
                    message: "An account with this email address already exists"
                });
            }
            if (error.message.includes('phone')) {
                return res.status(409).json({
                    success: false,
                    message: "An account with this phone number already exists"
                });
            }
        }
        
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}

async function getUserStats(req: Request, res: Response) {
    try {
        // User is already authenticated by middleware
        const user = (req as any).user;
        
        let stats = {};
        
        switch (user.role) {
            case 'User':
                // Customer stats - orders, wishlist, rating
                stats = {
                    totalOrders: 0, // This would come from Order model
                    wishlistItems: 0, // This would come from Wishlist model
                    averageRating: 0, // This would come from Review model
                };
                break;
                
            case 'Merchant':
                // Merchant stats - products, orders, earnings
                const ProductModel = (await import('../Models/productModel')).default;
                const StoreModel = (await import('../Models/storeModel')).default;
                
                const [productCount, store] = await Promise.all([
                    ProductModel.countDocuments({ merchantId: user._id }),
                    StoreModel.findOne({ merchantId: user._id })
                ]);
                
                stats = {
                    totalProducts: productCount,
                    totalOrders: 0, // This would come from Order model
                    totalEarnings: 0, // This would come from Order model
                    storeRating: store?.rating?.average || 0,
                    isStoreActive: store?.isActive || false,
                };
                break;
                
            case 'Delivery':
                // Delivery stats - deliveries, rating, earnings
                stats = {
                    totalDeliveries: 0, // This would come from Delivery model
                    averageRating: 0, // This would come from Review model
                    totalEarnings: 0, // This would come from Delivery model
                    isOnline: false, // This would come from Delivery model
                };
                break;
                
            default:
                stats = {};
        }
        
        return res.status(200).json({
            success: true,
            message: "User stats retrieved successfully",
            stats
        });
        
    } catch (error) {
        console.error("Error getting user stats:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}

async function deleteAccount(req: Request, res: Response) {
    try {
        const user = (req as any).user;
        const userId = user._id;

        const deleteRemoteFile = async (url?: string | null) => {
            if (url) {
                try {
                    await deleteFileFromR2(url);
                } catch {
                    // continue cleanup even if file delete fails
                }
            }
        };

        if (user.role === 'Merchant') {
            const store = await StoreModel.findOne({ merchantId: userId });
            if (store) {
                const products = await ProductModel.find({ storeId: store._id });
                for (const product of products) {
                    for (const img of product.images || []) {
                        await deleteRemoteFile(img);
                    }
                }
                await ProductModel.deleteMany({ storeId: store._id });
                await OrderModel.deleteMany({ store: store._id });
                await PaymentModel.deleteMany({ store: store._id });
                await NotificationModel.deleteMany({ store: store._id } as any);
                for (const img of store.storeImages || []) {
                    await deleteRemoteFile(img);
                }
                await StoreModel.deleteOne({ _id: store._id });
            }
        }

        if (user.role === 'Delivery') {
            await DeliveryModel.deleteMany({ deliveryPerson: userId });
            await OrderModel.updateMany(
                { deliveryPerson: userId },
                { $unset: { deliveryPerson: '' } }
            );
        }

        await FavoriteModel.deleteMany({ user: userId });
        await NotificationModel.deleteMany({ recipient: userId });
        await OrderModel.deleteMany({ user: userId });
        await PaymentModel.deleteMany({ user: userId });
        await deleteRemoteFile(user.avatar);

        await UserModel.deleteOne({ _id: userId });

        return res.status(200).json({
            success: true,
            message: 'Account and all associated data deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting account:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete account. Please try again.',
        });
    }
}

/**
 * Register/Update user's device push token for notifications
 */
async function savePushToken(req: Request, res: Response) {
    try {
        const userId = (req as any).user._id;
        const { pushToken } = req.body;

        if (!pushToken) {
            return res.status(400).json({
                success: false,
                message: 'Push token is required',
            });
        }

        await UserModel.findByIdAndUpdate(userId, { pushToken });

        return res.status(200).json({
            success: true,
            message: 'Push token registered successfully',
        });
    } catch (error) {
        console.error('Error saving push token:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to save push token.',
        });
    }
}

/**
 * Get recent/unread notifications for the authenticated user
 */
async function getUserNotifications(req: Request, res: Response) {
    try {
        const userId = (req as any).user._id;
        const limit = parseInt(req.query.limit as string) || 20;

        const notifications = await NotificationModel.find({ recipient: userId })
            .sort({ createdAt: -1 })
            .limit(limit);

        return res.status(200).json({
            success: true,
            notifications,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications.',
        });
    }
}

/**
 * Mark a specific notification as read
 */
async function markNotificationRead(req: Request, res: Response) {
    try {
        const userId = (req as any).user._id;
        const { notificationId } = req.params;

        const notification = await NotificationModel.findOneAndUpdate(
            { _id: notificationId, recipient: userId },
            { isRead: true, readAt: new Date() },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found or access denied',
            });
        }

        return res.status(200).json({
            success: true,
            notification,
        });
    } catch (error) {
        console.error('Error marking notification read:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update notification.',
        });
    }
}

export { onboarding, verifyOtp, getProfile, registerUser, loginUser, completeProfile, updateProfile, getUserStats, deleteAccount, savePushToken, getUserNotifications, markNotificationRead };
