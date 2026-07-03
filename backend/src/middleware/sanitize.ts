import type { Request, Response, NextFunction } from "express";

/**
 * Input sanitization middleware to prevent XSS and injection attacks
 * 
 * This middleware sanitizes string inputs by:
 * 1. Trimming whitespace
 * 2. Removing/escaping dangerous HTML/JavaScript characters
 * 3. Preventing common injection patterns
 */

/**
 * Sanitize a single string value
 */
function sanitizeString(value: string): string {
  if (typeof value !== 'string') return value;
  
  // If the value is a URL, bypass HTML entity escaping to prevent corruption (e.g. escaping slashes)
  const isUrl = /^https?:\/\/[^\s$.?#].[^\s]*$/i.test(value);
  if (isUrl) {
    return value.replace(/\0/g, '').trim();
  }
  
  // Remove script tags and their content
  let sanitized = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove dangerous HTML tags
  sanitized = sanitized.replace(/<(iframe|object|embed|link|style|meta)[^>]*>/gi, '');
  
  // Escape HTML entities to prevent XSS
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Recursively sanitize all string values in an object
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      // Use Object.prototype.hasOwnProperty.call to handle objects without hasOwnProperty
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Middleware to sanitize request body, query, and params
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  try {
    // Sanitize request body (this is mutable)
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query parameters (need to modify in place)
    if (req.query && typeof req.query === 'object') {
      const sanitized = sanitizeObject(req.query);
      Object.keys(req.query).forEach(key => delete req.query[key]);
      Object.assign(req.query, sanitized);
    }
    
    // Sanitize URL parameters (need to modify in place)
    if (req.params && typeof req.params === 'object') {
      const sanitized = sanitizeObject(req.params);
      Object.keys(req.params).forEach(key => delete req.params[key]);
      Object.assign(req.params, sanitized);
    }
    
    next();
  } catch (error) {
    // If sanitization fails, continue without sanitization but log the error
    console.error('Sanitization error:', error);
    next();
  }
}

/**
 * Specific sanitization for text fields that should allow some formatting
 * Use this for product descriptions, reviews, etc.
 */
export function sanitizeTextField(value: string): string {
  if (typeof value !== 'string') return value;
  
  // Allow basic formatting but remove scripts
  let sanitized = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove dangerous tags but allow basic formatting
  sanitized = sanitized.replace(/<(iframe|object|embed|link|style|meta|script)[^>]*>/gi, '');
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Validate and sanitize email addresses
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return email;
  
  // Convert to lowercase and trim
  let sanitized = email.toLowerCase().trim();
  
  // Remove any characters that aren't valid in emails
  sanitized = sanitized.replace(/[^a-z0-9@._+-]/g, '');
  
  return sanitized;
}

/**
 * Validate and sanitize phone numbers (removes non-numeric characters except +)
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') return phone;
  
  // Remove all characters except digits and + sign
  let sanitized = phone.replace(/[^0-9+]/g, '');
  
  return sanitized;
}

/**
 * Sanitize MongoDB query operators to prevent NoSQL injection
 */
export function sanitizeMongoQuery(query: any): any {
  if (query === null || query === undefined) return query;
  
  if (Array.isArray(query)) {
    return query.map(item => sanitizeMongoQuery(item));
  }
  
  if (typeof query === 'object') {
    const sanitized: any = {};
    for (const key in query) {
      if (query.hasOwnProperty(key)) {
        // Block MongoDB operators in user input
        if (key.startsWith('$')) {
          continue; // Skip keys that start with $ (MongoDB operators)
        }
        sanitized[key] = sanitizeMongoQuery(query[key]);
      }
    }
    return sanitized;
  }
  
  return query;
}

