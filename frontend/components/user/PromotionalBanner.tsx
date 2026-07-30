import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LocationSelector from './LocationSelector';
import SearchBar from './SearchBar';

const { width } = Dimensions.get('window');

interface Location {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
}

export interface BannerSlide {
  id: number | string;
  imageUrl?: string;
  imageSource?: any;
  title?: string;
  subtitle?: string;
  onPress?: () => void;
}

interface PromotionalBannerProps {
  onOrderPress?: () => void;
  selectedLocation: Location | null;
  onLocationSelect: (location: Location) => void;
  onSearch: (query: string) => void;
  slides?: BannerSlide[];
}

// Default image banner slides (User provided promotional banners)
const defaultBannerSlides: BannerSlide[] = [
  {
    id: 1,
    imageSource: require('@/assets/images/banners/banner1.jpg'),
    title: 'SAVE YOUR PRECIOUS TIME',
    subtitle: 'Shop Nearby. Save Time. Live Better.',
  },
  {
    id: 2,
    imageSource: require('@/assets/images/banners/banner2.jpg'),
    title: 'SAME DAY DELIVERY',
    subtitle: "Today's Order, Today's Delivery!",
  },
  {
    id: 3,
    imageSource: require('@/assets/images/banners/banner3.jpg'),
    title: 'SHOP BY NEARBY STORES',
    subtitle: 'Your Style. Nearby. Instantly.',
  },
];

const PromotionalBanner: React.FC<PromotionalBannerProps> = ({ 
  onOrderPress, 
  selectedLocation, 
  onLocationSelect, 
  onSearch,
  slides,
}) => {
  const bannerSlidesList = slides && slides.length > 0 ? slides : defaultBannerSlides;
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const intervalRef = useRef<number | null>(null);

  // Auto-scroll functionality
  useEffect(() => {
    const startAutoScroll = () => {
      intervalRef.current = setInterval(() => {
        setCurrentSlide((prev) => {
          const next = (prev + 1) % bannerSlidesList.length;
          scrollViewRef.current?.scrollTo({
            x: next * width,
            animated: true,
          });
          return next;
        });
      }, 3500); // Change slide every 3.5 seconds
    };

    startAutoScroll();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [bannerSlidesList.length]);

  const handleScroll = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentSlide(slideIndex);
  };

  return (
    <View style={styles.container}>
      {/* Full Background Image Slider */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.scrollView}
      >
        {bannerSlidesList.map((slide) => (
          <TouchableOpacity
            key={slide.id}
            activeOpacity={0.9}
            onPress={() => (slide.onPress ? slide.onPress() : onOrderPress?.())}
            style={styles.slideContainer}
          >
            <Image
              source={slide.imageSource ? slide.imageSource : { uri: slide.imageUrl }}
              style={styles.fullBannerImage}
              resizeMode="cover"
            />
            {/* Subtle Gradient Overlay so header address & search bar remain 100% legible */}
            <LinearGradient
              colors={['rgba(0, 0, 0, 0.45)', 'rgba(0, 0, 0, 0.05)', 'rgba(0, 0, 0, 0.35)']}
              locations={[0, 0.5, 1]}
              style={styles.gradientOverlay}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Carousel indicators */}
      <View style={styles.indicators}>
        {bannerSlidesList.map((_, index) => (
          <View
            key={index}
            style={[
              styles.indicator,
              index === currentSlide ? styles.indicatorActive : styles.indicatorInactive,
            ]}
          />
        ))}
      </View>

      {/* Transparent Location Selector Overlay (Positioned top: 50) */}
      <View style={styles.topRow} pointerEvents="box-none">
        <View style={styles.locationContainer} pointerEvents="auto">
          <LocationSelector
            selectedLocation={selectedLocation}
            onLocationSelect={onLocationSelect}
          />
        </View>
      </View>

      {/* Transparent Search Bar Overlay (Positioned top: 105) */}
      <View style={styles.searchContainer} pointerEvents="box-none">
        <View style={styles.searchBarWrapper} pointerEvents="auto">
          <SearchBar onSearch={onSearch} showNavigation={true} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 360,
    width: width,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  slideContainer: {
    width: width,
    height: 360,
    position: 'relative',
  },
  fullBannerImage: {
    width: width,
    height: 360,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topRow: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 15,
    backgroundColor: 'transparent',
    elevation: 10,
  },
  locationContainer: {
    flex: 1,
    zIndex: 16,
  },
  searchContainer: {
    position: 'absolute',
    top: 105,
    left: 0,
    right: 0,
    height: 60,
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 20,
    backgroundColor: 'transparent',
    elevation: 10,
  },
  searchBarWrapper: {
    backgroundColor: 'transparent',
    zIndex: 21,
  },
  indicators: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 25,
  },
  indicator: {
    height: 8,
    borderRadius: 4,
  },
  indicatorActive: {
    width: 22,
    backgroundColor: '#FFFFFF',
  },
  indicatorInactive: {
    width: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
});

export default PromotionalBanner;

