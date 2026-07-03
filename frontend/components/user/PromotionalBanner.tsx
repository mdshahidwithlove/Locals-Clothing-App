import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import LocationSelector from './LocationSelector';
import SearchBar from './SearchBar';
import { useLocation } from '@/contexts/LocationContext';

const { width } = Dimensions.get('window');

interface Location {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
}

interface BannerSlide {
  id: number;
  title: string;
  subtitle: string;
  buttonText: string;
  gradient: readonly [string, string, ...string[]];
  images: string[];
}

interface PromotionalBannerProps {
  onOrderPress?: () => void;
  selectedLocation: Location | null;
  onLocationSelect: (location: Location) => void;
  onSearch: (query: string) => void;
}

// Banner slides data
const bannerSlides: BannerSlide[] = [
  {
    id: 1,
    title: "50% FLAT",
    subtitle: "OFF",
    buttonText: "Shop now",
    gradient: ['#FFD700', '#FF8C00'],
    images: [
      "https://cdn-icons-png.flaticon.com/128/1867/1867565.png", // T-Shirt
      "https://cdn-icons-png.flaticon.com/128/3046/3046982.png", // Shirt
      "https://cdn-icons-png.flaticon.com/128/2122/2122621.png"  // Top
    ]
  },
  {
    id: 2,
    title: "NEW",
    subtitle: "Collection",
    buttonText: "Explore",
    gradient: ['#4ECDC4', '#45B7D1'],
    images: [
      "https://cdn-icons-png.flaticon.com/128/2682/2682178.png", // Dress
      "https://cdn-icons-png.flaticon.com/128/9992/9992462.png", // Kurta
      "https://cdn-icons-png.flaticon.com/128/17981/17981822.png" // Saree
    ]
  },
  {
    id: 3,
    title: "FREE",
    subtitle: "DELIVERY",
    buttonText: "Order now",
    gradient: ['#A8E6CF', '#FFD93D'],
    images: [
      "https://cdn-icons-png.flaticon.com/128/3601/3601647.png", // Bicycle
      "https://cdn-icons-png.flaticon.com/128/2806/2806051.png", // Jacket
      "https://cdn-icons-png.flaticon.com/128/776/776623.png"    // Pants
    ]
  }
];

