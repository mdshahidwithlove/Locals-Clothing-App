import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Alert,
  Animated,
  PanResponder
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import apiClient from '@/api/client';
import { useCart } from '@/contexts/CartContext';
import type { CartItem as CartItemType } from '@/contexts/CartContext';
import SizeSelectorModal from '@/components/ui/SizeSelectorModal';
import AddressSelector from '@/components/user/AddressSelector';
import PaymentMethodModal from '@/components/user/PaymentMethodModal';
let RazorpayCheckout: any = null;
try {
  RazorpayCheckout = require('react-native-razorpay');
  // If the import returns the default export on some platforms
  if (RazorpayCheckout && RazorpayCheckout.default) {
    RazorpayCheckout = RazorpayCheckout.default;
  }
} catch (e) {
  console.warn('Razorpay module not loaded (Expo Go):', e);
}

// Helper: format INR without decimals across the app UI
const formatINR = (value: number) => Math.round(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const SwipeableCartItem = ({ item, updateQuantity, removeItem, onEdit }: { item: CartItemType; updateQuantity: (productId: string, qty: number, size?: string) => void; removeItem: (productId: string, size?: string) => void; onEdit: (item: CartItemType) => void }) => {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // allow left swipe up to -100 and right swipe up to +100
        if (gestureState.dx < 0 && gestureState.dx > -100) {
          translateX.setValue(gestureState.dx);
        } else if (gestureState.dx > 0 && gestureState.dx < 100) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          Animated.spring(translateX, {
            toValue: -80,
            useNativeDriver: true,
          }).start();
        } else if (gestureState.dx > 50) {
          Animated.spring(translateX, {
            toValue: 80,
            useNativeDriver: true,
          }).start();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleDelete = () => {
    Animated.timing(translateX, {
      toValue: -400,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      removeItem(item.productId, item.size);
    });
  };

  return (
    <View style={styles.swipeContainer}>
      {/* Left Edit Button (shown on right swipe) */}
      <View style={styles.editButtonContainer}>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => onEdit(item)}
        >
          <Ionicons name="pencil" size={24} color="#FFFFFF" />
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Right Delete Button (shown on left swipe) */}
      <View style={styles.deleteButtonContainer}>
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={handleDelete}
        >
          <Ionicons name="trash" size={24} color="#FFFFFF" />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.cartItem,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.itemImageContainer}>
          <Image 
            source={{ uri: item.product.images?.[0] || 'https://via.placeholder.com/80' }} 
            style={styles.itemImage}
            resizeMode="cover"
          />
        </View>
        
        <View style={styles.itemDetails}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.product.name}
          </Text>
          {!!item.size && (
            <Text style={styles.itemSize}>Size: {item.size}</Text>
          )}
          <View style={styles.storeContainer}>
            <Ionicons name="storefront-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.itemStore}>
              {typeof item.product.storeId === 'object' 
                ? ((item.product.storeId as any).storeName || 'Store') 
                : 'Store'}
            </Text>
          </View>
          <View style={styles.priceQuantityRow}>
            <Text style={styles.itemPrice}>₹{formatINR(item.price)}</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={() => updateQuantity(item.productId, item.qty - 1, item.size)}
              >
                <Ionicons name="remove" size={18} color={Colors.textPrimary} />
              </TouchableOpacity>
              
              <Text style={styles.quantityText}>{item.qty}</Text>
              
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={() => updateQuantity(item.productId, item.qty + 1, item.size)}
              >
                <Ionicons name="add" size={18} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.itemTotal}>Total: ₹{formatINR(item.price * item.qty)}</Text>
        </View>
      </Animated.View>
    </View>
  );
};

