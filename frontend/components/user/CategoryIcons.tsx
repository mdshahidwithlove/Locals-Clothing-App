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

// Get all subcategories from PRODUCT_SUBCATEGORIES with gender-based ordering
const getAllSubcategories = (userGender?: 'Male' | 'Female' | 'Other') => {
  const allSubcategories: string[] = [];
  Object.values(PRODUCT_SUBCATEGORIES).forEach(subcategories => {
    allSubcategories.push(...subcategories);
  });
  // Remove duplicates
  const uniqueSubcategories = [...new Set(allSubcategories)];
  
  // If user has gender preference, prioritize gender-based categories first
  if (userGender && userGender !== 'Other') {
    // Map user gender to product category
    const genderToCategory: { [key: string]: keyof typeof PRODUCT_SUBCATEGORIES } = {
      'Male': 'Men',
      'Female': 'Women'
    };
    
    const categoryKey = genderToCategory[userGender];
    if (categoryKey) {
      const genderCategories = PRODUCT_SUBCATEGORIES[categoryKey] || [];
      const otherCategories = uniqueSubcategories.filter(cat => !(genderCategories as readonly string[]).includes(cat));
      
      // Return gender categories first, then others in alphabetical order
      return [...genderCategories, ...otherCategories.sort()];
    }
  }
  
  // If no gender preference, return all in alphabetical order
  return uniqueSubcategories.sort();
};

const remote = (uri: string): ImageSourcePropType => ({ uri });

// Image mapping for subcategories with high-quality realistic fashion photos
export const getImageForSubcategory = (subcategory: string): ImageSourcePropType => {
  const imageMap: { [key: string]: ImageSourcePropType } = {
    // Tops & Shirts
    Shirts: remote('https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=150&h=150&fit=crop&q=80'),
    'T-Shirts': remote('https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=150&h=150&fit=crop&q=80'),
    Tops: remote('https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=150&h=150&fit=crop&q=80'),
    Hoodies: remote('https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=150&h=150&fit=crop&q=80'),
    Sweatshirts: remote('https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=150&h=150&fit=crop&q=80'),
    Sweaters: remote('https://images.unsplash.com/photo-1614975058789-41316d0e2e9c?w=150&h=150&fit=crop&q=80'),
    Cardigans: remote('https://images.unsplash.com/photo-1574164904299-3a102b110380?w=150&h=150&fit=crop&q=80'),
    
    // Bottoms
    Pants: remote('https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=150&h=150&fit=crop&q=80'),
    Jeans: remote('https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=150&h=150&fit=crop&q=80'),
    Shorts: remote('https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=150&h=150&fit=crop&q=80'),
    Leggings: remote('https://images.unsplash.com/photo-1506152983158-b4a74a01c721?w=150&h=150&fit=crop&q=80'),
    Skirts: remote('https://images.unsplash.com/photo-1583496661160-fb48862c4841?w=150&h=150&fit=crop&q=80'),
    
    // Outerwear
    Jackets: remote('https://images.unsplash.com/photo-1551028719-00167b16eac5?w=150&h=150&fit=crop&q=80'),
    Blazers: remote('https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=150&h=150&fit=crop&q=80'),
    Coats: remote('https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=150&fit=crop&q=80'),
    Suits: remote('https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=150&h=150&fit=crop&q=80'),
    
    // Dresses & Ethnic
    Dresses: remote('https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=150&h=150&fit=crop&q=80'),
    Sarees: remote('https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=150&h=150&fit=crop&q=80'),
    Kurtas: remote('https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=150&h=150&fit=crop&q=80'),
    
    // Additional categories
    Underwear: remote('https://images.unsplash.com/photo-1608228088998-57828365d486?w=150&h=150&fit=crop&q=80'),
    Sleepwear: remote('https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=150&h=150&fit=crop&q=80'),
    Activewear: remote('https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=150&h=150&fit=crop&q=80'),
    Swimwear: remote('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=150&h=150&fit=crop&q=80'),
    'Ethnic Wear': remote('https://images.unsplash.com/photo-1609357605129-26f69add5d6e?w=150&h=150&fit=crop&q=80'),
  };
  
  return imageMap[subcategory] || remote('https://images.unsplash.com/photo-1608228088998-57828365d486?w=150&h=150&fit=crop&q=80');
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