const PromotionalBanner: React.FC<PromotionalBannerProps> = ({ 
  onOrderPress, 
  selectedLocation, 
  onLocationSelect, 
  onSearch 
}) => {
  const { selectedCity, currentLocation } = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const intervalRef = useRef<number | null>(null);
  const bicycleAnimation = useRef(new Animated.Value(0)).current;

  // Auto-scroll functionality
  useEffect(() => {
    const startAutoScroll = () => {
      intervalRef.current = setInterval(() => {
        setCurrentSlide((prev) => {
          const next = (prev + 1) % bannerSlides.length;
          scrollViewRef.current?.scrollTo({
            x: next * width,
            animated: true,
          });
          return next;
        });
      }, 3000); // Change slide every 3 seconds
    };

    startAutoScroll();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Bicycle animation for free delivery slide
  useEffect(() => {
    if (currentSlide === 2) { // Free delivery slide
      const animateBicycle = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(bicycleAnimation, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(bicycleAnimation, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };
      animateBicycle();
    }
  }, [currentSlide, bicycleAnimation]);

  const handleScroll = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentSlide(slideIndex);
  };

  const renderBannerSlide = (slide: BannerSlide) => (
    <View key={slide.id} style={styles.slideContainer}>
      <LinearGradient
        colors={slide.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Sparkle decorations */}
        <View style={styles.sparkleContainer}>
          <View style={[styles.sparkle, styles.sparkle1]} />
          <View style={[styles.sparkle, styles.sparkle2]} />
          <View style={[styles.sparkle, styles.sparkle3]} />
          <View style={[styles.sparkle, styles.sparkle4]} />
          <View style={[styles.sparkle, styles.sparkle5]} />
        </View>

        <View style={styles.content}>
          {/* Left side - Text content */}
          <View style={styles.textContainer}>
            <Text style={styles.flatText}>{slide.title}</Text>
            <Text style={styles.offText}>{slide.subtitle}</Text>
            
            <TouchableOpacity
              style={styles.orderButton}
              onPress={onOrderPress}
              activeOpacity={0.8}
            >
              <Text style={styles.orderButtonText}>{slide.buttonText}</Text>
              <Ionicons name="chevron-forward" size={16} color="white" />
            </TouchableOpacity>
          </View>

          {/* Right side - Multiple Images */}
          <View style={styles.imageContainer}>
            <View style={styles.imagesGrid}>
              {slide.images.map((imageUri, index) => (
                <View key={index} style={styles.imageWrapper}>
                  {slide.id === 3 && index === 0 ? (
                    <Animated.View
                      style={[
                        styles.animatedImageContainer,
                        {
                          transform: [
                            {
                              translateX: bicycleAnimation.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 8],
                              }),
                            },
                            {
                              scale: bicycleAnimation.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 1.05],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: imageUri }}
                        style={styles.bannerImage}
                        resizeMode="contain"
                      />
                    </Animated.View>
                  ) : (
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.bannerImage}
                      resizeMode="contain"
                    />
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Carousel indicators - inside banner */}
        <View style={styles.indicators}>
          {bannerSlides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                index === currentSlide ? styles.indicatorActive : styles.indicatorInactive
              ]}
            />
          ))}
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Scrolling Banner Background */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.scrollView}
      >
        {bannerSlides.map(renderBannerSlide)}
      </ScrollView>

      {/* Transparent Location Selector Overlay */}
      <View style={styles.topRow} pointerEvents="box-none">
        <View style={styles.locationContainer} pointerEvents="auto">
          <LocationSelector
            selectedLocation={selectedLocation}
            onLocationSelect={onLocationSelect}
          />
        </View>
      </View>

      {/* Transparent Search Bar Overlay */}
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
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  scrollView: {
    flex: 1,
  },
  slideContainer: {
    width: width,
    height: 360,
  },
  gradient: {
    flex: 1,
    position: 'relative',
  },
  topRow: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 15,
    backgroundColor: 'transparent',
    // Ensure touch events are captured properly
    elevation: 10,
  },
  locationContainer: {
    flex: 1,
    // Prevent touch events from bubbling to parent
    zIndex: 16,
  },
  searchContainer: {
    position: 'absolute',
    top: 105,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 20, // Highest z-index for search bar
    backgroundColor: 'transparent',
    elevation: 10, // Ensure proper layering on Android
  },
  searchBarWrapper: {
    // Ensure touch events are properly captured
    backgroundColor: 'transparent',
    zIndex: 21,
    // Prevent touch events from bubbling to banner content
  },
  sparkleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  sparkle: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: 'white',
    borderRadius: 2,
    opacity: 0.8,
  },
  sparkle1: { top: 20, left: 50 },
  sparkle2: { top: 40, right: 60 },
  sparkle3: { top: 80, left: 30 },
  sparkle4: { top: 120, right: 40 },
  sparkle5: { top: 150, left: 80 },
  content: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 165,
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    zIndex: 2,
  },
  flatText: {
    fontSize: 32,
    fontWeight: '900',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
    letterSpacing: 2,
    lineHeight: 36,
  },
  offText: {
    fontSize: 32,
    fontWeight: '900',
    color: 'white',
    marginTop: -5,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
    letterSpacing: 2,
    lineHeight: 44,
  },
  orderButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 16,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  orderButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imageWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  bannerImage: {
    width: 40,
    height: 40,
  },
  animatedImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicators: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  indicatorActive: {
    backgroundColor: '#007AFF',
  },
  indicatorInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
});

export default PromotionalBanner;
