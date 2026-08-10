import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useLocation } from '@/contexts/LocationContext';
import { WebMapRegion as Region } from '@/components/ui/WebMapView';
import apiClient from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import LocationPickerScreen from '@/components/ui/LocationPickerScreen';
import ManualAddressScreen from '@/components/ui/ManualAddressScreen';

interface Location {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
}

interface LocationSelectorProps {
  selectedLocation: Location | null;
  onLocationSelect: (location: Location) => void;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  selectedLocation,
  onLocationSelect,
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  // const [searchQuery, setSearchQuery] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [manualAddressVisible, setManualAddressVisible] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const { getCurrentLocation, currentLocation, setSelectedCity, reverseGeocode } = useLocation();
  const { user, updateUser } = useAuth();

  const handleLocationSelect = (location: Location) => {
    onLocationSelect(location);
    setSelectedCity(location.city);
    setIsModalVisible(false);
    // search cleared (search removed)
  };

  const handleUseCurrentLocation = async () => {
    try {
      setIsGettingLocation(true);
      const locationData = await getCurrentLocation();
      
      if (locationData) {
        const currentLocationItem: Location = {
          id: 'current',
          name: locationData.city,
          city: locationData.city,
          state: locationData.state,
          country: locationData.country,
        };
        
        handleLocationSelect(currentLocationItem);
      }
    } catch (error) {
      console.error('Error getting current location:', error);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const openMapPicker = () => {
    setIsModalVisible(false);
    setMapVisible(true);
  };

  const beginEditAddress = (index: number, value: string) => {
    setEditingIndex(index);
    setEditingText(value);
  };

  const cancelEditAddress = () => {
    setEditingIndex(null);
    setEditingText('');
  };

  const saveEditedAddress = async (index: number) => {
    try {
      if (!editingText.trim()) {
        Alert.alert('Validation', 'Address cannot be empty');
        return;
      }
      setIsSaving(true);
      const next = (user?.addresses || []).map((a, i) => (i === index ? editingText.trim() : a));
      const resp = await apiClient.put('/api/v1/user/profile', { addresses: next });
      if (resp.data?.success) {
        await updateUser(resp.data.user);
        cancelEditAddress();
      } else {
        Alert.alert('Error', resp.data?.message || 'Failed to update address');
      }
    } catch (e) {
      console.error('Edit address error:', e);
      Alert.alert('Error', 'Failed to update address');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAddressAt = async (index: number) => {
    Alert.alert('Delete Address', 'Are you sure you want to delete this address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            setIsSaving(true);
            const next = (user?.addresses || []).filter((_, i) => i !== index);
            const resp = await apiClient.put('/api/v1/user/profile', { addresses: next });
            if (resp.data?.success) {
              await updateUser(resp.data.user);
              cancelEditAddress();
            } else {
              Alert.alert('Error', resp.data?.message || 'Failed to delete address');
            }
          } catch (e) {
            console.error('Delete address error:', e);
            Alert.alert('Error', 'Failed to delete address');
          } finally {
            setIsSaving(false);
          }
        }
      }
    ]);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setIsModalVisible(true)}
        activeOpacity={0.7}
      >
        <View style={styles.pinCircle}>
          <Ionicons name="location-sharp" size={18} color="#FFFFFF" />
        </View>
        <View style={styles.locationInfo}>
          <View style={styles.deliverToRow}>
            <Text style={styles.locationLabel}>DELIVER TO</Text>
            <Ionicons name="chevron-down" size={13} color="#000000" style={{ marginLeft: 3 }} />
          </View>
          <Text style={styles.locationName} numberOfLines={1}>
            {selectedLocation ? selectedLocation.name : 'Select Location'}
          </Text>
        </View>
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <SafeAreaView style={styles.fullscreenModal}>
          <LinearGradient
            colors={Colors.gradients.background as [string, string]}
            style={styles.modalGradient}
          >
            {/* Header with Close Button */}
            <View style={styles.modalHeader}>
              <View style={styles.headerContent}>
                <Ionicons name="location-sharp" size={24} color={Colors.primary} />
                <Text style={styles.modalTitle}>Choose Location</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setIsModalVisible(false)}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={28} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            {/* <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={20} color={Colors.textSecondary} />
                <TextInput
                  placeholder="Search city or area"
                  placeholderTextColor={Colors.textSecondary}
                  style={styles.searchInput}
                  value={''}
                  onChangeText={() => {}}
                  autoFocus={false}
                />
                {false && (
                  <TouchableOpacity onPress={() => {}}>
                    <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View> */}

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              {/* Current Location */}
              <TouchableOpacity
                style={styles.actionCard}
                onPress={handleUseCurrentLocation}
                disabled={isGettingLocation}
                activeOpacity={0.7}
              >
                <View style={styles.actionCardContent}>
                  <View style={[styles.iconCircle, { backgroundColor: Colors.success + '20' }]}>
                    <Ionicons name="navigate" size={22} color={Colors.success} />
                  </View>
                  <View style={styles.actionCardInfo}>
                    <Text style={styles.actionCardTitle}>Current Location</Text>
                    <Text style={styles.actionCardSubtitle} numberOfLines={1}>
                      {isGettingLocation 
                        ? 'Detecting...' 
                        : currentLocation 
                          ? `${currentLocation.city}` 
                          : 'Use GPS'}
                    </Text>
                  </View>
                  {isGettingLocation ? (
                    <ActivityIndicator size="small" color={Colors.success} />
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                  )}
                </View>
              </TouchableOpacity>

              {/* Enter Address Manually */}
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => {
                  setIsModalVisible(false);
                  setManualAddressVisible(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.actionCardContent}>
                  <View style={[styles.iconCircle, { backgroundColor: Colors.primary + '20' }]}>
                    <Ionicons name="create-outline" size={22} color={Colors.primary} />
                  </View>
                  <View style={styles.actionCardInfo}>
                    <Text style={styles.actionCardTitle}>Enter Address Manually</Text>
                    <Text style={styles.actionCardSubtitle}>Fill in house, street, city, pincode</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </View>
              </TouchableOpacity>

              {/* Add New Address */}
              <TouchableOpacity
                style={styles.actionCard}
                onPress={openMapPicker}
                activeOpacity={0.7}
              >
                <View style={styles.actionCardContent}>
                  <View style={[styles.iconCircle, { backgroundColor: Colors.primary + '20' }]}>
                    <Ionicons name="map" size={22} color={Colors.primary} />
                  </View>
                  <View style={styles.actionCardInfo}>
                    <Text style={styles.actionCardTitle}>Pick on Map</Text>
                    <Text style={styles.actionCardSubtitle}>Select location on map</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Saved Addresses */}
            {!!(user?.addresses && user.addresses.length) && (
              <View style={styles.savedSection}>
                <View style={styles.sectionHeaderContainer}>
                  <Ionicons name="bookmark" size={18} color={Colors.primary} />
                  <Text style={styles.sectionHeader}>Saved Addresses</Text>
                </View>
                <FlatList
                  data={user.addresses}
                  keyExtractor={(item, idx) => `${idx}`}
                  renderItem={({ item, index }) => (
                    <View style={styles.savedAddressCard}>
                      {editingIndex === index ? (
                        <View style={styles.editContainer}>
                          <TextInput
                            style={styles.editInput}
                            value={editingText}
                            onChangeText={setEditingText}
                            multiline
                            placeholder="Enter address"
                            placeholderTextColor={Colors.textSecondary}
                          />
                          <View style={styles.editActions}>
                            <TouchableOpacity 
                              style={styles.editButton} 
                              onPress={cancelEditAddress} 
                              disabled={isSaving}
                            >
                              <Ionicons name="close" size={18} color={Colors.textSecondary} />
                              <Text style={styles.editButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.editButton, styles.saveButton]} 
                              onPress={() => saveEditedAddress(index)} 
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <ActivityIndicator size="small" color={Colors.textPrimary} />
                              ) : (
                                <>
                                  <Ionicons name="checkmark" size={18} color={Colors.textPrimary} />
                                  <Text style={[styles.editButtonText, { color: Colors.textPrimary }]}>Save</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.savedAddressContent}>
                          <TouchableOpacity
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                            activeOpacity={0.7}
                            onPress={() => {
                              const cityPart = item.split(',').map((p) => p.trim())[2] || item;
                              handleLocationSelect({
                                id: `saved_${index}`,
                                name: cityPart,
                                city: cityPart,
                                state: '',
                                country: 'India',
                              });
                            }}
                          >
                            <View style={[styles.iconCircle, styles.smallIconCircle, { marginRight: 8 }]}>
                              <Ionicons name="home" size={18} color={Colors.primary} />
                            </View>
                            <Text style={styles.savedAddressText} numberOfLines={2}>{item}</Text>
                          </TouchableOpacity>
                          <View style={styles.addressActions}>
                            <TouchableOpacity 
                              onPress={() => beginEditAddress(index, item)} 
                              style={styles.actionIcon}
                            >
                              <Ionicons name="pencil" size={18} color={Colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              onPress={() => deleteAddressAt(index)} 
                              style={styles.actionIcon}
                            >
                              <Ionicons name="trash" size={18} color={Colors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                  ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.savedListContent}
                />
              </View>
            )}
          </LinearGradient>
        </SafeAreaView>
      </Modal>

      {/* Map Picker Modal */}
      <Modal
        visible={mapVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setMapVisible(false)}
      >
        <LocationPickerScreen
          initialRegion={mapRegion || undefined}
          title="Choose Location"
          onClose={() => {
            setMapVisible(false);
            setIsModalVisible(true);
          }}
          onConfirm={async ({ latitude, longitude, formattedAddress }) => {
            try {
              const nextAddresses = [...(user?.addresses || []), formattedAddress];
              const resp = await apiClient.put('/api/v1/user/profile', { addresses: nextAddresses });
              if (resp.data?.success) {
                await updateUser(resp.data.user);
              }
              const addr = await reverseGeocode(latitude, longitude);
              if (addr) {
                setSelectedCity(addr.city);
                const locItem: Location = {
                  id: 'picked',
                  name: addr.city,
                  city: addr.city,
                  state: addr.state,
                  country: addr.country,
                };
                onLocationSelect(locItem);
              }
              setMapVisible(false);
              setIsModalVisible(false);
              Alert.alert('Success', 'Address added successfully');
            } catch (error) {
              console.error('Error saving address:', error);
              Alert.alert('Error', 'Failed to add address');
            }
          }}
        />
      </Modal>

      <ManualAddressScreen
        visible={manualAddressVisible}
        onClose={() => {
          setManualAddressVisible(false);
          setIsModalVisible(true);
        }}
        title="Enter Address"
        isSaving={isSaving}
        showLocationActions={false}
        onSave={async (formattedAddress) => {
          try {
            setIsSaving(true);
            const nextAddresses = [...(user?.addresses || []), formattedAddress];
            const resp = await apiClient.put('/api/v1/user/profile', { addresses: nextAddresses });
            if (resp.data?.success) {
              await updateUser(resp.data.user);
              const cityPart = formattedAddress.split(',').map((p) => p.trim())[2] || formattedAddress;
              onLocationSelect({
                id: 'manual',
                name: cityPart,
                city: cityPart,
                state: '',
                country: 'India',
              });
              setManualAddressVisible(false);
              Alert.alert('Success', 'Address added successfully');
            }
          } catch (error) {
            console.error('Error saving address:', error);
            Alert.alert('Error', 'Failed to add address');
          } finally {
            setIsSaving(false);
          }
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  pinCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  locationInfo: {
    justifyContent: 'center',
  },
  deliverToRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationLabel: {
    fontSize: 10,
    color: '#000000',
    fontWeight: '800',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(255, 255, 255, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  locationName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '800',
    marginTop: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  fullscreenModal: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalGradient: {
    flex: 1,
    paddingTop: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '30',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 52,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 12,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  quickActions: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  actionCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  actionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  smallIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: Colors.primary + '20',
  },
  actionCardInfo: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  actionCardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  savedSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  savedListContent: {
    paddingBottom: 20,
  },
  savedAddressCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  savedAddressContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savedAddressText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  addressActions: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
  },
  actionIcon: {
    padding: 8,
    borderRadius: 8,
  },
  editContainer: {
    gap: 12,
  },
  editInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    color: Colors.textPrimary,
    backgroundColor: Colors.backgroundSecondary,
    minHeight: 70,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  cardSeparator: {
    height: 12,
  },
});

export default LocationSelector;