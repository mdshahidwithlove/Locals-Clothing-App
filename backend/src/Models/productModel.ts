import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },

  description: {
    type: String,
    maxlength: 500,
    trim: true,
  },

  category: {
    type: String,
    required: true,
    enum: ["Men", "Women", "Kids", "Unisex"],
  },
  subcategory: {
    type: String,
    required: true,
    enum: [
      "Shirts", "Jeans", "Lower", "T-Shirts", "Footwear", "Pants", "Shorts", "Accessories", "Undergarments",
      "Dresses", "Tops", "Sarees", "Kurtas", "Skirts", "Leggings",
      "Jackets", "Hoodies", "Sweatshirts", "Sweaters", "Cardigans", "Blazers", "Coats", "Suits",
      "Underwear", "Sleepwear", "Activewear", "Swimwear", "Ethnic Wear"
    ],
  },

  images: [{ 
   type: String, 
  }],
  price: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(v: number) {
        return !isNaN(v) && isFinite(v) && v >= 0;
      },
      message: 'Price must be a valid positive number'
    }
  },

  // Discount fields
  discountPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
    validate: {
      validator: function(v: number) {
        return !isNaN(v) && isFinite(v) && v >= 0 && v <= 100;
      },
      message: 'Discount percentage must be between 0 and 100'
    }
  },
  isOnSale: {
    type: Boolean,
    default: false
  },

  sizes: [{ type: String, enum: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] }],
  availableQuantity: { 
    type: Number, 
    default: 0,
    min: 0,
    validate: {
      validator: function(v: number) {
        return !isNaN(v) && isFinite(v) && v >= 0;
      },
      message: 'Available quantity must be a valid non-negative number'
    }
  },

  specifications: {
    material: { type: String, trim: true, maxlength: 100 },
    fit: { type: String, enum: ["Slim Fit", "Regular Fit", "Loose Fit", "Oversized"] },
    pattern: { type: String, enum: ["Solid", "Striped", "Printed", "Checkered", "Floral"] },
  },

  season: { type: String, enum: ["Summer", "Winter", "Monsoon", "All Season"] },

  isActive: { type: Boolean, default: true },
  isNewArrival: { type: Boolean, default: false },
  isBestSeller: { type: Boolean, default: false },
}, {
  timestamps: true,
});

// Note: Discount calculation is now handled in the controller
// The price field stores the final price (after discount if applicable)

productSchema.index({ merchantId: 1 });
productSchema.index({ storeId: 1 });
productSchema.index({ name: "text" });
productSchema.index({ category: 1 });
productSchema.index({ subcategory: 1 });
productSchema.index({ specifications: 1 });
productSchema.index({ price: 1 });
productSchema.index({ isOnSale: 1 });

const Product = mongoose.model("Product", productSchema);
export default Product;