export default function CartScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { items, updateQty, removeItem, addItem, clearCart } = useCart();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<CartItemType | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  const [platformFeeType, setPlatformFeeType] = useState<'flat' | 'percentage'>('flat');
  const [platformFeeValue, setPlatformFeeValue] = useState<number>(5);

  useEffect(() => {
    const fetchPlatformFee = async () => {
      try {
        const response = await apiClient.get('/api/v1/user/platform-fee');
        if (response.data.success) {
          setPlatformFeeType(response.data.feeType);
          setPlatformFeeValue(response.data.feeValue);
        }
      } catch (error) {
        console.error('Error fetching platform fee config:', error);
      }
    };
    fetchPlatformFee();
  }, []);

  const updateQuantity = (productId: string, newQuantity: number, size?: string) => {
    updateQty(productId, newQuantity, size);
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => total + (item.price * item.qty), 0);
  };

  const calculateDeliveryFee = () => {
    // Flat fee per cart line item
    return items.length * 50;
  };

  const calculatePlatformFee = () => {
    const storeIds = Object.keys(ordersByStore);
    let totalFee = 0;
    storeIds.forEach(storeId => {
      const storeTotal = ordersByStore[storeId].totalAmount;
      if (platformFeeType === 'percentage') {
        totalFee += Math.round(storeTotal * (platformFeeValue / 100));
      } else {
        totalFee += Math.round(platformFeeValue);
      }
    });
    return totalFee;
  };

  const calculateGrandTotal = () => {
    return calculateTotal() + calculateDeliveryFee() + calculatePlatformFee();
  };

  // Group items by store for display
  const ordersByStore = items.reduce((acc, item) => {
    const storeId = typeof item.product.storeId === 'object' 
      ? (item.product.storeId as any)._id 
      : (item.product.storeId as any);
    const storeName = typeof item.product.storeId === 'object' 
      ? ((item.product.storeId as any).storeName || 'Store') 
      : 'Store';
    
    if (!acc[storeId]) {
      acc[storeId] = {
        storeId,
        storeName,
        items: [] as any[],
        totalAmount: 0,
      };
    }
    
    const itemTotal = item.price * item.qty;
    acc[storeId].items.push({
      product: item.productId,
      quantity: item.qty,
      price: item.price,
    });
    acc[storeId].totalAmount += itemTotal;
    
    return acc;
  }, {} as Record<string, any>);

  const handlePlaceOrder = async () => {
    if (!user) {
      Alert.alert('Error', 'Please login to place an order');
      return;
    }

    if (items.length === 0) {
      Alert.alert('Error', 'Your cart is empty');
      return;
    }

    if (!selectedAddress) {
      Alert.alert('Error', 'Please select a delivery address');
      return;
    }

    if (!selectedPhone || selectedPhone.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit delivery contact number');
      return;
    }

    // Show payment method selection modal
    setPaymentModalVisible(true);
  };

  const handlePaymentMethodSelected = async (paymentMethod: 'COD' | 'Online') => {
    setPaymentModalVisible(false);
    setProcessingPayment(true);

    try {
      // Group items by store
      const ordersByStore = items.reduce((acc, item) => {
        const storeId = typeof item.product.storeId === 'object' 
          ? (item.product.storeId as any)._id 
          : (item.product.storeId as any);
        const storeName = typeof item.product.storeId === 'object' 
          ? ((item.product.storeId as any).storeName || 'Store') 
          : 'Store';
        
        if (!acc[storeId]) {
          acc[storeId] = {
            storeId,
            storeName,
            items: [] as any[],
            totalAmount: 0,
          };
        }
        
        const itemTotal = item.price * item.qty;
        acc[storeId].items.push({
          product: item.productId,
          quantity: item.qty,
          price: item.price,
        });
        acc[storeId].totalAmount += itemTotal;
        
        return acc;
      }, {} as Record<string, any>);

      // Create multiple orders using the new endpoint
      const ordersData = Object.values(ordersByStore).map((storeOrder: any) => ({
        orderItems: storeOrder.items,
        shippingAddress: selectedAddress,
        deliveryContactPhone: selectedPhone,
        paymentMethod: paymentMethod
      }));

      const response = await apiClient.post('/api/v1/order/multiple', {
        orders: ordersData
      });

      const successfulOrders = response.data.orders || [];
      const errors = response.data.errors || [];

      if (errors.length > 0) {
        Alert.alert(
          'Some Orders Failed',
          `${successfulOrders.length} order${successfulOrders.length > 1 ? 's were' : ' was'} created, but ${errors.length} failed. Please try again.`
        );
        setProcessingPayment(false);
        return;
      }

      // Handle payment based on method
      if (paymentMethod === 'Online' && successfulOrders.length > 0) {
        // For online payment, process one payment for all created orders
        await handleOnlinePayment(successfulOrders);
      } else {
        // COD order - show success message
        clearCart();
        setProcessingPayment(false);
        Alert.alert(
          'Order Placed Successfully!',
          `Your ${successfulOrders.length} order${successfulOrders.length > 1 ? 's have' : ' has'} been placed with Cash on Delivery. You can track your order status in the Orders section.`,
          [
            {
              text: 'View Orders',
              onPress: () => {
                setSelectedAddress(null);
                router.push('/(tabs)/order');
              }
            }
          ]
        );
      }

    } catch (error: any) {
      console.error('Error placing order:', error);
      setProcessingPayment(false);
      Alert.alert('Error', error.response?.data?.message || 'Failed to place order. Please try again.');
    }
  };

  const handleOnlinePayment = async (orders: any[]) => {
    try {
      // We'll prefer the backend-provided key; frontend env is only a fallback
      const razorpayKey = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;
      // Create Razorpay order
      const paymentResponse = await apiClient.post('/api/v1/payment/create-order', {
        orderIds: orders.map(o => o._id)
      });

      if (!paymentResponse.data.success) {
        throw new Error('Failed to create payment order');
      }

      const { razorpayOrder, paymentIds, keyId } = paymentResponse.data;

      // Open Razorpay checkout
      const options = {
        description: `Locals order payment`,
        currency: razorpayOrder.currency,
        key: keyId || razorpayKey || '',
        amount: razorpayOrder.amount,
        name: 'Locals',
        order_id: razorpayOrder.id,
        prefill: {
          email: user?.email || '',
          contact: user?.phone || '',
          name: user?.name || '',
        },
        theme: { color: Colors.primary }
      };

      if (!RazorpayCheckout) {
        Alert.alert(
          'Payment Feature Unavailable',
          'Razorpay payments are not supported in Expo Go. Please use the standalone APK build to test payment options.',
          [{ text: 'OK', onPress: () => setProcessingPayment(false) }]
        );
        return;
      }

      RazorpayCheckout.open(options as any)
        .then(async (data: any) => {
          // Payment successful - verify it
          try {
            await apiClient.post('/api/v1/payment/verify', {
              razorpay_order_id: data.razorpay_order_id,
              razorpay_payment_id: data.razorpay_payment_id,
              razorpay_signature: data.razorpay_signature,
              paymentIds: paymentIds
            });

            clearCart();
            setProcessingPayment(false);
            Alert.alert(
              'Payment Successful!',
              'Your orders have been placed and payment received successfully.',
              [
                {
                  text: 'View Order',
                  onPress: () => {
                    setSelectedAddress(null);
                    router.push('/(tabs)/order');
                  }
                }
              ]
            );
          } catch (verifyError: any) {
            console.error('Payment verification failed:', verifyError);
            setProcessingPayment(false);
            Alert.alert(
              'Payment Verification Failed',
              'There was an issue verifying your payment. Please contact support with order ID.',
            );
          }
        })
        .catch((error: any) => {
          setProcessingPayment(false);
          
          // Parse error to determine if it was a cancellation
          let errorReason = 'unknown';
          let errorDescription = 'Payment failed';
          
          try {
            if (error.error && error.error.reason) {
              errorReason = error.error.reason;
              errorDescription = error.error.description || error.description;
            } else if (error.code === 2) {
              errorReason = 'network_error';
            } else if (typeof error.description === 'string') {
              errorDescription = error.description;
            }
          } catch (e) {
            console.error('Error parsing Razorpay error:', e);
          }

          console.log('Payment error reason:', errorReason);

          // Handle different error types
          if (errorReason === 'payment_cancelled') {
            // User cancelled - don't show error, just info
            Alert.alert(
              'Payment Cancelled',
              'You cancelled the payment. Your order has been created but is pending payment. You can try again from the Orders section.',
              [
                {
                  text: 'View Orders',
                  onPress: () => {
                    setSelectedAddress(null);
                    router.push('/(tabs)/order');
                  }
                },
                { text: 'OK', style: 'cancel' }
              ]
            );
          } else if (errorReason === 'network_error') {
            Alert.alert(
              'Network Error',
              'There was a network issue. Please check your connection and try again.',
            );
          } else {
            Alert.alert(
              'Payment Failed',
              errorDescription || 'Your payment could not be processed. Please try again or use a different payment method.',
            );
          }
        });

    } catch (error: any) {
      console.error('Error processing online payment:', error);
      setProcessingPayment(false);
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to process payment. Please try again.');
    }
  };

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={Colors.gradients.primary as [string, string]}
          style={styles.headerEmpty}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.headerTitleBlack}>My Cart</Text>
        </LinearGradient>
        
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="cart-outline" size={64} color="#CCCCCC" />
          </View>
          <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Looks like you haven&apos;t added anything to your cart yet
          </Text>
          <TouchableOpacity 
            style={styles.shopButton}
            onPress={() => router.push('/')}
          >
            <LinearGradient
              colors={Colors.gradients.primary as [string, string]}
              style={styles.shopButtonGradient}
            >
              <Ionicons name="bag-handle-outline" size={20} color="#000000" style={{ marginRight: 8 }} />
              <Text style={styles.shopButtonText}>Start Shopping</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
}

  return (
    <>
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={Colors.gradients.primary as [string, string]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={styles.headerTitleBlack}>My Cart</Text>
      </LinearGradient>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Cart Items */}
        <View style={styles.itemsSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bag-handle-outline" size={20} color={Colors.buttonPrimary} />
            <Text style={styles.sectionTitle}>Your Items</Text>
          </View>
          <Text style={styles.swipeHint}>← Swipe left to delete</Text>
          {items.map((item) => (
            <SwipeableCartItem
              key={`${item.productId}-${item.size || 'nosize'}`}
              item={item}
              updateQuantity={updateQuantity}
              removeItem={removeItem}
              onEdit={(it) => { setEditingItem(it); setEditModalVisible(true); }}
            />
          ))}
        </View>

        {/* Shipping Address */}
        <View style={styles.addressSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={20} color={Colors.buttonPrimary} />
            <Text style={styles.sectionTitle}>Delivery Address</Text>
          </View>
          <AddressSelector
            selectedAddress={selectedAddress}
            selectedPhone={selectedPhone}
            onAddressSelect={(address, phone) => {
              setSelectedAddress(address);
              setSelectedPhone(phone);
            }}
            onAddNewAddress={(address, phone) => {
              setSelectedAddress(address);
              setSelectedPhone(phone);
            }}
          />
        </View>

        {/* Order Summary */}
        <View style={styles.summarySection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="receipt-outline" size={20} color={Colors.buttonPrimary} />
            <Text style={styles.sectionTitle}>Bill Details</Text>
          </View>
          
          {/* Store-wise breakdown */}
          {Object.keys(ordersByStore).length > 1 && (
            <View style={styles.storeBreakdown}>
              <Text style={styles.breakdownTitle}>Orders will be split by store:</Text>
              {Object.values(ordersByStore).map((storeOrder: any, index: number) => (
                <View key={index} style={styles.storeOrder}>
                  <View style={styles.storeOrderHeader}>
                    <Ionicons name="storefront-outline" size={16} color={Colors.buttonPrimary} />
                    <Text style={styles.storeOrderName}>{storeOrder.storeName}</Text>
                    <Text style={styles.storeOrderAmount}>₹{formatINR(storeOrder.totalAmount)}</Text>
                  </View>
                  <Text style={styles.storeOrderItems}>
                    {storeOrder.items.length} item{storeOrder.items.length > 1 ? 's' : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
          
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Item Total</Text>
              <Text style={styles.summaryValue}>₹{formatINR(calculateTotal())}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <View style={styles.summaryLabelWithIcon}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Ionicons name="bicycle" size={16} color={Colors.textSecondary} style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.summaryValue}>₹{formatINR(calculateDeliveryFee())}</Text>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryLabelWithIcon}>
                <Text style={styles.summaryLabel}>Platform Fee</Text>
                <Ionicons name="card" size={16} color={Colors.textSecondary} style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.summaryValue}>₹{formatINR(calculatePlatformFee())}</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>To Pay</Text>
              <Text style={styles.totalValue}>₹{formatINR(calculateGrandTotal())}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Footer */}
      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <View style={styles.footerLeft}>
            <Text style={styles.footerTotal}>₹{formatINR(calculateGrandTotal())}</Text>
            <Text style={styles.footerSubtext}>Total Amount</Text>
          </View>
          <TouchableOpacity 
            style={[styles.placeOrderButton, processingPayment && styles.placeOrderButtonDisabled]}
            onPress={handlePlaceOrder}
            disabled={processingPayment}
          >
            <LinearGradient
              colors={processingPayment ? ['#CCCCCC', '#CCCCCC'] : Colors.gradients.primary as [string, string]}
              style={styles.placeOrderGradient}
            >
              <Text style={styles.placeOrderText}>
                {processingPayment ? 'Processing...' : 'Place Order'}
              </Text>
              {!processingPayment && <Ionicons name="arrow-forward" size={20} color={Colors.textPrimary} style={{ marginLeft: 8 }} />}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
      {/* Size Edit Modal */}
      <SizeSelectorModal
        visible={editModalVisible}
        product={editingItem ? editingItem.product : null}
        multiple={false}
        initialSelected={editingItem && editingItem.size ? [editingItem.size] : []}
        onConfirm={(sel) => {
          const newSize = sel && sel.length > 0 ? sel[0] : undefined;
          if (editingItem && newSize) {
            // move qty to new size line
            removeItem(editingItem.productId, editingItem.size);
            addItem(editingItem.product, editingItem.qty, newSize);
          }
          setEditModalVisible(false);
          setEditingItem(null);
        }}
        onClose={() => { setEditModalVisible(false); setEditingItem(null); }}
        title={`Edit Size${editingItem && editingItem.size ? ` (current: ${editingItem.size})` : ''}`}
      />

      {/* Payment Method Modal */}
      <PaymentMethodModal
        visible={paymentModalVisible}
        totalAmount={calculateGrandTotal()}
        onSelectPayment={handlePaymentMethodSelected}
        onClose={() => setPaymentModalVisible(false)}
        isProcessing={processingPayment}
      />
    </>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.background,
    paddingTop: 40,
    paddingBottom: 6,
    paddingHorizontal: 20,
  },
  headerEmpty: {
    backgroundColor: Colors.background,
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleBlack: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  itemBadge: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  itemBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitleBlack: {
    fontSize: 14,
    color: '#666666',
    marginTop: 6,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
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
  emptySubtitle: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  shopButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  shopButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  shopButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  itemsSection: {
    marginTop: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginLeft: 8,
  },
  swipeHint: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  swipeContainer: {
    marginBottom: 16,
    height: 150,
    position: 'relative',
  },
  deleteButtonContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: Colors.error,
    width: 70,
    height: 120,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: Colors.primary,
    width: 70,
    height: 120,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  editButtonText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  cartItem: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    height: 140,
    paddingBottom: 8,
    alignItems: 'center',
  },
  itemImageContainer: {
    width: 96,
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
    marginRight: 16,
    alignSelf: 'stretch',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  itemSize: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  storeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemStore: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  priceQuantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 4,
  },
  quantityButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: 'center',
  },
  itemTotal: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  itemDelivery: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addressSection: {
    marginTop: 24,
  },
  addressInput: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.backgroundSecondary,
    textAlignVertical: 'top',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summarySection: {
    marginTop: 24,
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  summaryLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.backgroundSecondary,
    marginVertical: 8,
  },
  totalRow: {
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  footer: {
    backgroundColor: Colors.background,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  footerLeft: {
    flex: 1,
  },
  footerTotal: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  footerSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  placeOrderButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  placeOrderButtonDisabled: {
    opacity: 0.6,
  },
  placeOrderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  placeOrderText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  storeBreakdown: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  storeOrder: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  storeOrderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  storeOrderName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginLeft: 6,
    flex: 1,
  },
  storeOrderAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.buttonPrimary,
  },
  storeOrderItems: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 22,
  },
});
