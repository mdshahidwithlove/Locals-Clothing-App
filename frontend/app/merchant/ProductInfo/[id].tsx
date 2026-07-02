import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../../api/client';
import ImageUploader from '../../../components/ui/ImageUploader';
import ProductDetailsModal from '../../../components/merchant/ProductDetailsModal';
import { cleanSpecifications } from '@/utils/productUtils';
import { 
  ProductData, 
  FormErrors, 
  ProductDetails,
  PRODUCT_CATEGORIES,
  PRODUCT_SUBCATEGORIES,
  PRODUCT_SIZES
} from '../../../types/product';

// Remove duplicate interfaces - now imported from types/product.ts

const ProductInfo = () => {
  const router = useRouter();
  const { id: productId } = useLocalSearchParams();
  
  const [productData, setProductData] = useState<ProductData>({
    name: '',
    description: '',
    category: '',
    subcategory: '',
    images: [],
    price: '',
    discountPercentage: '',
    isOnSale: false,
    sizes: [],
    availableQuantity: '',
    isActive: true,
    isNewArrival: false,
    isBestSeller: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [errors, setErrors] = useState<FormErrors>({});
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const categories = PRODUCT_CATEGORIES;
  const availableSizes = PRODUCT_SIZES;
  
  // Get available subcategories based on selected category
  const availableSubcategories = useMemo(() => {
    if (!productData.category) return [];
    return PRODUCT_SUBCATEGORIES[productData.category as keyof typeof PRODUCT_SUBCATEGORIES] || [];
  }, [productData.category]);

  // Fetch product data on component mount
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await apiClient.get(`/api/v1/product/${productId}`);
        if (response.data.success) {
          const product = response.data.product;
          // Calculate original price for editing
          let originalPrice = product.price;
          if (product.isOnSale && product.discountPercentage && product.discountPercentage > 0) {
            // If product is on sale, calculate original price from discounted price
            originalPrice = product.price / (1 - product.discountPercentage / 100);
          }

          setProductData({
            name: product.name || '',
            description: product.description || '',
            category: product.category || '',
            subcategory: product.subcategory || '',
            images: product.images || [],
            price: originalPrice?.toString() || '',
            discountPercentage: product.discountPercentage?.toString() || '',
            isOnSale: product.isOnSale ?? false,
            sizes: product.sizes || [],
            availableQuantity: product.availableQuantity?.toString() || '',
            specifications: product.specifications || {},
            season: product.season || '',
            isActive: product.isActive ?? true,
            isNewArrival: product.isNewArrival ?? false,
            isBestSeller: product.isBestSeller ?? false,
          });
        } else {
          Alert.alert('Error', 'Failed to fetch product details');
          router.back();
        }
      } catch (error: any) {
        console.error('Error fetching product:', error);
        Alert.alert('Error', 'Failed to fetch product details. Please try again.');
        router.back();
      } finally {
        setIsInitialLoading(false);
      }
    };

    if (productId) {
      fetchProduct();
    }
  }, [productId, router]);

  // Validation function
  const validateForm = useCallback((): FormErrors => {
    const newErrors: FormErrors = {};

    if (!productData.name.trim()) {
      newErrors.name = 'Product name is required';
    } else if (productData.name.trim().length < 2) {
      newErrors.name = 'Product name must be at least 2 characters';
    }

    if (!productData.category) {
      newErrors.category = 'Please select a category';
    }

    if (!productData.subcategory) {
      newErrors.subcategory = 'Please select a subcategory';
    }

    if (!productData.price.trim()) {
      newErrors.price = 'Price is required';
    } else if (isNaN(Number(productData.price)) || Number(productData.price) <= 0) {
      newErrors.price = 'Please enter a valid price';
    }

    if (!productData.availableQuantity.trim()) {
      newErrors.availableQuantity = 'Available quantity is required';
    } else if (isNaN(Number(productData.availableQuantity)) || Number(productData.availableQuantity) < 0) {
      newErrors.availableQuantity = 'Please enter a valid quantity';
    }

    if (productData.images.length === 0) {
      newErrors.images = 'At least one product image is required';
    }

    return newErrors;
  }, [productData]);


  const handleInputChange = useCallback((field: keyof ProductData, value: string | string[] | boolean) => {
    setProductData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  }, [errors]);

  const handleCategorySelect = useCallback((category: string) => {
    setProductData(prev => ({
      ...prev,
      category,
      subcategory: '' // Reset subcategory when category changes
    }));

    if (errors.category) {
      setErrors(prev => ({ ...prev, category: undefined }));
    }
    if (errors.subcategory) {
      setErrors(prev => ({ ...prev, subcategory: undefined }));
    }
  }, [errors.category, errors.subcategory]);

  const handleSubcategorySelect = useCallback((subcategory: string) => {
    setProductData(prev => ({
      ...prev,
      subcategory
    }));

    if (errors.subcategory) {
      setErrors(prev => ({ ...prev, subcategory: undefined }));
    }
  }, [errors.subcategory]);

  const handleSizeToggle = useCallback((size: string) => {
    setProductData(prev => ({
      ...prev,
      sizes: prev.sizes.includes(size)
        ? prev.sizes.filter(s => s !== size)
        : [...prev.sizes, size]
    }));
  }, []);

  const handleImagesChange = useCallback((images: string[]) => {
    setProductData(prev => ({
      ...prev,
      images
    }));
    if (errors.images) {
      setErrors(prev => ({ ...prev, images: undefined }));
    }
  }, [errors.images]);

  const handleDetailsSave = useCallback(async (details: ProductDetails) => {
    const cleanedSpecs = cleanSpecifications(details.specifications);

    setProductData(prev => ({
      ...prev,
      specifications: cleanedSpecs || {},
      season: details.season || '',
      isActive: details.isActive,
      isNewArrival: details.isNewArrival,
      isBestSeller: details.isBestSeller,
      isOnSale: details.isOnSale,
      discountPercentage: details.discountPercentage,
    }));

    if (!productId) return;

    const response = await apiClient.put(`/api/v1/product/${productId}`, {
      specifications: cleanedSpecs,
      season: details.season?.trim() || undefined,
      isActive: details.isActive,
      isNewArrival: details.isNewArrival,
      isBestSeller: details.isBestSeller,
      isOnSale: details.isOnSale,
      discountPercentage: details.discountPercentage ? Number(details.discountPercentage) : 0,
    });

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to save product details');
    }

    const product = response.data.product;
    setProductData(prev => ({
      ...prev,
      specifications: product.specifications || cleanedSpecs || {},
      season: product.season || details.season || '',
      isActive: product.isActive ?? details.isActive,
      isNewArrival: product.isNewArrival ?? details.isNewArrival,
      isBestSeller: product.isBestSeller ?? details.isBestSeller,
      isOnSale: product.isOnSale ?? details.isOnSale,
      discountPercentage: product.discountPercentage?.toString() || details.discountPercentage || '',
    }));
  }, [productId]);

  const hasDetailsData = useCallback(() => {
    return !!(
      productData.specifications?.material ||
      productData.specifications?.fit ||
      productData.specifications?.pattern ||
      productData.season ||
      !productData.isActive ||
      productData.isNewArrival ||
      productData.isBestSeller
    );
  }, [productData]);

  const getDetailsSummary = useCallback(() => {
    const details = [];
    if (productData.specifications?.material) details.push(productData.specifications.material);
    if (productData.season) details.push(productData.season);
    if (productData.isNewArrival) details.push("New Arrival");
    if (productData.isBestSeller) details.push("Best Seller");
    
    return details.length > 0 ? details.slice(0, 2).join(" • ") : "";
  }, [productData]);

  const handleSubmit = useCallback(async () => {
    // Validate form
    const validationErrors = validateForm();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    if (isLoading) return;

    try {
      setIsLoading(true);

      // Animate button press
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.7,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      const submitData = {
        name: productData.name,
        description: productData.description,
        category: productData.category,
        subcategory: productData.subcategory,
        images: productData.images,
        price: Math.round(Number(productData.price)),
        discountPercentage: productData.discountPercentage ? Number(productData.discountPercentage) : 0,
        isOnSale: productData.isOnSale,
        sizes: productData.sizes,
        availableQuantity: Math.round(Number(productData.availableQuantity)),
        specifications: cleanSpecifications(productData.specifications),
        season: productData.season?.trim() || undefined,
        isActive: productData.isActive,
        isNewArrival: productData.isNewArrival,
        isBestSeller: productData.isBestSeller,
      };


      const response = await apiClient.put(`/api/v1/product/${productId}`, submitData);

      if (response.data.success) {
        Alert.alert(
          'Success!',
          'Product updated successfully.',
          [
            {
              text: 'OK',
              onPress: () => router.back()
            }
          ]
        );
      } else {
        Alert.alert('Error', response.data.message || 'Failed to update product. Please try again.');
      }
    } catch (error: any) {
      console.error('Product update error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update product. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [validateForm, isLoading, fadeAnim, productData, productId, router]);

  const handleDelete = useCallback(async () => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              const response = await apiClient.delete(`/api/v1/product/${productId}`);
              if (response.data.success) {
                Alert.alert(
                  'Success',
                  'Product deleted successfully',
                  [
                    {
                      text: 'OK',
                      onPress: () => router.back()
                    }
                  ]
                );
              } else {
                Alert.alert('Error', response.data.message || 'Failed to delete product');
              }
            } catch (error: any) {
              console.error('Error deleting product:', error);
              Alert.alert('Error', 'Failed to delete product. Please try again.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  }, [productId, router]);

  if (isInitialLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={Colors.gradients.primary as [string, string]}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Product Info</Text>
            <View style={styles.placeholder} />
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading product details...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      <KeyboardAvoidingView 
        style={styles.keyboardContainer} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Header */}
        <LinearGradient
          colors={Colors.gradients.primary as [string, string]}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Product Info</Text>
            <View style={styles.placeholder} />
          </View>
        </LinearGradient>

        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Form Content */}
          <View style={styles.formContent}>
            {/* Product Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Product Name *</Text>
              <View style={[
                styles.inputWrapper,
                errors.name && styles.inputWrapperError
              ]}>
                <Ionicons 
                  name="shirt-outline" 
                  size={20} 
                  color={productData.name ? Colors.buttonPrimary : Colors.textMuted} 
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  value={productData.name}
                  onChangeText={(value) => handleInputChange('name', value)}
                  placeholder="Enter product name"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
              {errors.name && (
                <Text style={styles.errorText}>{errors.name}</Text>
              )}
            </View>

            {/* Product Description */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Description</Text>
              <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                <Ionicons 
                  name="document-text-outline" 
                  size={20} 
                  color={productData.description ? Colors.buttonPrimary : Colors.textMuted} 
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={productData.description}
                  onChangeText={(value) => handleInputChange('description', value)}
                  placeholder="Describe your product"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Category Selection */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Category *</Text>
              <View style={[
                styles.selectionContainer,
                errors.category && styles.selectionContainerError
              ]}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.selectionOption,
                      productData.category === category && styles.selectionOptionSelected,
                      errors.category && styles.selectionOptionError
                    ]}
                    onPress={() => handleCategorySelect(category)}
                  >
                    <Text style={[
                      styles.selectionOptionText,
                      productData.category === category && styles.selectionOptionTextSelected
                    ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.category && (
                <Text style={styles.errorText}>{errors.category}</Text>
              )}
            </View>

            {/* Subcategory Selection */}
            {productData.category && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Subcategory *</Text>
                <View style={[
                  styles.selectionContainer,
                  errors.subcategory && styles.selectionContainerError
                ]}>
                  {availableSubcategories.map((subcategory) => (
                    <TouchableOpacity
                      key={subcategory}
                      style={[
                        styles.selectionOption,
                        productData.subcategory === subcategory && styles.selectionOptionSelected,
                        errors.subcategory && styles.selectionOptionError
                      ]}
                      onPress={() => handleSubcategorySelect(subcategory)}
                    >
                      <Text style={[
                        styles.selectionOptionText,
                        productData.subcategory === subcategory && styles.selectionOptionTextSelected
                      ]}>
                        {subcategory}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.subcategory && (
                  <Text style={styles.errorText}>{errors.subcategory}</Text>
                )}
              </View>
            )}


            {/* Price and Quantity Row */}
            <View style={styles.rowContainer}>
              <View style={[styles.inputContainer, styles.halfWidth]}>
                <Text style={styles.inputLabel}>Price (₹) *</Text>
                <View style={[
                  styles.inputWrapper,
                  errors.price && styles.inputWrapperError
                ]}>
                  <Ionicons 
                    name="cash-outline" 
                    size={20} 
                    color={productData.price ? Colors.buttonPrimary : Colors.textMuted} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={productData.price}
                    onChangeText={(value) => handleInputChange('price', value)}
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
                {errors.price && (
                  <Text style={styles.errorText}>{errors.price}</Text>
                )}
              </View>

              <View style={[styles.inputContainer, styles.halfWidth]}>
                <Text style={styles.inputLabel}>Available Quantity *</Text>
                <View style={[
                  styles.inputWrapper,
                  errors.availableQuantity && styles.inputWrapperError
                ]}>
                  <Ionicons 
                    name="layers-outline" 
                    size={20} 
                    color={productData.availableQuantity ? Colors.buttonPrimary : Colors.textMuted} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={productData.availableQuantity}
                    onChangeText={(value) => handleInputChange('availableQuantity', value)}
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
                {errors.availableQuantity && (
                  <Text style={styles.errorText}>{errors.availableQuantity}</Text>
                )}
              </View>
            </View>


            {/* Sizes Selection */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Available Sizes</Text>
              <View style={styles.selectionContainer}>
                {availableSizes.map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.selectionOption,
                      productData.sizes.includes(size) && styles.selectionOptionSelected
                    ]}
                    onPress={() => handleSizeToggle(size)}
                  >
                    <Text style={[
                      styles.selectionOptionText,
                      productData.sizes.includes(size) && styles.selectionOptionTextSelected
                    ]}>
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Images */}
            <View style={styles.inputContainer}>
              <ImageUploader
                label="Product Images"
                multiple={true}
                existingUrls={productData.images}
                onUploaded={handleImagesChange}
                fullWidth={false}
                squareSize={90}
                maxImages={10}
              />
            </View>

            {/* Add More Details Button */}
            <View style={styles.detailsSection}>
              <TouchableOpacity
                style={styles.detailsButton}
                onPress={() => setShowDetailsModal(true)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={Colors.gradients.primary as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.detailsButtonGradient}
                >
                  <View style={styles.detailsButtonContent}>
                    <Ionicons 
                      name={hasDetailsData() ? "checkmark-circle" : "add-circle-outline"} 
                      size={24} 
                      color={Colors.textPrimary}
                      style={styles.detailsButtonIcon}
                    />
                    <View style={styles.detailsButtonTextContainer}>
                      <Text style={styles.detailsButtonText}>
                        {hasDetailsData() ? "Edit Product Details" : "Add More Details"}
                      </Text>
                      {hasDetailsData() && (
                        <Text style={styles.detailsButtonSubtext}>
                          {getDetailsSummary()}
                        </Text>
                      )}
                    </View>
                    <Ionicons 
                      name="chevron-forward" 
                      size={20} 
                      color={Colors.textPrimary}
                    />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
              
              {/* Encouraging Text */}
              <View style={styles.encouragingTextContainer}>
                <Ionicons name="sparkles" size={16} color={Colors.primary} />
                <Text style={styles.encouragingText}>
                  {hasDetailsData() 
                    ? "Great! Your product has detailed information that will help customers make better decisions."
                    : "Add material, fit, season & more to help customers find your product easily!"
                  }
                </Text>
              </View>
            </View>


            {/* Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              {/* Update Button */}
              <Animated.View style={[{ opacity: fadeAnim }, styles.buttonContainer]}>
                <TouchableOpacity 
                  style={styles.submitButton} 
                  onPress={handleSubmit}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={Colors.gradients.primary as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    <View style={styles.buttonContent}>
                      <Ionicons 
                        name={isLoading ? "hourglass-outline" : "checkmark-circle-outline"} 
                        size={24} 
                        color={Colors.textPrimary}
                        style={styles.buttonIcon}
                      />
                      <Text style={styles.submitButtonText}>
                        {isLoading ? "Updating Product..." : "Update Product"}
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {/* Delete Button */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={handleDelete}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[Colors.error, '#B71C1C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    <View style={styles.buttonContent}>
                      <Ionicons 
                        name="trash-outline" 
                        size={24} 
                        color={Colors.textPrimary}
                        style={styles.buttonIcon}
                      />
                      <Text style={styles.deleteButtonText}>
                        Delete Product
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Product Details Modal */}
      <ProductDetailsModal
        visible={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        onSave={handleDetailsSave}
        initialData={{
          specifications: productData.specifications,
          season: productData.season,
          isActive: productData.isActive,
          isNewArrival: productData.isNewArrival,
          isBestSeller: productData.isBestSeller,
          isOnSale: productData.isOnSale,
          discountPercentage: productData.discountPercentage,
        }}
        category={productData.category}
        currentPrice={productData.price}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  formContent: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 16,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputWrapperError: {
    borderColor: Colors.error,
    shadowColor: Colors.error,
    shadowOpacity: 0.3,
  },
  textAreaWrapper: {
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rowContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  selectionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectionContainerError: {
    // Add error styling if needed
  },
  selectionOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  selectionOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  selectionOptionError: {
    borderColor: Colors.error,
  },
  selectionOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  selectionOptionTextSelected: {
    color: Colors.textPrimary,
  },
  imageUploader: {
    marginTop: 8,
  },
  detailsSection: {
    marginBottom: 16,
  },
  detailsButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  detailsButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  detailsButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsButtonIcon: {
    marginRight: 12,
  },
  detailsButtonTextContainer: {
    flex: 1,
  },
  detailsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  detailsButtonSubtext: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textPrimary,
    opacity: 0.8,
    marginTop: 2,
  },
  encouragingTextContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  encouragingText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 12,
    lineHeight: 20,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '500',
  },
  actionButtonsContainer: {
    marginTop: 24,
    marginBottom: 24,
    gap: 16,
  },
  buttonContainer: {
    flex: 1,
  },
  submitButton: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  deleteButton: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  buttonGradient: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 12,
  },
  submitButtonText: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 1.0,
  },
  deleteButtonText: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 1.0,
  },
});

export default ProductInfo;
