// Product Filter Types - Based on Product Model
export interface ProductFilters {
  // Basic Filters
  category?: string[]; // Men, Women, Kids, Unisex
  subcategory?: string[]; // Shirts, T-Shirts, Pants, etc.
  
  // Price Range
  priceRange: {
    min: number;
    max: number;
  };
  
  // Product Specifications
  sizes?: string[]; // XS, S, M, L, XL, XXL, XXXL
  materials?: string[]; // Cotton, Polyester, Silk, Wool, Linen, Denim, Leather, Synthetic
  fits?: string[]; // Slim Fit, Regular Fit, Loose Fit, Oversized
  patterns?: string[]; // Solid, Striped, Printed, Checkered, Floral
  
  // Seasonal Filters
  seasons?: string[]; // Summer, Winter, Monsoon, All Season
  
  // Product Status
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  isActive?: boolean;
  isOnSale?: boolean; // Products with discount
  
  // Availability
  inStock?: boolean; // availableQuantity > 0
  
  // Sorting
  sortBy: 'price_low' | 'price_high' | 'newest' | 'oldest' | 'name_asc' | 'name_desc';
}

// Search Screen Filter Types - Based on Product, Store, and Favorites Models
export interface SearchFilters {
  // Product Filters (inherited from ProductFilters)
  productFilters: ProductFilters;
  
  // Store Filters
  storeFilters: {
    storeName?: string;
    storeRating?: {
      min: number;
      max: number;
    };
    storeLocation?: string; // Based on address
    isStoreActive?: boolean;
  };
  
  // User-specific Filters
  userFilters: {
    favoritesOnly?: boolean; // Show only favorited products
    recentlyViewed?: boolean; // Show recently viewed products
  };
  
  // Search-specific Filters
  searchFilters: {
    searchQuery?: string;
    searchIn: ('products' | 'stores' | 'both')[];
    includeInactive?: boolean;
  };
}

// Filter Options for UI Components
export const PRODUCT_CATEGORIES = ['Men', 'Women', 'Kids', 'Unisex'] as const;

export const PRODUCT_SUBCATEGORIES = {
  'Men': ['Shirts', 'Jeans', 'Lower', 'T-Shirts', 'Footwear', 'Pants', 'Shorts', 'Accessories', 'Undergarments', 'Jackets', 'Suits', 'Coats'],
  'Women': ['Shirts', 'Jeans', 'Lower', 'T-Shirts', 'Footwear', 'Pants', 'Shorts', 'Accessories', 'Undergarments', 'Dresses', 'Tops', 'Sarees', 'Kurtas', 'Skirts', 'Leggings'],
  'Kids': ['Shirts', 'Jeans', 'Lower', 'T-Shirts', 'Footwear', 'Pants', 'Shorts', 'Accessories', 'Undergarments', 'Dresses', 'Tops', 'Skirts', 'Leggings', 'Jackets'],
  'Unisex': ['Shirts', 'Jeans', 'Lower', 'T-Shirts', 'Footwear', 'Pants', 'Shorts', 'Accessories', 'Undergarments', 'Jackets', 'Hoodies', 'Sweatshirts', 'Blazers']
} as const;

export const PRIORITY_SUBCATEGORY_ORDER = [
  'Shirts',
  'Jeans',
  'Lower',
  'T-Shirts',
  'Footwear',
  'Pants',
  'Shorts',
  'Accessories',
  'Undergarments',
];

// Get unique subcategories maintaining master priority sequence
export const getUniqueSubcategories = () => {
  const allSubcategories = Object.values(PRODUCT_SUBCATEGORIES).flat();
  const unique = [...new Set(allSubcategories)];
  
  const priorityItems = PRIORITY_SUBCATEGORY_ORDER.filter(item => unique.includes(item as any));
  const remainingItems = unique.filter(item => !PRIORITY_SUBCATEGORY_ORDER.includes(item as any));
  
  return [...priorityItems, ...remainingItems];
};

