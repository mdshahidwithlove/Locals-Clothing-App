import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  Dimensions,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import ProductCard from '@/components/user/ProductCard';
import CategoryIcons from '@/components/user/CategoryIcons';
import FilterButtons from '@/components/user/FilterButtons';
import { useFavorites } from '@/hooks/useFavorites';
import type { Store } from '@/types/store';
import type { Product } from '@/types/product';
import apiClient from '@/api/client';
import CartBar from '@/components/user/CartBar';
import StoreReviewsPreview from '@/components/user/StoreReviewsPreview';
import StoreRatingDisplay from '@/components/user/StoreRatingDisplay';

const { width: screenWidth } = Dimensions.get('window');

export default function StoreDetailScreen() {
  const router = useRouter();
  const { id, subcategory, filter } = useLocalSearchParams();
  const { checkMultipleFavorites } = useFavorites();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(
    typeof filter === 'string' ? filter : null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentImageIndex] = useState(0);
  const [showStoreCategories, setShowStoreCategories] = useState(true);

  const storeSubcategories = useMemo(() => {
    const source = products;
    const set = new Set<string>();
    source.forEach(p => p.subcategory && set.add(p.subcategory));
    return Array.from(set);
  }, [products]);

  // Load store details and products
  const loadStoreData = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      Alert.alert('Error', 'Store ID not found');
      router.back();
      return;
    }

    try {
      setIsLoading(true);
      
      // Get store details and products in parallel
      const [storeResponse, productsResponse] = await Promise.all([
        apiClient.get(`/api/v1/store/${id}`),
        apiClient.get(`/api/v1/product/store/${id}`, {
          params: {
            page: 1,
            limit: 20,
          }
        })
      ]);

      if (storeResponse.data.success) {
        setStore(storeResponse.data.store);
      } else {
        Alert.alert('Error', 'Store not found');
        router.back();
        return;
      }

      if (productsResponse.data.success) {
        const productsData = productsResponse.data.products || [];
        setProducts(productsData);
        setFilteredProducts(productsData);
        
        // Check favorites for all products
        if (productsData.length > 0) {
          const productIds = productsData.map((p: Product) => p._id);
          checkMultipleFavorites(productIds);
        }
      }

    } catch (error: any) {
      console.error('Error loading store data:', error);
      Alert.alert('Error', 'Failed to load store details');
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [id, router, checkMultipleFavorites]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadStoreData();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadStoreData]);

  // CategoryIcons filter handler
  const handleCategoryIconPress = useCallback((subcategory: string) => {
    const next = selectedCategory === subcategory ? null : subcategory;
    setSelectedCategory(next);
  }, [selectedCategory]);

  const handleFilterSelect = useCallback((filterId: string) => {
    const next = selectedFilter === filterId ? null : filterId;
    setSelectedFilter(next);
  }, [selectedFilter]);

  // Combined product filtering logic
  useEffect(() => {
    let filtered = [...products];

    // 1. Filter by subcategory
    if (selectedCategory) {
      filtered = filtered.filter(p => p.subcategory === selectedCategory);
    }

    // 2. Filter by gender/tags
    if (selectedFilter) {
      switch (selectedFilter.toLowerCase()) {
        case 'men':
          filtered = filtered.filter(p => p.category === 'Men');
          break;
        case 'women':
          filtered = filtered.filter(p => p.category === 'Women');
          break;
        case 'kids':
          filtered = filtered.filter(p => p.category === 'Kids');
          break;
        case 'unisex':
          filtered = filtered.filter(p => p.category === 'Unisex');
          break;
        case 'new':
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          filtered = filtered.filter(p => new Date(p.createdAt) > thirtyDaysAgo);
          break;
      }
    }

    setFilteredProducts(filtered);
  }, [products, selectedCategory, selectedFilter]);

  // Handle product press
  const handleProductPress = useCallback((product: Product) => {
    router.push(`/product/${product._id}`);
  }, [router]);

  // Handle call store
  const handleCallStore = useCallback(() => {
    if (store?.contact?.phone) {
      Linking.openURL(`tel:${store.contact.phone}`);
    } else {
      Alert.alert('No Phone', 'Phone number not available for this store');
    }
  }, [store]);

  // Handle open map
  const handleOpenMap = useCallback(() => {
    if (store?.mapLink) {
      Linking.openURL(store.mapLink);
    } else {
      Alert.alert('No Map Link', 'Map link not available for this store');
    }
  }, [store]);

  // Handle visit website
  const handleVisitWebsite = useCallback(() => {
    if (store?.contact?.website) {
      Linking.openURL(store.contact.website);
    } else {
      Alert.alert('No Website', 'Website not available for this store');
    }
  }, [store]);

  // Load data on mount
  useEffect(() => {
    loadStoreData();
  }, [loadStoreData]);

  // Apply incoming subcategory from route
  useEffect(() => {
    if (typeof subcategory === 'string' && subcategory.trim()) {
      setSelectedCategory(subcategory);
      setShowStoreCategories(true);
    }
  }, [subcategory]);

  // Apply incoming filter from route
  useEffect(() => {
    if (typeof filter === 'string' && filter.trim()) {
      setSelectedFilter(filter);
    }
  }, [filter]);

  // Render loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading store details...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Render error state
  if (!store) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContent}>
            <Ionicons name="storefront-outline" size={64} color={Colors.error} />
            <Text style={styles.errorTitle}>Store Not Found</Text>
            <Text style={styles.errorSubtitle}>The store you&apos;re looking for doesn&apos;t exist</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }


  const getWorkingDaysText = () => {
    if (!store?.workingDays) return 'Hours not available';
    const abbrev = (d: string) => d.slice(0, 3).toUpperCase();
    const openDays = Object.entries(store.workingDays)
      .filter(([_, isOpen]) => isOpen)
      .map(([day]) => abbrev(day));
    return openDays.length > 0 ? `Open ${openDays.join(' · ')}` : 'Hours not available';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <SafeAreaView style={styles.safeArea}>
        {/* Header (transparent, no gradient, no share) */}
        <View style={styles.headerPlain}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.headerBackButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <View style={styles.headerIdentityRow}>
                {/* Avatar from first store image */}
                <View style={styles.storeAvatar}>
                  {store.storeImages?.[0] ? (
                    <Image source={{ uri: store.storeImages[0] }} style={styles.storeAvatarImage} />
                  ) : (
                    <View style={styles.storeAvatarPlaceholder}>
                      <Ionicons name="storefront-outline" size={18} color={Colors.textSecondary} />
                    </View>
                  )}
                </View>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {store.storeName}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/search' as any)}
                style={styles.headerSearchBtn}
              >
                <Ionicons name="search" size={18} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        >
          {/* Store cover removed per requirement */}

          {/* Store Info */}
          <View style={styles.storeInfo}>
            <View style={styles.storeHeader}>
              <View style={styles.storeTitleContainer}>
                <Text style={styles.storeName}>{store.storeName}</Text>
                <StoreRatingDisplay rating={store.rating} starSize={14} />
              </View>
              {/* status pill removed per requirement */}
            </View>

            {store.description && (
              <Text style={styles.storeDescription}>{store.description}</Text>
            )}

            {/* Contact Info */}
            <View style={styles.contactSection}>
              <View style={styles.contactItem}>
                <Ionicons name="location-outline" size={20} color={Colors.textSecondary} />
                <Text style={styles.contactText}>{store.address}</Text>
              </View>
              
              {/* working days row removed per requirement */}

              {/* Phone row removed per requirement */}

              {/* Email removed as per requirement */}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={handleCallStore}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={20} colors="#fff" />
                <Text style={styles.actionButtonText}>Call</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={handleOpenMap}
                activeOpacity={0.7}
              >
                <Ionicons name="map" size={20} colors="#fff" />
                <Text style={styles.actionButtonText}>Directions</Text>
              </TouchableOpacity>
              
              {store.contact?.website && (
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={handleVisitWebsite}
                  activeOpacity={0.7}
                >
                  <Ionicons name="globe" size={20} colors="#fff" />
                  <Text style={styles.actionButtonText}>Website</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {store._id && (
            <StoreReviewsPreview storeId={store._id} storeRating={store.rating} />
          )}

          {/* Category Icons (collapsible) */}
          <View style={styles.categoryIconsWrap}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowStoreCategories((v) => !v)}
              style={styles.categoryToggle}
            >
              <Text style={styles.categoryToggleTitle}>products on store</Text>
              <Ionicons name={showStoreCategories ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textPrimary} />
            </TouchableOpacity>
            {showStoreCategories && (
              <>
                <CategoryIcons
                  showHeader={false}
                  showSeeAll={false}
                  subcategories={storeSubcategories}
                  noMargin
                  screenType="category"
                  selectedSubcategory={selectedCategory || undefined}
                  onCategoryPress={handleCategoryIconPress}
                />
                <View style={{ marginTop: 10, marginBottom: 4 }}>
                  <FilterButtons
                    selectedFilter={selectedFilter}
                    onFilterSelect={handleFilterSelect}
                    screenType="category"
                  />
                </View>
              </>
            )}
          </View>

          {/* Products Section */}
          <View style={styles.productsSection}>

            {filteredProducts.length > 0 ? (
              <View style={styles.productsList}>
                {filteredProducts.map((product) => (
                  <View key={product._id} style={styles.productItemFull}>
                    <ProductCard product={product} onPress={handleProductPress} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.noProductsContainer}>
                <Ionicons name="shirt-outline" size={48} color={Colors.textSecondary} />
                <Text style={styles.noProductsText}>No products available yet</Text>
              </View>
            )}
          </View>
        </ScrollView>
        <CartBar />
      </SafeAreaView>
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
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
  headerPlain: {
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingBottom: 10,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBackButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'transparent',
  },
  headerCenter: { flex: 1, paddingHorizontal: 8 },
  headerIdentityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  storeAvatar: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', backgroundColor: Colors.backgroundSecondary },
  storeAvatarImage: { width: '100%', height: '100%' },
  storeAvatarPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'left',
  },
  headerRight: { width: 64, alignItems: 'flex-end' },
  headerSearchBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFD700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  ratingPillText: { fontSize: 12, fontWeight: '700', color: '#111' },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  imageSection: {
    backgroundColor: Colors.background,
  },
  imageScrollView: {
    height: screenWidth * 0.6,
  },
  imageScrollContent: {
    alignItems: 'center',
  },
  imageContainer: {
    width: screenWidth,
    height: screenWidth * 0.6,
    backgroundColor: Colors.backgroundSecondary,
  },
  storeImage: {
    width: '100%',
    height: '100%',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textSecondary,
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: Colors.primary,
  },
  storeInfo: {
    padding: 20,
    backgroundColor: Colors.background,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  storeTitleContainer: {
    flex: 1,
  },
  storeName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  storeDescription: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 20,
  },
  contactSection: {
    marginBottom: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  contactText: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
  },
  productsSection: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 0,
    backgroundColor: Colors.background,
  },
  /* products header removed per requirement */
  productsList: {
    flexDirection: 'column',
    gap: 12,
    alignItems: 'stretch',
  },
  productItemFull: {
    width: '100%',
  },
  categoryIconsWrap: { paddingHorizontal: 0, paddingTop: 0 },
  categoryToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  categoryToggleTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  noProductsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noProductsText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
  },
});
