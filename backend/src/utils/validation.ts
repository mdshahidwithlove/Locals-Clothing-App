import type { Response } from "express";

// Common validation constants
export const VALIDATION_CONSTANTS = {
  CATEGORIES: ["Men", "Women", "Kids", "Unisex"],
  SUBCATEGORIES: [
    "Shirts", "Jeans", "Lower", "T-Shirts", "Footwear", "Pants", "Shorts", "Accessories", "Undergarments",
    "Dresses", "Tops", "Sarees", "Kurtas", "Skirts", "Leggings",
    "Jackets", "Hoodies", "Sweatshirts", "Sweaters", "Cardigans", "Blazers", "Coats", "Suits",
    "Underwear", "Sleepwear", "Activewear", "Swimwear", "Ethnic Wear"
  ],
  WORKING_DAYS: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  ORDER_STATUSES: ["Pending", "Accepted", "Rejected", "Processing", "ReadyForPickup", "Assigned", "PickedUp", "OnTheWay", "Shipped", "Delivered", "Cancelled"],
  DELIVERY_STATUSES: ["Pending", "Accepted", "PickedUp", "OnTheWay", "Delivered", "Cancelled"],
  PAYMENT_METHODS: ["COD", "Online"]
};

// Common error response helper
export const sendErrorResponse = (res: Response, statusCode: number, message: string) => {
  return res.status(statusCode).json({
    success: false,
    message
  });
};

// Role validation helpers
export const validateMerchantRole = (user: any, res: Response): boolean => {
  if (user.role !== 'Merchant') {
    sendErrorResponse(res, 403, "Only merchants can perform this action");
    return false;
  }
  return true;
};

export const validateUserRole = (user: any, res: Response): boolean => {
  if (user.role !== 'User') {
    sendErrorResponse(res, 403, "Only customers can perform this action");
    return false;
  }
  return true;
};

export const validateDeliveryRole = (user: any, res: Response): boolean => {
  if (user.role !== 'Delivery') {
    sendErrorResponse(res, 403, "Only delivery personnel can perform this action");
    return false;
  }
  return true;
};

// Field validation helpers
export const validateRequiredField = (value: any, fieldName: string, minLength?: number): string | null => {
  if (!value) {
    return `${fieldName} is required`;
  }
  if (typeof value === 'string' && minLength && value.trim().length < minLength) {
    return `${fieldName} must be at least ${minLength} characters long`;
  }
  return null;
};

export const validateEnumValue = (value: any, validValues: string[], fieldName: string): string | null => {
  if (!validValues.includes(value)) {
    return `${fieldName} must be one of: ${validValues.join(', ')}`;
  }
  return null;
};

export const validatePositiveNumber = (value: any, fieldName: string): string | null => {
  if (value === undefined || value === null) {
    return `${fieldName} is required`;
  }
  if (typeof value !== 'number' || value <= 0) {
    return `Valid ${fieldName.toLowerCase()} is required`;
  }
  return null;
};

export const validateNonNegativeNumber = (value: any, fieldName: string): string | null => {
  if (value === undefined || value === null) {
    return `${fieldName} is required`;
  }
  if (typeof value !== 'number' || value < 0) {
    return `${fieldName} cannot be negative`;
  }
  return null;
};

export const validateArrayNotEmpty = (value: any, fieldName: string): string | null => {
  if (!Array.isArray(value) || value.length === 0) {
    return `At least one ${fieldName.toLowerCase()} is required`;
  }
  return null;
};

// Contact validation helpers
export const validatePhoneNumber = (phone: string): string | null => {
  if (phone && (phone.length < 10 || phone.length > 12)) {
    return "Phone number must be between 10-12 digits";
  }
  return null;
};

export const validateEmail = (email: string): string | null => {
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Please provide a valid email address";
  }
  return null;
};

export const validateUrl = (url: string, fieldName: string = "URL"): string | null => {
  if (url && !/^https?:\/\/.+/.test(url)) {
    return `${fieldName} must be a valid URL starting with http:// or https://`;
  }
  return null;
};

// Discount validation
export const validateDiscountPercentage = (discountPercentage: any): string | null => {
  if (discountPercentage !== undefined && (discountPercentage < 0 || discountPercentage > 100)) {
    return "Discount percentage must be between 0 and 100";
  }
  return null;
};

// Working days validation
export const validateWorkingDays = (workingDays: any): string | null => {
  if (!workingDays) return null;
  
  const validDays = VALIDATION_CONSTANTS.WORKING_DAYS;
  const providedDays = Object.keys(workingDays);
  
  // Check if all provided days are valid
  const invalidDays = providedDays.filter(day => !validDays.includes(day));
  if (invalidDays.length > 0) {
    return `Invalid working days: ${invalidDays.join(', ')}`;
  }
  
  // Check if at least one day is selected
  const hasWorkingDays = Object.values(workingDays).some(day => day === true);
  if (!hasWorkingDays) {
    return "Please select at least one working day";
  }
  
  return null;
};

// Generic validation runner
export const runValidations = (validations: (() => string | null)[]): string | null => {
  for (const validation of validations) {
    const error = validation();
    if (error) return error;
  }
  return null;
};

// Common validation patterns
export const validateProductData = (data: any) => {
  const validations = [
    () => validateRequiredField(data.name, "Product name", 2),
    () => validateRequiredField(data.category, "Category"),
    () => validateEnumValue(data.category, VALIDATION_CONSTANTS.CATEGORIES, "Category"),
    () => validateRequiredField(data.subcategory, "Subcategory"),
    () => validateEnumValue(data.subcategory, VALIDATION_CONSTANTS.SUBCATEGORIES, "Subcategory"),
    () => validatePositiveNumber(data.price, "Price"),
    () => validateNonNegativeNumber(data.availableQuantity, "Available quantity"),
    () => validateArrayNotEmpty(data.images, "Product image"),
    () => validateDiscountPercentage(data.discountPercentage)
  ];
  
  return runValidations(validations);
};

export const validateStoreData = (data: any) => {
  const validations = [
    () => validateRequiredField(data.storeName, "Store name", 2),
    () => validateRequiredField(data.address, "Address", 5),
    () => validateRequiredField(data.mapLink, "Map link"),
    () => validatePhoneNumber(data.contact?.phone),
    () => validateEmail(data.contact?.email),
    () => validateUrl(data.contact?.website, "Website"),
    () => validateWorkingDays(data.workingDays)
  ];
  
  return runValidations(validations);
};

export const validateContactInfo = (contact: any) => {
  if (!contact) return null;
  
  const validations = [
    () => validatePhoneNumber(contact.phone),
    () => validateEmail(contact.email),
    () => validateUrl(contact.website, "Website")
  ];
  
  return runValidations(validations);
};
