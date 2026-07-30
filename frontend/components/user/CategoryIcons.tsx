import React, { useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Image,
  InteractionManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { PRODUCT_SUBCATEGORIES } from '@/types/product';
import { useAuth } from '@/contexts/AuthContext';
import CategoryGridModal, { GridItem } from '@/components/ui/CategoryGridModal';
import type { ImageSourcePropType } from 'react-native';

interface CategoryIconsProps {
  onCategoryPress?: (subcategory: string) => void; // Made optional since we'll use navigation
  showHeader?: boolean; // Whether to show the header
  screenType?: 'home' | 'category'; // Screen type to determine behavior
  selectedSubcategory?: string; // For category screen: highlight selected
  headerTitle?: string; // Custom header title
  subcategories?: string[]; // Optional whitelist of subcategories to display
  showSeeAll?: boolean; // Control See All button visibility
  noMargin?: boolean; // Remove top margin when true
}

const { width: screenWidth } = Dimensions.get('window');
const itemWidth = (screenWidth - 32 - 32) / 5; // 5 items per row with gaps

// Master ordered list of categories per exact user request
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

// Get all subcategories in exact user requested sequence first, followed by others
const getAllSubcategories = (userGender?: 'Male' | 'Female' | 'Other') => {
  const allSubcategories: string[] = [];
  Object.values(PRODUCT_SUBCATEGORIES).forEach(subcategories => {
    allSubcategories.push(...subcategories);
  });
  
  const uniqueSubcategories = [...new Set(allSubcategories)];
  
  // Extract priority items in exact order
  const priorityItems = PRIORITY_SUBCATEGORY_ORDER.filter(item => uniqueSubcategories.includes(item));
  const remainingItems = uniqueSubcategories.filter(item => !PRIORITY_SUBCATEGORY_ORDER.includes(item));

  return [...priorityItems, ...remainingItems];
};

const remote = (uri: string): ImageSourcePropType => ({ uri });

// Image mapping for subcategories with 3D model assets on clean background
export const getImageForSubcategory = (subcategory: string): ImageSourcePropType => {
  const local3DImages: { [key: string]: ImageSourcePropType } = {
    Shirts: require('@/assets/images/categories/shirts.png'),
    Jeans: require('@/assets/images/categories/jeans.png'),
    Lower: require('@/assets/images/categories/lower.png'),
    Lowers: require('@/assets/images/categories/lower.png'),
    'T-Shirts': require('@/assets/images/categories/tshirts.png'),
    'T Shirts': require('@/assets/images/categories/tshirts.png'),
    Footwear: require('@/assets/images/categories/footwear.png'),
    Shoes: require('@/assets/images/categories/footwear.png'),
    Pants: require('@/assets/images/categories/pants.png'),
    Shorts: require('@/assets/images/categories/shorts.png'),
    Accessories: require('@/assets/images/categories/accessories.png'),
    Undergarments: require('@/assets/images/categories/undergarments.png'),
    Underwear: require('@/assets/images/categories/undergarments.png'),
    Dresses: require('@/assets/images/categories/dresses.jpg'),
    Tops: require('@/assets/images/categories/tops.png'),
    Jackets: require('@/assets/images/categories/jackets.jpg'),
    Sarees: require('@/assets/images/categories/sarees.jpg'),
    Kurtas: require('@/assets/images/categories/kurtas.jpg'),
    Hoodies: require('@/assets/images/categories/hoodies.jpg'),
    Sweatshirts: require('@/assets/images/categories/sweatshirts.jpg'),
    Sweaters: require('@/assets/images/categories/sweatshirts.jpg'),
    Cardigans: require('@/assets/images/categories/sweatshirts.jpg'),
    Skirts: require('@/assets/images/categories/skirts.jpg'),
    Leggings: require('@/assets/images/categories/leggings.jpg'),
    Blazers: require('@/assets/images/categories/blazers.jpg'),
    Coats: require('@/assets/images/categories/coats.jpg'),
    Suits: require('@/assets/images/categories/suits.jpg'),
    Sleepwear: require('@/assets/images/categories/sleepwear.png'),
    Activewear: require('@/assets/images/categories/activewear.png'),
    Swimwear: require('@/assets/images/categories/swimwear.png'),
    'Ethnic Wear': require('@/assets/images/categories/ethnicwear.png'),
  };

  return local3DImages[subcategory] || require('@/assets/images/categories/tshirts.png');
};

const CategoryIcons: React.FC<CategoryIconsProps> = ({ 
  onCategoryPress, 
  showHeader = true, 
  screenType = 'home',
  selectedSubcategory,
  headerTitle,
  subcategories,
  showSeeAll = true,
  noMargin = false,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const navigatingRef = useRef(false);
  
  // Get subcategories based on user gender
  const DEFAULT_SUBCATEGORIES = getAllSubcategories(user?.gender);
  const SUBCATEGORIES = useMemo(() => {
    if (subcategories && subcategories.length > 0) {
      // Keep order as provided, but ensure unique
      return Array.from(new Set(subcategories));
    }
    return DEFAULT_SUBCATEGORIES;
  }, [subcategories, DEFAULT_SUBCATEGORIES]);

  const handleCategoryPress = (subcategory: string) => {
    console.log(`Category button pressed: ${subcategory}`);
    
    if (screenType === 'category' && onCategoryPress) {
      // On category screen, use the callback to update the same screen
      onCategoryPress(subcategory);
    } else {
      // On home screen, navigate to category screen
      try {
        if (navigatingRef.current) {
          return;
        }
        navigatingRef.current = true;
        let categorySlug = subcategory.toLowerCase().replace(/\s+/g, '-');
        
        // Handle special cases
        if (subcategory === 'T-Shirts') {
          categorySlug = 't-shirts';
        }
        
        console.log(`Navigating to category: ${categorySlug} (from subcategory: ${subcategory})`);
        // Defer navigation until after current interactions to avoid state updates during insertion
        InteractionManager.runAfterInteractions(() => {
          router.push(`/category/${categorySlug}` as any);
        });
        // Release lock shortly after to avoid rapid double navigations
        setTimeout(() => {
          navigatingRef.current = false;
        }, 800);
      } catch (error) {
        console.error(`Error navigating to category ${subcategory}:`, error);
        navigatingRef.current = false;
      }
    }
  };
  const modalItems: GridItem[] = useMemo(() => (
    SUBCATEGORIES.map((sc) => ({ key: sc, label: sc, iconSource: getImageForSubcategory(sc) }))
  ), [SUBCATEGORIES]);

  const handleSelectFromModal = (item: GridItem) => {
    // Close modal first to prevent state updates during navigation transition
    setModalVisible(false);
    // Navigate on next tick to ensure modal state commits before routing
    setTimeout(() => handleCategoryPress(item.label), 0);
  };

  return (
    <View style={[styles.container, noMargin && { marginTop: 0 }]}>
      {showHeader && (
        <View style={styles.header}>
          <Text style={styles.title}>{headerTitle || 'Shop by Category'}</Text>
          {showSeeAll && (
            <TouchableOpacity activeOpacity={0.7} onPress={() => setModalVisible(true)}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {SUBCATEGORIES.map((subcategory, index) => {
          const isSelected = screenType === 'category' && selectedSubcategory === subcategory;
          return (
            <TouchableOpacity
              key={subcategory}
              style={[
                styles.categoryItem,
                { width: itemWidth },
                index === SUBCATEGORIES.length - 1 && styles.lastItem
              ]}
              onPress={() => handleCategoryPress(subcategory)}
              activeOpacity={0.6}
              delayPressIn={0}
              delayPressOut={0}
              hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
            >
              <View style={styles.iconContainer}>
                <Image
                  source={getImageForSubcategory(subcategory)}
                  style={styles.categoryImage}
                  resizeMode="contain"
                  onError={() => console.log(`Failed to load image for ${subcategory}`)}
                  defaultSource={{ uri: 'https://cdn-icons-png.flaticon.com/128/13434/13434972.png' }}
                />
              </View>
              <Text style={styles.categoryName} numberOfLines={2}>
                {subcategory}
              </Text>
              {isSelected && <View style={styles.selectedUnderline} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <CategoryGridModal
        visible={modalVisible}
        title="Categories"
        items={modalItems}
        onSelect={handleSelectFromModal}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
    zIndex: 10, // Ensure category icons are above other elements
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  scrollView: {
    paddingLeft: 16,
  },
  scrollContent: {
    paddingRight: 16,
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: 16,
    paddingHorizontal: 8,
    paddingVertical: 8, // Add vertical padding for better touch area
    minHeight: 100, // Ensure minimum touch area
  },
  lastItem: {
    marginRight: 0,
  },
  iconContainer: {
    width: 64,
    height: 64,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryImage: {
    width: 68,
    height: 68,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  categoryName: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 0,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  selectedUnderline: {
    height: 3,
    width: 28,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    alignSelf: 'center',
    marginTop: 6,
  },
});

export default CategoryIcons;