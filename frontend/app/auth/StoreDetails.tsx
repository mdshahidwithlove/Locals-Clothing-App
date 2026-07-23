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
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import ImageUploader from '../../components/ui/ImageUploader';
import LocationPickerScreen from '@/components/ui/LocationPickerScreen';

interface WorkingDays {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

interface StoreData {
  storeName: string;
  description: string;
  storeImages: string[];
  address: string;
  mapLink: string;
  contact: {
    phone: string;
    email: string;
    website: string;
  };
  workingDays: WorkingDays;
}

interface FormErrors {
  storeName?: string;
  address?: string;
  mapLink?: string;
  workingDays?: string;
  contact?: string;
}

const StoreDetails = () => {
  const router = useRouter();
  const { token, login, user } = useAuth();
  
  const [storeData, setStoreData] = useState<StoreData>({
    storeName: '',
    description: '',
    storeImages: [],
    address: '',
    mapLink: '',
    contact: {
      phone: '',
      email: '',
      website: '',
    },
    workingDays: {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false,
    },
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [errors, setErrors] = useState<FormErrors>({});
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Validation function
  const validateForm = useCallback((): FormErrors => {
    const newErrors: FormErrors = {};

    // Store name validation
    if (!storeData.storeName.trim()) {
      newErrors.storeName = 'Store name is required';
    } else if (storeData.storeName.trim().length < 2) {
      newErrors.storeName = 'Store name must be at least 2 characters';
    }

    // Address validation
    if (!storeData.address.trim()) {
      newErrors.address = 'Address is required';
    } else if (storeData.address.trim().length < 5) {
      newErrors.address = 'Address must be at least 5 characters';
    }

    // Map link validation
    if (!storeData.mapLink.trim()) {
      newErrors.mapLink = 'Map link is required';
    }

    // Working days validation
    const hasWorkingDays = Object.values(storeData.workingDays).some(day => day === true);
    if (!hasWorkingDays) {
      newErrors.workingDays = 'Please select at least one working day';
    }

    // Contact validation (optional but if provided, should be valid)
    if (storeData.contact.phone && (storeData.contact.phone.length < 10 || storeData.contact.phone.length > 12)) {
      newErrors.contact = 'Phone number must be between 10-12 digits';
    }

    if (storeData.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(storeData.contact.email)) {
      newErrors.contact = 'Please provide a valid email address';
    }

    if (storeData.contact.website && !/^https?:\/\/.+/.test(storeData.contact.website)) {
      newErrors.contact = 'Website must be a valid URL starting with http:// or https://';
    }

    return newErrors;
  }, [storeData]);

  // Load existing store details for merchants to edit
  React.useEffect(() => {
    const loadExisting = async () => {
      try {
        setIsFetching(true);
        const resp = await apiClient.get('/api/v1/store/details');
        if (resp.data?.success && resp.data.store) {
          const s = resp.data.store;
          setStoreData({
            storeName: s.storeName || '',
            description: s.description || '',
            storeImages: s.storeImages || [],
            address: s.address || '',
            mapLink: s.mapLink || '',
            contact: {
              phone: s.contact?.phone || '',
              email: s.contact?.email || '',
              website: s.contact?.website || '',
            },
            workingDays: {
              monday: !!s.workingDays?.monday,
              tuesday: !!s.workingDays?.tuesday,
              wednesday: !!s.workingDays?.wednesday,
              thursday: !!s.workingDays?.thursday,
              friday: !!s.workingDays?.friday,
              saturday: !!s.workingDays?.saturday,
              sunday: !!s.workingDays?.sunday,
            },
          });
          setIsEditMode(true);
        } else {
          setIsEditMode(false);
        }
      } catch (_err: any) {
        setIsEditMode(false);
      } finally {
        setIsFetching(false);
      }
    };
    loadExisting();
  }, []);


  const handleInputChange = useCallback((field: string, value: string) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setStoreData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof StoreData] as any),
          [child]: value
        }
      }));
    } else {
      setStoreData(prev => ({
        ...prev,
        [field]: value
      }));
    }

    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  }, [errors]);

  const handleImagesChange = useCallback((images: string[]) => {
    setStoreData(prev => ({
      ...prev,
      storeImages: images
    }));
  }, []);

  const handleWorkingDayToggle = useCallback((day: keyof WorkingDays) => {
    setStoreData(prev => ({
      ...prev,
      workingDays: {
        ...prev.workingDays,
        [day]: !prev.workingDays[day]
      }
    }));

    // Clear working days error when user selects a day
    if (errors.workingDays) {
      setErrors(prev => ({
        ...prev,
        workingDays: undefined
      }));
    }
  }, [errors.workingDays]);

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


      // Transform data to match backend expectations
      const backendData = {
        storeName: storeData.storeName,
        storeDescription: storeData.description, // Backend expects storeDescription in request body
        storeImages: storeData.storeImages,
        address: storeData.address,
        mapLink: storeData.mapLink,
        contact: storeData.contact,
        workingDays: storeData.workingDays
      };

      const response = isEditMode
        ? await apiClient.put('/api/v1/store/update', backendData)
        : await apiClient.post('/api/v1/store/create', backendData);

      if (response.data.success) {
        if (response.data.user && token) {
          await login(response.data.user, token);
        } else if (user && token) {
          const profileResp = await apiClient.get('/api/v1/user/profile');
          if (profileResp.data.success && profileResp.data.user) {
            await login(profileResp.data.user, token);
          }
        }

        const nextRoute = isEditMode ? '/(merchantTabs)/' : '/auth/VerificationPending';
        Alert.alert(
          'Success!',
          isEditMode ? 'Your store details have been updated.' : 'Your store details have been saved successfully.',
          [
            {
              text: 'Continue',
              onPress: () => router.replace(nextRoute as any),
            },
          ],
        );
      } else {
        Alert.alert('Error', response.data.message || 'Failed to save store details. Please try again.');
      }
    } catch (error: any) {
      console.error('Store creation error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to save store details. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [validateForm, isLoading, fadeAnim, storeData, login, token, router, user, isEditMode]);

  const renderWorkingDays = () => {
    const days = [
      { key: 'monday' as keyof WorkingDays, label: 'Monday', short: 'Mon' },
      { key: 'tuesday' as keyof WorkingDays, label: 'Tuesday', short: 'Tue' },
      { key: 'wednesday' as keyof WorkingDays, label: 'Wednesday', short: 'Wed' },
      { key: 'thursday' as keyof WorkingDays, label: 'Thursday', short: 'Thu' },
      { key: 'friday' as keyof WorkingDays, label: 'Friday', short: 'Fri' },
      { key: 'saturday' as keyof WorkingDays, label: 'Saturday', short: 'Sat' },
      { key: 'sunday' as keyof WorkingDays, label: 'Sunday', short: 'Sun' },
    ];

    return (
      <View style={styles.workingDaysContainer}>
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar" size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Working Days *</Text>
        </View>
        <Text style={styles.sectionSubtitle}>Select the days your store will be open</Text>
        
        {/* Days Grid */}
        <View style={styles.daysGrid}>
          {days.map((day) => {
            const isSelected = storeData.workingDays[day.key];
            return (
              <TouchableOpacity
                key={day.key}
                style={[
                  styles.dayButton,
                  isSelected && styles.dayButtonSelected,
                  errors.workingDays && styles.dayButtonError
                ]}
                onPress={() => handleWorkingDayToggle(day.key)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dayButtonText,
                  isSelected && styles.dayButtonTextSelected
                ]}>
                  {day.short}
                </Text>
                {isSelected && (
                  <View style={styles.selectedIndicator}>
                    <Ionicons name="checkmark" size={12} color={Colors.textPrimary} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Days Summary */}
        {Object.values(storeData.workingDays).some(day => day === true) && (
          <View style={styles.selectedDaysSummary}>
            <Ionicons name="calendar" size={16} color={Colors.primary} />
            <Text style={styles.selectedDaysText}>
              Store open on: {days.filter(day => storeData.workingDays[day.key]).map(day => day.short).join(', ')}
            </Text>
          </View>
        )}

        {/* Error message for working days */}
        {errors.workingDays && (
          <Text style={styles.errorText}>{errors.workingDays}</Text>
        )}
      </View>
    );
  };

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
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Store Setup</Text>
              <Text style={styles.headerSubtitle}>Complete your store details</Text>
            </View>
            <View style={styles.placeholder} />
          </View>
        </LinearGradient>

        {/* Main Content */}
        <View style={styles.content}>
          <ScrollView 
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.welcomeSection}>
              <View style={styles.welcomeIconContainer}>
                <Ionicons name="storefront" size={32} color={Colors.primary} />
              </View>
              <Text style={styles.title}>Complete Your Store Setup</Text>
              <Text style={styles.subtitle}>
                Add your store details to start selling on our platform
              </Text>
            </View>

            {/* Form Content */}
            <View style={styles.formContent}>
              {/* Store Name */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Store Name *</Text>
                <View style={[
                  styles.inputWrapper,
                  errors.storeName && styles.inputWrapperError
                ]}>
                  <Ionicons 
                    name="storefront-outline" 
                    size={20} 
                    color={storeData.storeName ? Colors.buttonPrimary : Colors.textMuted} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={storeData.storeName}
                    onChangeText={(value) => handleInputChange('storeName', value)}
                    placeholder="Enter your store name"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
                {errors.storeName && (
                  <Text style={styles.errorText}>{errors.storeName}</Text>
                )}
              </View>

              {/* Store Description */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Store Description</Text>
                <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                  <Ionicons 
                    name="document-text-outline" 
                    size={20} 
                    color={storeData.description ? Colors.buttonPrimary : Colors.textMuted} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={storeData.description}
                    onChangeText={(value) => handleInputChange('description', value)}
                    placeholder="Describe your store and what you sell"
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              {/* Store Images */}
              <View style={styles.inputContainer}>
                <ImageUploader
                  label="Store Images"
                  multiple={true}
                  existingUrls={storeData.storeImages}
                  onUploaded={handleImagesChange}
                  fullWidth={false}
                  squareSize={90}
                  maxImages={10}
                />
              </View>

  // Address
              <View style={styles.inputContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.inputLabel}>Store Address *</Text>
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}
                    onPress={() => setShowMapPicker(true)}
                  >
                    <Ionicons name="location" size={14} color={Colors.primary} style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.primary }}>Pin on Map</Text>
                  </TouchableOpacity>
                </View>
                <View style={[
                  styles.inputWrapper,
                  errors.address && styles.inputWrapperError
                ]}>
                  <Ionicons 
                    name="location-outline" 
                    size={20} 
                    color={storeData.address ? Colors.buttonPrimary : Colors.textMuted} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={storeData.address}
                    onChangeText={(value) => handleInputChange('address', value)}
                    placeholder="Enter your store address or pin on map"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
                {errors.address && (
                  <Text style={styles.errorText}>{errors.address}</Text>
                )}
              </View>

              {/* Map Link */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Map Link *</Text>
                <View style={[
                  styles.inputWrapper,
                  errors.mapLink && styles.inputWrapperError
                ]}>
                  <Ionicons 
                    name="map-outline" 
                    size={20} 
                    color={storeData.mapLink ? Colors.buttonPrimary : Colors.textMuted} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={storeData.mapLink}
                    onChangeText={(value) => handleInputChange('mapLink', value)}
                    placeholder="https://maps.google.com/..."
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </View>
                {errors.mapLink && (
                  <Text style={styles.errorText}>{errors.mapLink}</Text>
                )}
              </View>

              {/* Map Picker Modal */}
              <Modal
                visible={showMapPicker}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setShowMapPicker(false)}
              >
                <LocationPickerScreen
                  title="Pin Store Location"
                  onClose={() => setShowMapPicker(false)}
                  onConfirm={({ latitude, longitude, formattedAddress }) => {
                    const generatedMapLink = `https://maps.google.com/?q=${latitude},${longitude}`;
                    setStoreData(prev => ({
                      ...prev,
                      address: formattedAddress,
                      mapLink: generatedMapLink,
                    }));
                    setErrors(prev => ({
                      ...prev,
                      address: undefined,
                      mapLink: undefined,
                    }));
                    setShowMapPicker(false);
                    Alert.alert('Store Location Pinned!', 'Exact store address and coordinates saved.');
                  }}
                />
              </Modal>

              {/* Contact Information */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="call" size={20} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>Contact Information</Text>
                </View>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Phone</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons 
                      name="call-outline" 
                      size={20} 
                      color={storeData.contact.phone ? Colors.buttonPrimary : Colors.textMuted} 
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      value={storeData.contact.phone}
                      onChangeText={(value) => handleInputChange('contact.phone', value)}
                      placeholder="Store phone number"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons 
                      name="mail-outline" 
                      size={20} 
                      color={storeData.contact.email ? Colors.buttonPrimary : Colors.textMuted} 
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      value={storeData.contact.email}
                      onChangeText={(value) => handleInputChange('contact.email', value)}
                      placeholder="Store email address"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Website</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons 
                      name="globe-outline" 
                      size={20} 
                      color={storeData.contact.website ? Colors.buttonPrimary : Colors.textMuted} 
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      value={storeData.contact.website}
                      onChangeText={(value) => handleInputChange('contact.website', value)}
                      placeholder="https://yourstore.com"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="url"
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              </View>

              {/* Contact Error Display */}
              {errors.contact && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{errors.contact}</Text>
                </View>
              )}

              {/* Working Days */}
              {renderWorkingDays()}

              {/* Submit Button */}
              <Animated.View style={{ opacity: fadeAnim }}>
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
                        {isLoading ? "Saving Store..." : "Complete Setup"}
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    paddingBottom: Platform.OS === 'ios' ? 0 : 0,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 25,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textPrimary,
    opacity: 0.8,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  welcomeSection: {
    alignItems: 'center',

  },
  welcomeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  formContent: {
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 10,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  inputContainer: {
    marginBottom: 14,
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
  sectionContainer: {
    marginTop: 20,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  workingDaysContainer: {
    marginTop: 20,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  dayButton: {
    width: '18%',
    minWidth: 50,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  dayButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
    elevation: 4,
    transform: [{ scale: 1.05 }],
  },
  dayButtonError: {
    borderColor: Colors.error,
    shadowColor: Colors.error,
    shadowOpacity: 0.3,
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  dayButtonTextSelected: {
    color: Colors.textPrimary,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedDaysSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  selectedDaysText: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '500',
  },
  errorContainer: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  submitButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 24,
    marginBottom: 40,
    elevation: 8,
    shadowColor: Colors.primary,
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
  imageUploader: {
    marginTop: 8,
  },
});

export default StoreDetails;