export const PRODUCT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;

export const PRODUCT_MATERIALS = ['Cotton', 'Polyester', 'Silk', 'Wool', 'Linen', 'Denim', 'Leather', 'Synthetic'] as const;

export const PRODUCT_FITS = ['Slim Fit', 'Regular Fit', 'Loose Fit', 'Oversized'] as const;

export const PRODUCT_PATTERNS = ['Solid', 'Striped', 'Printed', 'Checkered', 'Floral'] as const;

export const PRODUCT_SEASONS = ['Summer', 'Winter', 'Monsoon', 'All Season'] as const;

export const SORT_OPTIONS = [
  { key: 'price_low', label: 'Price: Low to High' },
  { key: 'price_high', label: 'Price: High to Low' },
  { key: 'newest', label: 'Newest First' },
  { key: 'oldest', label: 'Oldest First' },
  { key: 'name_asc', label: 'Name: A to Z' },
  { key: 'name_desc', label: 'Name: Z to A' },
] as const;

export const PRICE_RANGES = [
  { label: 'Under ₹500', min: 0, max: 500 },
  { label: '₹500 - ₹1000', min: 500, max: 1000 },
  { label: '₹1000 - ₹2000', min: 1000, max: 2000 },
  { label: '₹2000 - ₹5000', min: 2000, max: 5000 },
  { label: 'Above ₹5000', min: 5000, max: 10000 },
] as const;

// Default Filter States
export const DEFAULT_PRODUCT_FILTERS: ProductFilters = {
  priceRange: { min: 0, max: 10000 },
  sortBy: 'newest',
  inStock: false,
};

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  productFilters: DEFAULT_PRODUCT_FILTERS,
  storeFilters: {
    storeRating: { min: 0, max: 5 },
    isStoreActive: true,
  },
  userFilters: {
    favoritesOnly: false,
    recentlyViewed: false,
  },
  searchFilters: {
    searchIn: ['products'],
    includeInactive: false,
  },
};

// Filter State Management Types
export interface FilterState {
  productFilters: ProductFilters;
  searchFilters?: SearchFilters;
  activeFiltersCount: number;
}

// Filter Action Types
export type FilterAction = 
  | { type: 'SET_PRODUCT_FILTERS'; payload: ProductFilters }
  | { type: 'SET_SEARCH_FILTERS'; payload: SearchFilters }
  | { type: 'RESET_PRODUCT_FILTERS' }
  | { type: 'RESET_SEARCH_FILTERS' }
  | { type: 'UPDATE_PRICE_RANGE'; payload: { min: number; max: number } }
  | { type: 'TOGGLE_CATEGORY'; payload: string }
  | { type: 'TOGGLE_SUBCATEGORY'; payload: string }
  | { type: 'TOGGLE_SIZE'; payload: string }
  | { type: 'TOGGLE_MATERIAL'; payload: string }
  | { type: 'TOGGLE_FIT'; payload: string }
  | { type: 'TOGGLE_PATTERN'; payload: string }
  | { type: 'TOGGLE_SEASON'; payload: string }
  | { type: 'SET_SORT_BY'; payload: ProductFilters['sortBy'] }
  | { type: 'TOGGLE_IN_STOCK' }
  | { type: 'TOGGLE_NEW_ARRIVAL' }
  | { type: 'TOGGLE_BEST_SELLER' }
  | { type: 'TOGGLE_ON_SALE' }
  | { type: 'TOGGLE_FAVORITES_ONLY' }
  | { type: 'TOGGLE_RECENTLY_VIEWED' }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SEARCH_IN'; payload: ('products' | 'stores' | 'both')[] };

// Utility Types
export type ProductFilterKey = keyof ProductFilters;
export type SearchFilterKey = keyof SearchFilters;
export type FilterValue = string | string[] | number | boolean | { min: number; max: number };
