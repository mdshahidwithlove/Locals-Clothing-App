import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import apiClient from '@/api/client';
import { Region } from 'react-native-maps';
import { useLocation } from '@/contexts/LocationContext';
import LocationPickerScreen from '@/components/ui/LocationPickerScreen';
import ManualAddressScreen from '@/components/ui/ManualAddressScreen';

interface Address {
  id: string;
  address: string;
  isDefault?: boolean;
}

interface AddressSelectorProps {
  selectedAddress: string | null;
  selectedPhone: string | null;
  onAddressSelect: (address: string, phone: string) => void;
  onAddNewAddress: (address: string, phone: string) => void;
}

export default function AddressSelector({ 
  selectedAddress,
  selectedPhone,
  onAddressSelect, 
  onAddNewAddress 
}: AddressSelectorProps) {
  const { user, updateUser } = useAuth();
  const { currentLocation, getCurrentLocation } = useLocation();
  const [modalVisible, setModalVisible] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [manualAddressVisible, setManualAddressVisible] = useState(false);
  const [mapPrefillAddress, setMapPrefillAddress] = useState<string | undefined>(undefined);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  useEffect(() => {
    if (modalVisible) {
      loadAddresses();
      // Initialize phone with user's phone or selected phone
      setDeliveryPhone(selectedPhone || user?.phone || '');
    }
  }, [modalVisible, user?.phone, selectedPhone]);

  const loadAddresses = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/api/v1/user/profile');
      
      if (response.data.success && response.data.user.addresses) {
        const userAddresses = response.data.user.addresses.map((addr: string, index: number) => ({
          id: `addr_${index}`,
          address: addr,
          isDefault: index === 0 // First address is default
        }));
        setAddresses(userAddresses);
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
      Alert.alert('Error', 'Failed to load addresses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddressSelect = (address: string) => {
    // Validate phone before selection
    if (!deliveryPhone || deliveryPhone.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number for delivery contact');
      return;
    }
    onAddressSelect(address, deliveryPhone);
    setModalVisible(false);
  };

  const handleAddNewAddress = async () => {
    if (!newAddress.trim()) {
      Alert.alert('Error', 'Please enter a valid address');
      return;
    }

    if (!deliveryPhone || deliveryPhone.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number for delivery contact');
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiClient.put('/api/v1/user/profile', {
        addresses: [...(user?.addresses || []), newAddress.trim()]
      });

      if (response.data.success) {
        onAddNewAddress(newAddress.trim(), deliveryPhone);
        setNewAddress('');
        setDeliveryPhone(user?.phone || '');
        setShowAddForm(false);
        setModalVisible(false);
        Alert.alert('Success', 'Address added successfully');
      }
    } catch (error) {
      console.error('Error adding address:', error);
      Alert.alert('Error', 'Failed to add address');
    } finally {
      setIsLoading(false);
    }
  };

  const saveManualAddress = async (formattedAddress: string) => {
    if (!deliveryPhone || deliveryPhone.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number for delivery contact');
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiClient.put('/api/v1/user/profile', {
        addresses: [...(user?.addresses || []), formattedAddress.trim()],
      });

      if (response.data.success) {
        await updateUser(response.data.user);
        onAddNewAddress(formattedAddress.trim(), deliveryPhone);
        setManualAddressVisible(false);
        setShowAddForm(false);
        setModalVisible(false);
        Alert.alert('Success', 'Address added successfully');
      }
    } catch (error) {
      console.error('Error adding address:', error);
      Alert.alert('Error', 'Failed to add address');
    } finally {
      setIsLoading(false);
    }
  };

  const getDisplayText = () => {
    if (selectedAddress) {
      return selectedAddress.length > 50 
        ? selectedAddress.substring(0, 50) + '...' 
        : selectedAddress;
    }
    return 'Select delivery address';
  };

  const openMap = useCallback(async () => {
    try {
      // Initialize region from current location or a sensible default
      let initLat = currentLocation?.latitude ?? 12.9716; // Bengaluru default
      let initLng = currentLocation?.longitude ?? 77.5946;
      if (!currentLocation) {
        const loc = await getCurrentLocation();
        if (loc) {
          initLat = loc.latitude;
          initLng = loc.longitude;
        }
      }
      setMapRegion({
        latitude: initLat,
        longitude: initLng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      setMapVisible(true);
    } catch {
      // noop
    }
  }, [currentLocation, getCurrentLocation]);

  const confirmPickedAddress = async (params: { latitude: number; longitude: number; formattedAddress: string }) => {
    setMapPrefillAddress(params.formattedAddress);
    setMapVisible(false);
    setManualAddressVisible(true);
  };

  const handleSavePhoneNumber = async () => {
    if (!deliveryPhone || deliveryPhone.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    if (user?.isPhoneVerified && deliveryPhone !== user.phone) {
      Alert.alert('Error', 'Cannot change verified phone number');
      return;
    }

    if (deliveryPhone === user?.phone) {
      Alert.alert('Info', 'This phone number is already saved to your profile');
      return;
    }

    try {
      setIsSavingPhone(true);
      const response = await apiClient.put('/api/v1/user/profile', {
        phone: deliveryPhone
      });

      if (response.data.success) {
        await updateUser(response.data.user);
        Alert.alert('Success', 'Phone number saved to your profile successfully!');
      } else {
        Alert.alert('Error', response.data.message || 'Failed to save phone number');
      }
    } catch (error: any) {
      console.error('Error saving phone number:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to save phone number');
    } finally {
      setIsSavingPhone(false);
    }
  };

  return (
    <>
      <TouchableOpacity 
        style={styles.selector}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.selectorContent}>
          <View style={styles.selectorLeft}>
            <Ionicons 
              name="location-outline" 
              size={20} 
              color={selectedAddress ? Colors.buttonPrimary : Colors.textMuted} 
            />
            <View style={styles.selectorText}>
              <Text style={[
                styles.selectorLabel,
                { color: selectedAddress ? Colors.textPrimary : Colors.textMuted }
              ]}>
                {selectedAddress ? 'Delivery Address' : 'Select Delivery Address'}
              </Text>
              <Text style={[
                styles.selectorValue,
                { color: selectedAddress ? Colors.textPrimary : Colors.textMuted }
              ]}>
                {getDisplayText()}
              </Text>
            </View>
          </View>
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={Colors.textMuted} 
          />
        </View>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Address</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.modalContent}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading addresses...</Text>
              </View>
            ) : (
              <>
                {/* Delivery Contact Number - Always visible */}
                <View style={styles.phoneSection}>
                  <View style={styles.phoneSectionHeader}>
                    <Text style={styles.phoneSectionTitle}>Delivery Contact Number</Text>
                    {deliveryPhone && deliveryPhone.length === 10 && deliveryPhone !== user?.phone && (
                      <TouchableOpacity 
                        style={styles.savePhoneButton}
                        onPress={handleSavePhoneNumber}
                        disabled={isSavingPhone || user?.isPhoneVerified}
                      >
                        <Ionicons name="save-outline" size={16} color={Colors.buttonPrimary} />
                        <Text style={styles.savePhoneButtonText}>
                          {isSavingPhone ? 'Saving...' : 'Save to Profile'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.phoneInputContainer}>
                    <Ionicons name="call-outline" size={20} color={Colors.textMuted} />
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="Enter 10-digit contact number"
                      value={deliveryPhone}
                      onChangeText={(text) => {
                        // Only allow digits and limit to 10
                        const cleaned = text.replace(/\D/g, '').slice(0, 10);
                        setDeliveryPhone(cleaned);
                      }}
                      keyboardType="number-pad"
                      maxLength={10}
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                  {deliveryPhone && deliveryPhone.length < 10 && (
                    <Text style={styles.phoneError}>
                      Phone must be 10 digits ({deliveryPhone.length}/10)
                    </Text>
                  )}
                  <Text style={styles.phoneHelp}>
                    This number will be used by the delivery person to contact you
                  </Text>
                  {user?.phone && deliveryPhone === user.phone && (
                    <View style={styles.phoneSavedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                      <Text style={styles.phoneSavedText}>This number is saved to your profile</Text>
                    </View>
                  )}
                </View>

                {addresses.length > 0 ? (
                  <>
                    {addresses.map((address) => (
                      <TouchableOpacity
                        key={address.id}
                        style={[
                          styles.addressItem,
                          selectedAddress === address.address && styles.selectedAddress
                        ]}
                        onPress={() => handleAddressSelect(address.address)}
                      >
                        <View style={styles.addressContent}>
                          <View style={styles.addressHeader}>
                            <Text style={styles.addressText}>{address.address}</Text>
                            {address.isDefault && (
                              <View style={styles.defaultBadge}>
                                <Text style={styles.defaultText}>Default</Text>
                              </View>
                            )}
                          </View>
                          {selectedAddress === address.address && (
                            <Ionicons name="checkmark-circle" size={20} color={Colors.buttonPrimary} />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                ) : (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="location-outline" size={48} color={Colors.textMuted} />
                    <Text style={styles.emptyTitle}>No addresses saved</Text>
                    <Text style={styles.emptySubtitle}>
                      Add your first address to get started
                    </Text>
                  </View>
                )}

                {!showAddForm ? (
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowAddForm(true)}
                  >
                    <Ionicons name="add" size={20} color={Colors.buttonPrimary} />
                    <Text style={styles.addButtonText}>Add New Address</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.addForm}>
                    <Text style={styles.addFormTitle}>Add New Address</Text>
                    <TouchableOpacity style={styles.mapPickButton} onPress={() => setManualAddressVisible(true)}>
                      <Ionicons name="create-outline" size={18} color={Colors.buttonPrimary} />
                      <Text style={styles.mapPickButtonText}>Enter Manually</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.mapPickButton} onPress={openMap}>
                      <Ionicons name="map" size={18} color={Colors.buttonPrimary} />
                      <Text style={styles.mapPickButtonText}>Pick on Map</Text>
                    </TouchableOpacity>
                    <View style={styles.phoneInputContainer}>
                      <Ionicons name="call-outline" size={20} color={Colors.textMuted} />
                      <TextInput
                        style={styles.phoneInput}
                        placeholder="Delivery contact number (10 digits)"
                        value={deliveryPhone}
                        onChangeText={(text) => {
                          // Only allow digits and limit to 10
                          const cleaned = text.replace(/\D/g, '').slice(0, 10);
                          setDeliveryPhone(cleaned);
                        }}
                        keyboardType="number-pad"
                        maxLength={10}
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                    {deliveryPhone && deliveryPhone.length < 10 && (
                      <Text style={styles.phoneError}>
                        Phone must be 10 digits ({deliveryPhone.length}/10)
                      </Text>
                    )}
                    <View style={styles.addFormActions}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => {
                          setShowAddForm(false);
                          setNewAddress('');
                        }}
                      >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.saveButton, deliveryPhone.length !== 10 && styles.saveButtonDisabled]}
                        onPress={() => setManualAddressVisible(true)}
                        disabled={deliveryPhone.length !== 10}
                      >
                        <Text style={styles.saveButtonText}>Continue to Address Form</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      <ManualAddressScreen
        visible={manualAddressVisible}
        onClose={() => {
          setManualAddressVisible(false);
          setMapPrefillAddress(undefined);
        }}
        title="Add Delivery Address"
        initialAddress={mapPrefillAddress}
        isSaving={isLoading}
        showLocationActions={true}
        onPickOnMap={() => {
          setManualAddressVisible(false);
          openMap();
        }}
        onSave={async (formattedAddress) => {
          await saveManualAddress(formattedAddress);
          setMapPrefillAddress(undefined);
        }}
      />

      {/* Optimized Map Picker Modal */}
      <Modal
        visible={mapVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setMapVisible(false);
          setManualAddressVisible(true);
        }}
      >
        <LocationPickerScreen
          initialRegion={mapRegion || undefined}
          title="Choose Location"
          onClose={() => {
            setMapVisible(false);
            setManualAddressVisible(true);
          }}
          onConfirm={confirmPickedAddress}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorText: {
    marginLeft: 12,
    flex: 1,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  selectorValue: {
    fontSize: 15,
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  placeholder: {
    width: 32,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  addressItem: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedAddress: {
    borderColor: Colors.buttonPrimary,
    backgroundColor: Colors.primary + '10',
  },
  addressContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  addressText: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 20,
    flex: 1,
    marginRight: 8,
  },
  defaultBadge: {
    backgroundColor: Colors.buttonPrimary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.buttonPrimary,
    marginLeft: 8,
  },
  addForm: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addFormTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  mapPickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    backgroundColor: Colors.background,
  },
  mapPickButtonText: {
    marginLeft: 6,
    color: Colors.buttonPrimary,
    fontWeight: '600',
  },
  addressInput: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 16,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    marginLeft: 10,
    paddingVertical: 6,
  },
  phoneError: {
    fontSize: 12,
    color: Colors.error,
    marginBottom: 12,
    marginLeft: 4,
  },
  phoneSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  phoneSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  phoneSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  savePhoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.buttonPrimary,
    gap: 4,
  },
  savePhoneButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.buttonPrimary,
  },
  phoneHelp: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 6,
    marginLeft: 4,
  },
  phoneSavedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  phoneSavedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
  },
  addFormActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.buttonPrimary,
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.textMuted,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
