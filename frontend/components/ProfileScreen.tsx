import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, StatusBar, TouchableOpacity, Alert, ScrollView, TextInput, Modal, Image, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { useRouter } from 'expo-router';
import apiClient from '../api/client';
import { pickSingleImageFromLibrary } from '@/utils/imagePickerUtils';
import { normalizeUploadAsset, uriToUploadBlob } from '@/utils/imageUploadUtils';
import type { ImagePickerAsset } from 'expo-image-picker';
import { WebMapRegion as Region } from '@/components/ui/WebMapView';
import LocationPickerScreen from '@/components/ui/LocationPickerScreen';
import ManualAddressScreen from '@/components/ui/ManualAddressScreen';
import { AddressFormData, EMPTY_ADDRESS_FORM } from '@/utils/addressUtils';

type ProfileScreenProps = { openStore?: boolean };

const ProfileScreen = ({ openStore }: ProfileScreenProps) => {
  const { user, logout, updateUser } = useAuth();
  const { getCurrentLocation } = useLocation();
  const router = useRouter();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editData, setEditData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    gender: user?.gender || ''
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Avatar state
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarOptionsModalVisible, setAvatarOptionsModalVisible] = useState(false);

  // Addresses state
  const initialAddresses = useMemo(() => user?.addresses || [], [user?.addresses]);
  const [addresses, setAddresses] = useState<string[]>(initialAddresses);
  const [isSavingAddresses, setIsSavingAddresses] = useState(false);

  React.useEffect(() => {
    setAddresses(user?.addresses || []);
  }, [user?.addresses]);

  // Address modal state
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [addressPrefillForm, setAddressPrefillForm] = useState<AddressFormData | undefined>(undefined);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editingAddressIndex, setEditingAddressIndex] = useState<number | null>(null);
  const [editingAddressText, setEditingAddressText] = useState<string | undefined>(undefined);
  const [deleteAccountStep, setDeleteAccountStep] = useState<0 | 1 | 2>(0);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  // handled by LocationPickerScreen now
  const [reopenAddressAfterMap, setReopenAddressAfterMap] = useState(false);

  // Auto-open StoreDetails when requested (from merchant Home shortcut)
  const hasAutoOpenedStoreRef = React.useRef(false);
  React.useEffect(() => {
    if (!hasAutoOpenedStoreRef.current && user?.role === 'Merchant' && openStore) {
      hasAutoOpenedStoreRef.current = true;
      router.push('/auth/StoreDetails');
    }
  }, [openStore, user?.role, router]);

  // Merchant store details preview for profile
  const [storeDetails, setStoreDetails] = useState<any | null>(null);
  React.useEffect(() => {
    const loadStoreDetails = async () => {
      try {
        if (user?.role !== 'Merchant') return;
        const resp = await apiClient.get('/api/v1/store/details');
        if (resp.data?.success) {
          setStoreDetails(resp.data.store);
        }
      } catch {
        // If 404, store not created yet – keep null
      }
    };
    loadStoreDetails();
  }, [user?.role]);

  const getAvatarIconName = () => {
    if (user?.gender === 'Male') return 'man';
    if (user?.gender === 'Female') return 'woman';
    return getRoleIcon(user?.role || 'User');
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeletingAccount(true);
      const response = await apiClient.delete('/api/v1/user/account');
      if (response.data.success) {
        setDeleteAccountStep(0);
        setDeleteConfirmText('');
        await logout();
        router.replace('/auth/Auth');
        Alert.alert('Account Deleted', 'Your account and all associated data have been permanently removed.');
      } else {
        Alert.alert('Error', response.data.message || 'Failed to delete account');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to delete account. Please try again.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/auth/Auth');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'Merchant':
        return 'Merchant';
      case 'Delivery':
        return 'Delivery Partner';
      case 'User':
        return 'Customer';
      default:
        return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Merchant':
        return 'storefront';
      case 'Delivery':
        return 'bicycle';
      case 'User':
        return 'person';
      default:
        return 'person';
    }
  };

  const handleEditProfile = () => {
    setEditData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      gender: user?.gender || ''
    });
    setIsEditModalVisible(true);
  };

  const handleUpdateProfile = async () => {
    try {
      setIsUpdating(true);
      const response = await apiClient.put('/api/v1/user/profile', editData);
      if (response.data.success) {
        await updateUser(response.data.user);
        setIsEditModalVisible(false);
        Alert.alert('Success', 'Profile updated successfully!');
      } else {
        Alert.alert('Error', response.data.message || 'Failed to update profile');
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  // Avatar actions
  const saveAvatar = async (nextAvatar: string | null) => {
    try {
      setIsUpdating(true);
      const resp = await apiClient.put('/api/v1/user/profile', { avatar: nextAvatar });
      if (resp.data?.success) {
        await updateUser(resp.data.user);
        Alert.alert('Success', 'Avatar updated successfully!');
      } else {
        Alert.alert('Error', resp.data?.message || 'Failed to update avatar');
      }
    } catch (_err: any) {
      console.error('Avatar update error:', _err);
      Alert.alert('Error', _err.response?.data?.message || 'Failed to update avatar');
    } finally {
      setIsUpdating(false);
    }
  };

  // Image picker functionality for avatar
  const handleAvatarPicker = async () => {
    try {
      const asset = await pickSingleImageFromLibrary();
      if (asset) {
        await uploadAvatarImage(asset);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Delete file from R2 storage
  const deleteFileFromR2 = async (fileUrl: string) => {
    try {
      console.log('Deleting file from R2:', fileUrl);
      
      const response = await apiClient.delete('/api/v1/upload/file', {
        data: { fileUrl }
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to delete file');
      }

      console.log('File deleted successfully from R2');
      return true;
    } catch (error: any) {
      console.error('Error deleting file from R2:', error);
      
      let errorMessage = 'Failed to delete file from storage.';
      
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 400) {
          errorMessage = data?.message || 'Invalid request.';
        } else if (status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (status === 403) {
          errorMessage = 'You do not have permission to delete this file.';
        } else if (status === 404) {
          errorMessage = 'File not found. It may already be deleted.';
        } else if (status === 500) {
          errorMessage = 'Server error. Please try again later.';
        }
      } else if (error.request) {
        errorMessage = 'Network error. Please check your internet connection.';
      }
      
      Alert.alert('Delete Error', errorMessage);
      return false;
    }
  };

  // Delete avatar
  const handleDeleteAvatar = () => {
    Alert.alert(
      'Delete Avatar',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user?.avatar) return;
            
            try {
              setIsUploadingAvatar(true);
              setAvatarOptionsModalVisible(false);
              
              // Delete from R2 storage first
              const deleted = await deleteFileFromR2(user.avatar);
              
              if (deleted) {
                // Then update user profile to null
                await saveAvatar(null);
              }
            } catch (error) {
              console.error('Error deleting avatar:', error);
              Alert.alert('Error', 'Failed to delete avatar. Please try again.');
            } finally {
              setIsUploadingAvatar(false);
            }
          }
        }
      ]
    );
  };

  const uploadAvatarImage = async (asset: ImagePickerAsset) => {
    try {
      setIsUploadingAvatar(true);

      const { fileName, fileType, uri } = normalizeUploadAsset(asset, 'avatar_');

      const uploadResponse = await apiClient.post('/api/v1/upload/url', {
        fileType,
        fileName,
        role: 'User',
        isPermanent: true,
      });

      if (!uploadResponse.data.success) {
        throw new Error(uploadResponse.data.message || 'Failed to get upload URL');
      }

      const { uploadUrl, publicUrl } = uploadResponse.data;

      const blob = await uriToUploadBlob(uri, fileType);
      
      const uploadResult = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': fileType,
        },
      });

      if (!uploadResult.ok) {
        throw new Error('Failed to upload file to storage');
      }

      console.log('Avatar uploaded successfully to R2');
      // Update user avatar
      await saveAvatar(publicUrl);
      setAvatarOptionsModalVisible(false);
      
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      
      let errorMessage = 'Failed to upload avatar. Please try again.';
      
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 400) {
          errorMessage = data?.message || 'Invalid image format. Please try a different image.';
        } else if (status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (status === 403) {
          errorMessage = 'You do not have permission to upload images.';
        } else if (status === 500) {
          errorMessage = 'Server error. Please try again later.';
        }
      } else if (error.request) {
        errorMessage = 'Network error. Please check your internet connection.';
      }
      
      Alert.alert('Upload Error', errorMessage);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Addresses actions
  const persistAddresses = async (next: string[]) => {
    try {
      setIsSavingAddresses(true);
      const resp = await apiClient.put('/api/v1/user/profile', { addresses: next });
      if (resp.data?.success) {
        setAddresses(resp.data.user.addresses || []);
        await updateUser(resp.data.user);
      } else {
        Alert.alert('Error', resp.data?.message || 'Failed to save addresses');
      }
    } catch (_err: any) {
      console.error('Addresses update error:', _err);
      Alert.alert('Error', _err.response?.data?.message || 'Failed to save addresses');
    } finally {
      setIsSavingAddresses(false);
    }
  };


  const deleteAddress = async (index: number) => {
    Alert.alert('Delete Address', 'Are you sure you want to delete this address?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const next = addresses.filter((_, i) => i !== index);
        await persistAddresses(next);
      }}
    ]);
  };

  const openAddressModal = (index?: number) => {
    if (index !== undefined) {
      setEditingAddressText(addresses[index]);
      setIsEditingAddress(true);
      setEditingAddressIndex(index);
    } else {
      setEditingAddressText(undefined);
      setAddressPrefillForm(undefined);
      setIsEditingAddress(false);
      setEditingAddressIndex(null);
    }
    setAddressModalVisible(true);
  };

  const closeAddressModal = () => {
    setAddressModalVisible(false);
    setAddressPrefillForm(undefined);
    setEditingAddressText(undefined);
    setIsEditingAddress(false);
    setEditingAddressIndex(null);
  };

  const saveManualAddress = async (formattedAddress: string) => {
    let updatedAddresses: string[];
    if (isEditingAddress && editingAddressIndex !== null) {
      updatedAddresses = addresses.map((addr, i) =>
        i === editingAddressIndex ? formattedAddress : addr
      );
    } else {
      if (addresses.length >= 5) {
        Alert.alert('Limit Reached', 'You can only have up to 5 addresses');
        return;
      }
      updatedAddresses = [...addresses, formattedAddress];
    }
    await persistAddresses(updatedAddresses);
    closeAddressModal();
  };

  const openMap = async () => {
    try {
      // Avoid nested modals on Android: close address modal and remember to reopen
      if (addressModalVisible) {
        setReopenAddressAfterMap(true);
        setAddressModalVisible(false);
      } else {
        setReopenAddressAfterMap(false);
      }
      setMapVisible(true);
      let initLat = (await getCurrentLocation())?.latitude || 12.9716;
      let initLng = (await getCurrentLocation())?.longitude || 77.5946;
      setMapRegion({
        latitude: initLat,
        longitude: initLng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch {
      // noop
    } finally {
      // no-op
    }
  };

  // map region updates and geocoding are handled inside LocationPickerScreen
  const closeMap = () => {
    setMapVisible(false);
    if (reopenAddressAfterMap) {
      setAddressModalVisible(true);
      setReopenAddressAfterMap(false);
    }
  };

  // Merchant store address map picker
  const [isForStoreAddress, setIsForStoreAddress] = useState(false);

  const openMapForStoreAddress = async () => {
    try {
      setIsForStoreAddress(true);
      setMapVisible(true);
      
      // Try to get store's location from existing address or use current location
      let initLat = (await getCurrentLocation())?.latitude || 12.9716;
      let initLng = (await getCurrentLocation())?.longitude || 77.5946;
      
      setMapRegion({
        latitude: initLat,
        longitude: initLng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch {
      // noop
    }
  };

  const saveStoreAddress = async (address: string, mapLink: string) => {
    try {
      const response = await apiClient.put('/api/v1/store/update', {
        address: address,
        mapLink: mapLink
      });

      if (response.data.success) {
        setStoreDetails(response.data.store);
        Alert.alert('Success', 'Store address updated successfully!');
      } else {
        Alert.alert('Error', response.data.message || 'Failed to update store address');
      }
    } catch (error: any) {
      console.error('Error updating store address:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to update store address');
    }
  };

  const handleGetAddressFromLocation = async () => {
    try {
      setIsSavingAddresses(true);
      const locationData = await getCurrentLocation();
      
      if (locationData) {
        setAddressPrefillForm({
          houseFlat: locationData.landmark || locationData.street || '',
          streetArea: locationData.street && locationData.street !== locationData.landmark ? locationData.street : '',
          landmark: '',
          city: locationData.city,
          state: locationData.state,
          country: locationData.country || 'India',
          pincode: locationData.pincode || '',
        });
      }
    } catch (error) {
      console.error('Error getting address from location:', error);
    } finally {
      setIsSavingAddresses(false);
    }
  };

// Ensure hooks run before any early returns
const notAuthenticatedView = (
  <View style={styles.container}>
    <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
    <View style={styles.emptyStateContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="person-outline" size={64} color={Colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>Not Logged In</Text>
      <Text style={styles.emptyDescription}>
        Please log in to view your profile and manage your account.
      </Text>
    </View>
  </View>
);

  

  if (!user) {
    return notAuthenticatedView;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Hero Header - Role Based */}
        {user.role === 'Merchant' && storeDetails?.storeImage ? (
          // Merchant with Store Image Background
          <View style={styles.heroHeader}>
            <Image 
              source={{ uri: storeDetails.storeImage }} 
              style={styles.headerBackgroundImage}
              blurRadius={3}
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.7)']}
              style={styles.headerOverlay}
            >
              <View style={styles.avatarContainer}>
                <TouchableOpacity 
                  style={styles.avatarWrapper}
                  onPress={() => setAvatarOptionsModalVisible(true)}
                  activeOpacity={0.9}
                >
                  {user.avatar ? (
                    <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons
                        name={getAvatarIconName()}
                        size={50}
                        color={Colors.textPrimary}
                      />
                    </View>
                  )}
                  <View style={styles.editAvatarButton}>
                    {isUploadingAvatar ? (
                      <ActivityIndicator size={18} color="#FFF" />
                    ) : (
                      <Ionicons name="camera" size={18} color="#FFF" />
                    )}
                  </View>
                </TouchableOpacity>
                
                <View style={styles.userInfoContainer}>
                  <Text style={styles.heroName}>{user?.name || 'User'}</Text>
                  <View style={styles.roleChip}>
                    <Ionicons name={getRoleIcon(user?.role)} size={14} color={Colors.textPrimary} />
                    <Text style={styles.roleText}>{getRoleDisplayName(user?.role)}</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        ) : (
          // User and Delivery (or Merchant without store) - Gradient Background
          <LinearGradient
            colors={Colors.gradients.primary as [string, string]}
            style={styles.heroHeader}
          >
            <View style={styles.avatarContainer}>
              <TouchableOpacity 
                style={styles.avatarWrapper}
                onPress={() => setAvatarOptionsModalVisible(true)}
                activeOpacity={0.9}
              >
                {user.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons
                      name={getAvatarIconName()}
                      size={50}
                      color={Colors.textPrimary}
                    />
                  </View>
                )}
                <View style={styles.editAvatarButton}>
                  {isUploadingAvatar ? (
                    <ActivityIndicator size={18} color="#FFF" />
                  ) : (
                    <Ionicons name="camera" size={18} color="#FFF" />
                  )}
                </View>
              </TouchableOpacity>
              
              <View style={styles.userInfoContainer}>
                <Text style={styles.heroName}>{user?.name || 'User'}</Text>
                <View style={styles.roleChip}>
                  <Ionicons name={getRoleIcon(user?.role)} size={14} color={Colors.textPrimary} />
                  <Text style={styles.roleText}>{getRoleDisplayName(user?.role)}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        )}

        <View style={styles.content}>
          {/* Quick Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#2196F3" />
              </View>
              <Text style={styles.statLabel} numberOfLines={1}>Profile</Text>
              <Text style={[styles.statValue, user.isProfileComplete ? { color: Colors.success } : { color: Colors.warning }]} numberOfLines={1} adjustsFontSizeToFit>
                {user.isProfileComplete ? 'Complete' : 'Incomplete'}
              </Text>
            </View>

            {user.role !== 'Delivery' && (
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#F3E5F5' }]}>
                  <Ionicons name="location" size={24} color="#9C27B0" />
                </View>
                <Text style={styles.statLabel} numberOfLines={1}>{user.role === 'Merchant' ? 'Store' : 'Addresses'}</Text>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{user.role === 'Merchant' ? (storeDetails ? '1' : '0') : addresses.length}</Text>
              </View>
            )}

            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="shield-checkmark" size={24} color="#4CAF50" />
              </View>
              <Text style={styles.statLabel} numberOfLines={1}>Verified</Text>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                {(user.isEmailVerified ? 1 : 0) + (user.isPhoneVerified ? 1 : 0)}/2
              </Text>
            </View>

            {user.role === 'Delivery' && (
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="bicycle" size={24} color="#FF9800" />
                </View>
                <Text style={styles.statLabel} numberOfLines={1}>Status</Text>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{user.isBusy ? 'Busy' : 'Available'}</Text>
              </View>
            )}
          </View>

          {/* Personal Information */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              <TouchableOpacity onPress={handleEditProfile}>
                <Ionicons name="create-outline" size={22} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.card}>
              <View style={styles.infoItem}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="person-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Full Name</Text>
                  <Text style={styles.infoValue}>{user.name || 'Not provided'}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoItem}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="mail-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Email Address</Text>
                  <View style={styles.verifiedRow}>
                    <Text style={styles.infoValue}>{user.email || 'Not provided'}</Text>
                    {user.isEmailVerified && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                        <Text style={styles.verifiedBadgeText}>Verified</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoItem}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="call-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Phone Number</Text>
                  <View style={styles.verifiedRow}>
                    <Text style={styles.infoValue}>{user.phone || 'Not provided'}</Text>
                    {user.isPhoneVerified && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                        <Text style={styles.verifiedBadgeText}>Verified</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoItem}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="transgender-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Gender</Text>
                  <Text style={styles.infoValue}>{user.gender || 'Not specified'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Addresses Section - Hidden for Delivery partners */}
          {user.role === 'User' ? (
            // User addresses (unchanged)
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Saved Addresses</Text>
                <View style={styles.sectionHeaderRight}>
                  <Text style={styles.sectionSubtitle}>{addresses.length}/5</Text>
                  {addresses.length < 5 && (
                    <TouchableOpacity 
                      style={styles.addAddressButton}
                      onPress={() => openAddressModal()}
                    >
                      <LinearGradient
                        colors={Colors.gradients.primary as [string, string]}
                        style={styles.addAddressButtonGradient}
                      >
                        <Ionicons name="add" size={18} color={Colors.textPrimary} />
                        <Text style={styles.addAddressButtonText}>Add New Address</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.card}>
                {addresses.length === 0 ? (
                  <View style={styles.emptyAddressContainer}>
                    <Ionicons name="location-outline" size={48} color={Colors.textSecondary} />
                    <Text style={styles.emptyAddressText}>No addresses saved yet</Text>
                    <Text style={styles.emptyAddressSubtext}>Add your delivery addresses below</Text>
                  </View>
                ) : (
                  addresses.map((addr, idx) => (
                    <View key={`${addr}-${idx}`}>
                      {idx > 0 && <View style={styles.divider} />}
                      <View style={styles.addressItem}>
                        <View style={styles.addressIconBox}>
                          <Ionicons name="location" size={20} color={Colors.primary} />
                        </View>
                        <View style={styles.addressContent}>
                          <Text style={styles.addressText} numberOfLines={2}>{addr}</Text>
                          <View style={styles.addressActions}>
                            <TouchableOpacity 
                              style={styles.addressActionButton}
                              onPress={() => openAddressModal(idx)}
                            >
                              <Ionicons name="create-outline" size={16} color={Colors.primary} />
                              <Text style={styles.addressActionText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.addressActionButton, { marginLeft: 16 }]}
                              onPress={() => deleteAddress(idx)}
                            >
                              <Ionicons name="trash-outline" size={16} color={Colors.error} />
                              <Text style={[styles.addressActionText, { color: Colors.error }]}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          ) : user.role === 'Merchant' ? (
            // Merchant single store address preview
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Store Address</Text>
                <View style={styles.sectionHeaderRight}>
                  {storeDetails && (
                    <TouchableOpacity 
                      style={styles.pickAddressButton}
                      onPress={() => openMapForStoreAddress()}
                    >
                      <Ionicons name="map-outline" size={16} color={Colors.buttonPrimary} />
                      <Text style={styles.pickAddressButtonText}>Update from Map</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => router.push('/auth/StoreDetails')}>
                    <Ionicons name="create-outline" size={22} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.card}>
                {storeDetails ? (
                  <View style={{ gap: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Ionicons name="storefront" size={18} color={Colors.primary} />
                      <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{storeDetails.storeName}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                      <Ionicons name="location" size={18} color={Colors.primary} style={{ marginTop: 2 }} />
                      <Text style={{ color: Colors.textPrimary, flex: 1, lineHeight: 22 }}>{storeDetails.address}</Text>
                    </View>
                    {storeDetails.mapLink ? (
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <Ionicons name="map" size={18} color={Colors.primary} />
                        <Text style={{ color: Colors.textSecondary, fontSize: 12 }} numberOfLines={1}>{storeDetails.mapLink}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.emptyAddressContainer}>
                    <Ionicons name="storefront" size={48} color={Colors.textSecondary} />
                    <Text style={styles.emptyAddressText}>Store not set up</Text>
                    <Text style={styles.emptyAddressSubtext}>Add your store details to start selling</Text>
                    <View style={{ height: 12 }} />
                    <TouchableOpacity onPress={() => router.push('/auth/StoreDetails')}>
                      <LinearGradient colors={Colors.gradients.primary as [string, string]} style={styles.addAddressButtonGradient}>
                        <Ionicons name="add" size={18} color={Colors.textPrimary} />
                        <Text style={styles.addAddressButtonText}>Add Store Details</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ) : null}

          {/* Merchant Store Settings Shortcut */}
          {user.role === 'Merchant' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Store Settings</Text>
              </View>
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.storeSettingsButton}
                  onPress={() => router.push('/auth/StoreDetails')}
                >
                  <LinearGradient
                    colors={Colors.gradients.primary as [string, string]}
                    style={styles.storeSettingsGradient}
                  >
                    <Ionicons name="storefront" size={22} color={Colors.textPrimary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.storeSettingsTitle}>View / Update Store</Text>
                      <Text style={styles.storeSettingsSubtitle}>Manage store info, images, working days</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textPrimary} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.deleteAccountButton} onPress={() => setDeleteAccountStep(1)}>
              <View style={styles.deleteAccountInner}>
                <Ionicons name="trash-outline" size={22} color={Colors.error} />
                <Text style={styles.deleteAccountText}>Delete Account</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <LinearGradient
                colors={['#EF5350', '#E53935']}
                style={styles.logoutGradient}
              >
                <Ionicons name="log-out-outline" size={22} color={Colors.textPrimary} />
                <Text style={styles.logoutText}>Logout</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>

      {/* Modern Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.editModalSheet}>
            {/* Header */}
            <View style={styles.editModalHeader}>
              <View>
                <Text style={styles.editModalTitle}>Edit Profile</Text>
                <Text style={styles.editModalSubtitle}>Update your personal information</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setIsEditModalVisible(false)} 
                activeOpacity={0.7}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              contentContainerStyle={styles.editModalContent} 
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Full Name */}
              <View style={styles.modernInputGroup}>
                <Text style={styles.modernInputLabel}>Full Name</Text>
                <View style={styles.modernInputContainer}>
                  <Ionicons name="person-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.modernTextInput}
                    value={editData.name}
                    onChangeText={(text) => setEditData({ ...editData, name: text })}
                    placeholder="Enter your full name"
                    placeholderTextColor={Colors.textSecondary}
                  />
                </View>
              </View>

              {/* Email Address - Show if user doesn't have email OR always editable */}
              <View style={styles.modernInputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.modernInputLabel}>Email Address</Text>
                  {!user?.email && <Text style={styles.optionalBadge}>Optional</Text>}
                  {user?.isEmailVerified && (
                    <View style={styles.verifiedInputBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                      <Text style={styles.verifiedInputText}>Verified</Text>
                    </View>
                  )}
                </View>
                <View style={styles.modernInputContainer}>
                  <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.modernTextInput}
                    value={editData.email}
                    onChangeText={(text) => setEditData({ ...editData, email: text })}
                    placeholder="Enter your email"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!user?.isEmailVerified}
                  />
                  {user?.isEmailVerified && (
                    <Ionicons name="lock-closed" size={16} color={Colors.textSecondary} style={styles.lockIcon} />
                  )}
                </View>
                {user?.isEmailVerified && (
                  <Text style={styles.inputHint}>Verified email cannot be changed</Text>
                )}
              </View>

              {/* Phone Number - Show if user doesn't have phone OR always editable */}
              <View style={styles.modernInputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.modernInputLabel}>Phone Number</Text>
                  {!user?.phone && <Text style={styles.optionalBadge}>Optional</Text>}
                  {user?.isPhoneVerified && (
                    <View style={styles.verifiedInputBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                      <Text style={styles.verifiedInputText}>Verified</Text>
                    </View>
                  )}
                </View>
                <View style={styles.modernInputContainer}>
                  <Ionicons name="call-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.modernTextInput}
                    value={editData.phone}
                    onChangeText={(text) => {
                      // Only allow digits and limit to 10
                      const cleaned = text.replace(/\D/g, '').slice(0, 10);
                      setEditData({ ...editData, phone: cleaned });
                    }}
                    placeholder="Enter 10-digit phone number"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="number-pad"
                    maxLength={10}
                    editable={!user?.isPhoneVerified}
                  />
                  {user?.isPhoneVerified && (
                    <Ionicons name="lock-closed" size={16} color={Colors.textSecondary} style={styles.lockIcon} />
                  )}
                </View>
                {user?.isPhoneVerified ? (
                  <Text style={styles.inputHint}>Verified phone cannot be changed</Text>
                ) : editData.phone && editData.phone.length < 10 ? (
                  <Text style={[styles.inputHint, { color: Colors.error }]}>
                    Phone number must be 10 digits ({editData.phone.length}/10)
                  </Text>
                ) : null}
              </View>

              {/* Gender Selector */}
              <View style={styles.modernInputGroup}>
                <Text style={styles.modernInputLabel}>Gender</Text>
                <View style={styles.genderSelectorContainer}>
                  {(['Male', 'Female', 'Other'] as const).map((gender) => (
                    <TouchableOpacity
                      key={gender}
                      style={[
                        styles.genderOption,
                        editData.gender === gender && styles.genderOptionSelected
                      ]}
                      onPress={() => setEditData({ ...editData, gender })}
                      activeOpacity={0.7}
                    >
                      <Ionicons 
                        name={
                          gender === 'Male' ? 'male' : 
                          gender === 'Female' ? 'female' : 
                          'transgender'
                        } 
                        size={20} 
                        color={editData.gender === gender ? Colors.primary : Colors.textSecondary} 
                      />
                      <Text style={[
                        styles.genderOptionText,
                        editData.gender === gender && styles.genderOptionTextSelected
                      ]}>
                        {gender}
                      </Text>
                      {editData.gender === gender && (
                        <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Info Note */}
              <View style={styles.infoNote}>
                <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
                <Text style={styles.infoNoteText}>
                  {!user?.email && !user?.phone 
                    ? 'Add email or phone for delivery notifications' 
                    : !user?.email 
                    ? 'Add email to receive order updates' 
                    : !user?.phone 
                    ? 'Add phone for delivery person contact' 
                    : 'Keep your information updated for smooth delivery'}
                </Text>
              </View>
            </ScrollView>

            {/* Save Button */}
            <View style={styles.editModalFooter}>
              <TouchableOpacity 
                style={[styles.modernSaveButton, isUpdating && styles.modernSaveButtonDisabled]} 
                activeOpacity={0.85} 
                onPress={handleUpdateProfile} 
                disabled={isUpdating}
              >
                <LinearGradient
                  colors={isUpdating ? ['#CCCCCC', '#999999'] : Colors.gradients.primary as [string, string]}
                  style={styles.modernSaveButtonGradient}
                >
                  {isUpdating ? (
                    <>
                      <ActivityIndicator size="small" color={Colors.textPrimary} />
                      <Text style={styles.modernSaveButtonText}>Saving...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color={Colors.textPrimary} />
                      <Text style={styles.modernSaveButtonText}>Save Changes</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ManualAddressScreen
        visible={addressModalVisible}
        onClose={closeAddressModal}
        title={isEditingAddress ? 'Edit Address' : 'Add New Address'}
        initialAddress={editingAddressText}
        initialForm={addressPrefillForm}
        isSaving={isSavingAddresses}
        onSave={async (formattedAddress) => {
          await saveManualAddress(formattedAddress);
        }}
        onUseCurrentLocation={handleGetAddressFromLocation}
        onPickOnMap={() => {
          setReopenAddressAfterMap(true);
          setAddressModalVisible(false);
          openMap();
        }}
        isLoadingLocation={isSavingAddresses}
      />

      {/* Fullscreen Map Picker */}
      <Modal
        visible={mapVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeMap}
      >
        <LocationPickerScreen
          initialRegion={mapRegion || undefined}
          title={isForStoreAddress ? "Choose Store Location" : "Choose Location"}
          onClose={() => {
            setMapVisible(false);
            setIsForStoreAddress(false);
            if (reopenAddressAfterMap) {
              setAddressModalVisible(true);
              setReopenAddressAfterMap(false);
            }
          }}
          onConfirm={({ latitude, longitude, formattedAddress }) => {
            if (isForStoreAddress) {
              // Save to store details
              const mapLink = `https://maps.google.com/?q=${latitude},${longitude}`;
              saveStoreAddress(formattedAddress, mapLink);
              setMapVisible(false);
              setIsForStoreAddress(false);
            } else {
              const parts = formattedAddress.split(',').map(p => p.trim());
              setAddressPrefillForm({
                houseFlat: parts[0] || '',
                streetArea: parts[1] || '',
                landmark: '',
                city: parts[2] || '',
                state: parts[3] || '',
                pincode: parts[4] || '',
                country: parts[5] || 'India',
              });
              setMapVisible(false);
              if (reopenAddressAfterMap) {
                setAddressModalVisible(true);
                setReopenAddressAfterMap(false);
              }
            }
          }}
        />
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={deleteAccountStep > 0}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setDeleteAccountStep(0);
          setDeleteConfirmText('');
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.deleteModalSheet}>
            <View style={styles.deleteModalIconWrap}>
              <Ionicons name="warning" size={36} color={Colors.error} />
            </View>
            <Text style={styles.deleteModalTitle}>
              {deleteAccountStep === 1 ? 'Delete your account?' : 'This cannot be undone'}
            </Text>
            <Text style={styles.deleteModalText}>
              {deleteAccountStep === 1
                ? 'All your profile data, orders, addresses, and uploaded content will be permanently removed.'
                : 'Type DELETE below to confirm permanent account deletion.'}
            </Text>

            {deleteAccountStep === 2 && (
              <TextInput
                style={styles.deleteConfirmInput}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder="Type DELETE"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            )}

            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={styles.deleteCancelButton}
                onPress={() => {
                  setDeleteAccountStep(0);
                  setDeleteConfirmText('');
                }}
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deleteConfirmButton,
                  deleteAccountStep === 2 && deleteConfirmText !== 'DELETE' && styles.deleteConfirmButtonDisabled,
                ]}
                disabled={isDeletingAccount || (deleteAccountStep === 2 && deleteConfirmText !== 'DELETE')}
                onPress={() => {
                  if (deleteAccountStep === 1) {
                    setDeleteAccountStep(2);
                  } else {
                    handleDeleteAccount();
                  }
                }}
              >
                {isDeletingAccount ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.deleteConfirmText}>
                    {deleteAccountStep === 1 ? 'Continue' : 'Delete Forever'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Avatar Options Modal - WhatsApp/Instagram Style */}
      <Modal
        visible={avatarOptionsModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setAvatarOptionsModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.avatarModalBackdrop}
          activeOpacity={1}
          onPress={() => setAvatarOptionsModalVisible(false)}
        >
          <View style={styles.avatarModalContainer}>
            <View style={styles.avatarModalContent}>
              {/* Preview Section */}
              <View style={styles.avatarPreviewSection}>
                {user.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.avatarModalPreview} />
                ) : (
                  <View style={styles.avatarModalPreviewPlaceholder}>
                    <Ionicons
                      name={getAvatarIconName()}
                      size={80}
                      color={Colors.textSecondary}
                    />
                  </View>
                )}
              </View>

              {/* Options */}
              <View style={styles.avatarModalOptions}>
                <TouchableOpacity 
                  style={styles.avatarOptionButton}
                  onPress={() => {
                    setAvatarOptionsModalVisible(false);
                    setTimeout(() => handleAvatarPicker(), 300);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatarOptionIconBox, { backgroundColor: '#E3F2FD' }]}>
                    <Ionicons name="images" size={24} color="#2196F3" />
                  </View>
                  <Text style={styles.avatarOptionText}>Choose from Gallery</Text>
                </TouchableOpacity>

                {user.avatar && (
                  <>
                    <View style={styles.avatarModalDivider} />
                    <TouchableOpacity 
                      style={styles.avatarOptionButton}
                      onPress={() => {
                        setAvatarOptionsModalVisible(false);
                        setTimeout(() => handleDeleteAvatar(), 300);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.avatarOptionIconBox, { backgroundColor: '#FFEBEE' }]}>
                        <Ionicons name="trash" size={24} color="#F44336" />
                      </View>
                      <Text style={[styles.avatarOptionText, { color: Colors.error }]}>
                        Remove Photo
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                <View style={styles.avatarModalDivider} />
                
                <TouchableOpacity 
                  style={styles.avatarOptionButton}
                  onPress={() => setAvatarOptionsModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatarOptionIconBox, { backgroundColor: '#F5F5F5' }]}>
                    <Ionicons name="close" size={24} color={Colors.textSecondary} />
                  </View>
                  <Text style={styles.avatarOptionText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContainer: {
    flex: 1,
  },
  heroHeader: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBackgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 16,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  userInfoContainer: {
    flex: 1,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  roleText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  content: {
    padding: 20,
    marginTop: -12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 2,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  addAddressButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addAddressButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  addAddressButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.success,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16,
  },
  emptyAddressContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyAddressText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 12,
  },
  emptyAddressSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  addressItem: {
    flexDirection: 'row',
  },
  addressIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addressContent: {
    flex: 1,
  },
  addressText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
    lineHeight: 22,
    marginBottom: 8,
  },
  addressActions: {
    flexDirection: 'row',
  },
  addressActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  pickAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.buttonPrimary,
    gap: 4,
    marginRight: 12,
  },
  pickAddressButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.buttonPrimary,
  },
  addAddressContainer: {
    marginTop: 8,
  },
  addAddressLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  addressInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: '#FAFAFA',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  addAddressActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  saveAddressButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveAddressGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 6,
  },
  saveAddressText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  actionsSection: {
    marginTop: 8,
  },
  logoutButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 12,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  deleteAccountButton: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.error,
    backgroundColor: '#FFF5F5',
    overflow: 'hidden',
  },
  deleteAccountInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  deleteAccountText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.error,
  },
  deleteModalSheet: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  deleteModalIconWrap: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  deleteModalText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  deleteConfirmInput: {
    borderWidth: 1.5,
    borderColor: Colors.error,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '700',
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  deleteCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  deleteConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.error,
    alignItems: 'center',
  },
  deleteConfirmButtonDisabled: {
    opacity: 0.5,
  },
  deleteConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  logoutText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  storeSettingsButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  storeSettingsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  storeSettingsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  storeSettingsSubtitle: {
    fontSize: 12,
    color: Colors.textPrimary,
    opacity: 0.8,
  },
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  modalDivider: {
    height: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  modalContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  modalSaveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },

  // Modern Edit Profile Modal Styles
  editModalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  editModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  editModalSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modernInputGroup: {
    marginBottom: 20,
  },
  modernInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  optionalBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verifiedInputBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  verifiedInputText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.success,
  },
  modernInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  modernTextInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  lockIcon: {
    marginLeft: 8,
  },
  inputHint: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 6,
    marginLeft: 4,
  },
  genderSelectorContainer: {
    gap: 12,
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  genderOptionSelected: {
    backgroundColor: '#E6F4FE',
    borderColor: Colors.primary,
  },
  genderOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  genderOptionTextSelected: {
    color: Colors.primary,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E6F4FE',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.primary,
    lineHeight: 18,
  },
  editModalFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  modernSaveButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modernSaveButtonDisabled: {
    opacity: 0.6,
  },
  modernSaveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  modernSaveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  getLocationButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  getLocationButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  getLocationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  addressInputHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
  avatarPreviewContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#E0E0E0',
  },
  avatarPreviewPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  removeAvatarButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
  },
  removeAvatarText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.error,
  },
  // Empty State
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Address Modal Styles
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  addressPreview: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  previewText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  // Avatar Options Modal Styles
  avatarModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  avatarModalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  avatarModalContent: {
    backgroundColor: Colors.background,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  avatarPreviewSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: '#F8F9FA',
  },
  avatarModalPreview: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarModalPreviewPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
  },
  avatarModalOptions: {
    backgroundColor: Colors.background,
  },
  avatarOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 16,
  },
  avatarOptionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  avatarModalDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 20,
  },
});

export default ProfileScreen; 