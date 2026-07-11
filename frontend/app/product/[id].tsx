import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Dimensions,
  Image,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useCart } from '@/contexts/CartContext';
import { useFavorites } from '@/hooks/useFavorites';
import type { Product } from '@/types/product';
import apiClient from '@/api/client';
import StoreRatingDisplay from '@/components/user/StoreRatingDisplay';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function ProductDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [showCharacteristics, setShowCharacteristics] = useState(false);
  const { isFavorite, toggleFavorite, isLoading: isFavoriteLoading } = useFavorites();
  const { addItem } = useCart();

  const scrollViewRef = useRef<ScrollView>(null);
  const imageScrollViewRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  // Load product details
  const loadProduct = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      Alert.alert('Error', 'Product ID not found');
      router.back();
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiClient.get(`/api/v1/product/${id}`);
      
      if (response.data.success) {
        setProduct(response.data.product);
      } else {
        Alert.alert('Error', 'Product not found');
        router.back();
      }
    } catch (error: any) {
      console.error('Error loading product:', error);
      Alert.alert('Error', 'Failed to load product details');
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  const handleImageScroll = useCallback((event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    setCurrentImageIndex(slideIndex);
  }, []);

  const handleSizeSelection = useCallback((size: string) => {
    setSelectedSizes(prev => {
      if (prev.includes(size)) {
        return prev.filter(s => s !== size);
      } else {
        return [...prev, size];
      }
    });
  }, []);

  const handleAddToCart = useCallback(() => {
    if (selectedSizes.length === 0) {
      Alert.alert('Size Required', 'Please select at least one size before adding to cart');
      return;
    }
    if (product && product.availableQuantity <= 0) {
      Alert.alert('Out of Stock', 'This product is currently out of stock');
      return;
    }
    if (product) {
      selectedSizes.forEach((sz) => addItem(product, 1, sz));
      router.push('/(tabs)/cart' as any);
    }
  }, [selectedSizes, product, addItem, router]);

  const handleFavoriteToggle = useCallback(async () => {
    if (product?._id) {
      await toggleFavorite(product._id);
    }
  }, [product?._id, toggleFavorite]);

  const handleViewAll = useCallback(() => {
    Alert.alert('View All', 'View all functionality will be implemented soon');
  }, []);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    scrollY.addListener(({ value }) => {
      const opacity = Math.min(value / 100, 1);
      headerOpacity.setValue(opacity);
    });

    return () => {
      scrollY.removeAllListeners();
    };
  }, [scrollY, headerOpacity]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading product...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContent}>
            <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
            <Text style={styles.errorTitle}>Product Not Found</Text>
            <Text style={styles.errorSubtitle}>The product you&apos;re looking for doesn&apos;t exist</Text>
            <TouchableOpacity style={styles.errorButton} onPress={() => router.back()}>
              <Text style={styles.errorButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const formatPrice = (price: number) => {
    return Math.round(price).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  const isDiscount = !!product?.isOnSale && !!product?.discountPercentage && (product!.discountPercentage as number) > 0;
  const originalPrice = isDiscount
    ? Math.round(product!.price / (1 - (product!.discountPercentage as number) / 100))
    : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Transparent Header Buttons */}
      <View style={styles.transparentHeader}>
        <SafeAreaView>
          <View style={styles.transparentHeaderContent}>
            <TouchableOpacity 
              style={styles.headerIconButton} 
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <View style={styles.iconButtonBackground}>
                <Ionicons name="arrow-back" size={24} color="#000" />
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.headerIconButton} 
              onPress={handleFavoriteToggle}
              activeOpacity={0.7}
              disabled={isFavoriteLoading}
            >
              <View style={styles.iconButtonBackground}>
                <Ionicons 
                  name={isFavorite(product._id) ? "heart" : "heart-outline"} 
                  size={24} 
                  color={isFavorite(product._id) ? Colors.error : "#000"} 
                />
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      <Animated.ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
          {/* Hero Image Section */}
        <View style={styles.heroSection}>
          {product.images && product.images.length > 0 ? (
            <>
              <ScrollView
                ref={imageScrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleImageScroll}
                style={styles.imageScrollView}
              >
                {product.images.map((image, index) => (
                  <View key={index} style={styles.heroImageContainer}>
                    <Image
                      source={{ uri: image }}
                      style={styles.heroImage}
                      resizeMode="cover"
                    />
                  </View>
                ))}
              </ScrollView>
              
              {/* Carousel Indicator Dots */}
              {product.images.length > 1 && (
                <View style={styles.imagePagination}>
                  {product.images.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.paginationDot,
                        index === currentImageIndex && styles.paginationDotActive
                      ]}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.heroImageContainer}>
              <View style={styles.placeholderImage}>
                <Ionicons name="shirt-outline" size={100} color={Colors.textSecondary} />
              </View>
            </View>
          )}

          {/* Floating Stock Badge */}
          <View style={[
            styles.floatingStockBadge,
            product.availableQuantity <= 0 && styles.stockBadgeOutOfStock
          ]}>
            <Ionicons 
              name={product.availableQuantity > 0 ? "checkmark-circle" : "close-circle"} 
              size={16} 
              color="#fff" 
            />
            <Text style={styles.stockBadgeText}>
              {product.availableQuantity > 0 ? 'In Stock' : 'Out of Stock'}
            </Text>
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          {/* Product Title & Price */}
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <Text style={styles.productName}>{product.name}</Text>
              <View style={[
                styles.stockBadgeInline,
                product.availableQuantity <= 0 && styles.stockBadgeOutOfStock
              ]}>
                <Ionicons 
                  name={product.availableQuantity > 0 ? "checkmark-circle" : "close-circle"} 
                  size={14} 
                  color="#fff" 
                />
                <Text style={styles.stockBadgeText}>
                  {product.availableQuantity > 0 ? 'In Stock' : 'Out of Stock'}
                </Text>
              </View>
            </View>
            <View style={styles.priceCard}>
              {isDiscount ? (
                <View style={styles.bothPricesRow}>
                  <View style={styles.originalPriceRow}>
                    <Text style={styles.originalPrice}>₹{formatPrice(originalPrice as number)}</Text>
                  </View>
                  <View style={styles.discountedPriceRow}>
                    <Text style={styles.discountedPrice}>₹{formatPrice(product.price)}</Text>
                    <View style={styles.discountBadge}><Text style={styles.discountBadgeText}>{product!.discountPercentage}% off</Text></View>
                  </View>
                </View>
              ) : (
                <View style={styles.priceLeft}>
                  <Text style={styles.price}>₹{formatPrice(product.price)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Seller Card */}
          <TouchableOpacity
            style={styles.sellerCard}
            activeOpacity={0.7}
            onPress={() => {
              if (product.storeId?._id) {
                router.push(`/store/${product.storeId._id}` as any);
              }
            }}
          >
            <View style={styles.sellerLeft}>
              <View style={styles.sellerAvatar}>
                {product.storeId?.storeImages && product.storeId.storeImages.length > 0 ? (
                  <Image
                    source={{ uri: product.storeId.storeImages[0] }}
                    style={styles.sellerAvatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.sellerInitial}>
                    {product.storeId?.storeName?.charAt(0) || 'S'}
                  </Text>
                )}
              </View>
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName}>
                  {product.storeId?.storeName || 'Store Name'}
                </Text>
                <StoreRatingDisplay rating={product.storeId?.rating} starSize={12} compact />
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Description */}
          <View style={styles.descriptionCard}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>
              {product.description || 'Premium quality product with excellent craftsmanship and attention to detail.'}
            </Text>
            <View style={styles.bullets}>
              <View style={styles.bulletItem}><Text style={styles.bulletText}>Secure payments</Text></View>
              <View style={styles.bulletItem}><Text style={styles.bulletText}>Trusted seller</Text></View>
            </View>
          </View>

          {/* Size Selection */}
          <View style={styles.sizeCard}>
            <View style={styles.sizeHeader}>
              <Text style={styles.sectionTitle}>Select Size</Text>
              <TouchableOpacity>
                <Text style={styles.sizeLinkText}>Size Guide</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.sizeGrid}>
              {product.sizes.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.sizeButton,
                    selectedSizes.includes(size) && styles.sizeButtonSelected,
                    product.availableQuantity <= 0 && styles.sizeButtonDisabled
                  ]}
                  onPress={() => handleSizeSelection(size)}
                  activeOpacity={0.7}
                  disabled={product.availableQuantity <= 0}
                >
                  <Text style={[
                    styles.sizeButtonText,
                    selectedSizes.includes(size) && styles.sizeButtonTextSelected
                  ]}>
                    {size}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Product Details Accordion */}
          <View style={styles.detailsCard}>
            <TouchableOpacity 
              style={styles.detailsHeader}
              onPress={() => setShowCharacteristics(!showCharacteristics)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Product Details</Text>
              <Ionicons 
                name={showCharacteristics ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={Colors.textSecondary} 
              />
            </TouchableOpacity>

            {showCharacteristics && (
              <View style={styles.detailsContent}>
                {product.specifications && (
                  <>
                    {product.specifications.material && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Material</Text>
                        <Text style={styles.detailValue}>{product.specifications.material}</Text>
                      </View>
                    )}
                    {product.specifications.fit && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Fit</Text>
                        <Text style={styles.detailValue}>{product.specifications.fit}</Text>
                      </View>
                    )}
                    {product.specifications.pattern && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Pattern</Text>
                        <Text style={styles.detailValue}>{product.specifications.pattern}</Text>
                      </View>
                    )}
                  </>
                )}
                {product.season && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Season</Text>
                    <Text style={styles.detailValue}>{product.season}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Available Quantity</Text>
                  <Text style={styles.detailValue}>{product.availableQuantity}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
        </View>
      </Animated.ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <SafeAreaView edges={['bottom']} style={styles.bottomBarContent}>
          <TouchableOpacity 
            style={styles.viewAllButton} 
            onPress={handleViewAll}
            activeOpacity={0.8}
          >
            <Ionicons name="grid-outline" size={24} color="#000" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.addToCartButton,
              product.availableQuantity <= 0 && styles.addToCartButtonDisabled
            ]} 
            onPress={handleAddToCart}
            activeOpacity={0.8}
            disabled={product.availableQuantity <= 0}
          >
            <Ionicons 
              name={product.availableQuantity > 0 ? "cart-outline" : "close"} 
              size={20} 
              color="#000" 
            />
            <Text style={styles.addToCartButtonText}>
              {product.availableQuantity > 0 ? 'Add to Cart' : 'Out of Stock'}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  errorButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  floatingHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  floatingHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  transparentHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99,
  },
  transparentHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
  },
  headerIconButton: {
    padding: 0,
  },
  iconButtonBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroSection: {
    position: 'relative',
  },
  imageScrollView: {
    height: screenHeight * 0.5,
  },
  heroImageContainer: {
    width: screenWidth,
    height: screenHeight * 0.5,
    backgroundColor: Colors.backgroundSecondary,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
  },
  imagePagination: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 20,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: '#fff',
  },
  stockBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 4,
  },
  floatingStockBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  stockBadgeOutOfStock: {
    backgroundColor: Colors.error,
  },
  stockBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  contentSection: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  titleSection: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  productName: {
    flex: 1,
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 34,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  priceLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  mrp: {
    fontSize: 14,
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  discount: {
    fontSize: 14,
    color: Colors.success,
    fontWeight: '700',
  },
  // Removed fast delivery pill per request
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundSecondary,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  sellerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  sellerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  sellerInitial: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  ratingCount: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  descriptionCard: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  bullets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  bulletItem: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bulletText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  // New price styles in details screen to mirror card
  originalPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  originalPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  discountedPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  discountedPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  discountBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  bothPricesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sizeCard: {
    marginBottom: 20,
  },
  sizeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sizeLinkText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sizeButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    minWidth: 60,
    alignItems: 'center',
  },
  sizeButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sizeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  sizeButtonTextSelected: {
    color: '#000',
  },
  sizeButtonDisabled: {
    backgroundColor: Colors.backgroundSecondary,
    borderColor: Colors.border,
    opacity: 0.5,
  },
  detailsCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailsContent: {
    marginTop: 16,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 120,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  bottomBarContent: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  viewAllButton: {
    width: 56,
    height: 56,
    backgroundColor: Colors.success,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  addToCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 28,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  addToCartButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '700',
  },
  addToCartButtonDisabled: {
    backgroundColor: Colors.textSecondary,
    opacity: 0.6,
  },
});