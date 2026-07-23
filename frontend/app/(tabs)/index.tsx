import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
// import { useLocation } from '@/contexts/LocationContext';

import CategoryIcons from '@/components/user/CategoryIcons';
import SwipeCarousel from '@/components/user/SwipeCarousel';
import FilterButtons from '@/components/user/FilterButtons';
import ModernStoreCard from '@/components/user/ModernStoreCard';
import PromotionalBanner from '@/components/user/PromotionalBanner';
import SearchBar from '@/components/user/SearchBar';

// Import types and API client
import type { Store, Location } from '@/types/store';
import apiClient from '@/api/client';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // const { selectedCity, currentLocation } = useLocation();
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string | null>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [bestSellerStores, setBestSellerStores] = useState<Store[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedData, setHasLoadedData] = useState(false);

  // --- Scroll tracking ---
  const scrollViewRef = useRef<ScrollView>(null);
  const [isSearchBarSticky, setIsSearchBarSticky] = useState(false);
  const [isCategorySticky, setIsCategorySticky] = useState(false);

  const buildStoreParams = useCallback(
    (overrides?: { search?: string; filter?: string | null }) => ({
      page: 1,
      limit: 20,
      search: overrides?.search ?? searchQuery,
      location: selectedLocation?.name,
      filter: overrides?.filter ?? selectedFilter ?? 'all',
    }),
    [searchQuery, selectedLocation, selectedFilter]
  );

  const fetchStores = useCallback(
    async (overrides?: { search?: string; filter?: string | null }) => {
      const response = await apiClient.get('/api/v1/store/all', {
        params: buildStoreParams(overrides),
      });
      if (response.data.success) {
        setStores(response.data.stores);
      }
    },
    [buildStoreParams]
  );

  // --- Load data ---
  const loadData = useCallback(async (force: boolean = false) => {
    if (hasLoadedData && !force) return;
    try {
      try {
        const bestSellerResponse = await apiClient.get('/api/v1/store/bestsellers', {
          params: { limit: 4 },
        });
        if (bestSellerResponse.data.success) {
          setBestSellerStores(bestSellerResponse.data.stores);
        }
      } catch (e) {
        console.error('Error loading bestsellers:', e);
      }

      await fetchStores();
      setHasLoadedData(true);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load stores. Please try again.');
    }
  }, [fetchStores, hasLoadedData]);

  // --- Refresh handler ---
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadData(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadData]);

  // --- Search handler ---
  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      try {
        await fetchStores({ search: query });
      } catch (error) {
        console.error('Error searching:', error);
      }
    },
    [fetchStores]
  );

  // --- Filter handler ---
  const handleFilterChange = useCallback(
    async (filterId: string) => {
      setSelectedFilter(filterId);
      try {
        await fetchStores({ filter: filterId });
      } catch (error) {
        console.error('Error filtering:', error);
      }
    },
    [fetchStores]
  );

  // --- Store press handler ---
  const handleStorePress = useCallback(
    (store: Store) => {
      router.push({
        pathname: `/store/${store._id}`,
        params: { filter: selectedFilter !== 'all' ? selectedFilter : undefined }
      } as any);
    },
    [router, selectedFilter]
  );

  const handleOrderPress = useCallback(() => {
    scrollViewRef.current?.scrollTo({ y: 360, animated: true });
  }, []);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Scroll handler for sticky behavior ---
  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    
    // Make search bar sticky after scrolling past banner (around 320px)
    setIsSearchBarSticky(offsetY > 320);
    
    // Make category icons sticky after scrolling past search bar area (around 390px)
    setIsCategorySticky(offsetY > 390);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* --- Sticky Search Bar (appears on scroll) --- */}
      {isSearchBarSticky && (
        <View
          style={[
            styles.stickySearchBar,
            {
              paddingTop: Math.max(insets.top, 14),
            },
          ]}
        >
          <SearchBar
            onSearch={handleSearch}
            placeholder="Search stores and products..."
            initialValue={searchQuery}
            showNavigation={true}
          />
        </View>
      )}

      {/* --- Sticky Category Icons (appears on scroll) --- */}
      {isCategorySticky && (
        <View style={styles.stickyCategoryIcons}>
          <CategoryIcons showHeader={false} screenType="home" />
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* --- Promotional Banner --- */}
        <PromotionalBanner
          onOrderPress={handleOrderPress}
          selectedLocation={selectedLocation}
          onLocationSelect={setSelectedLocation}
          onSearch={handleSearch}
        />

        {/* --- Category Icons (original position) --- */}
        <CategoryIcons showHeader={true} screenType="home" />

        {/* --- Best Seller Carousel --- */}
        <SwipeCarousel stores={bestSellerStores} onStorePress={handleStorePress} />

        {/* --- Filter Buttons --- */}
        <FilterButtons
          selectedFilter={selectedFilter}
          onFilterSelect={handleFilterChange}
          screenType="home"
        />

        {/* --- Stores Section Header --- */}
        <View style={styles.storesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {searchQuery ? 'Search Results' : 'Nearby Stores'}
            </Text>
          </View>
        </View>

        {/* --- Store Cards --- */}
        {stores.map((store) => (
          <View key={store._id} style={styles.storeCardContainer}>
            <ModernStoreCard store={store} onPress={handleStorePress} />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  stickySearchBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    paddingBottom: 4,
    paddingHorizontal: 16,
    zIndex: 100,
    elevation: 0,
  },
  stickyCategoryIcons: {
    position: 'absolute',
    top: 76,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    zIndex: 99,
    elevation: 0,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  storeCardContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  storesSection: {
    marginTop: 16,
    marginBottom: 0,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
