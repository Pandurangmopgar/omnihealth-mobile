import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RazorpayWebView from '../../components/RazorpayWebView';
import { createStripePaymentIntent, createRazorpayOrder, createSubscription } from '../../services/payments';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '@clerk/clerk-expo';

const { width } = Dimensions.get('window');

const SUBSCRIPTION_PLANS = [
  {
    id: 'monthly',
    name: 'Monthly Premium',
    price: 299,
    currency: 'INR',
    features: [
      'Detailed Nutrition Analysis',
      'Custom Meal Plans',
      'Exercise Programs',
      'Priority AI Support',
      'Progress Analytics'
    ],
    duration: 'monthly',
    color: ['#4F46E5', '#818CF8'],
    stripePrice: 'price_H5jTxczjBpX9Hb', // Test mode price ID
  },
  {
    id: 'yearly',
    name: 'Yearly Premium',
    price: 2999,
    currency: 'INR',
    features: [
      'All Monthly Features',
      '2 Months Free',
      'Personal Diet Coach',
      'Video Consultations',
      'Premium Recipes'
    ],
    duration: 'yearly',
    color: ['#059669', '#34D399'],
    stripePrice: 'price_H5jUxczjCpX9Hc', // Test mode price ID
  }
];

const PremiumScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(SUBSCRIPTION_PLANS[0]); // Initialize with first plan
  const [razorpayVisible, setRazorpayVisible] = useState(false);
  const [razorpayOrderId, setRazorpayOrderId] = useState('');

  const handleStripePayment = async () => {
    if (!selectedPlan) {
      Alert.alert('Select Plan', 'Please select a subscription plan to continue.');
      return;
    }

    try {
      setLoading(true);
      await initializeStripe();

      const { error: presentError } = await presentPaymentSheet();
      
      if (presentError) {
        handlePaymentError(presentError);
      } else {
        Alert.alert(
          'Payment Successful', 
          'Thank you for your subscription! Your premium features are now activated.',
          [
            {
              text: 'OK',
              onPress: async () => {
                try {
                  await createSubscription(
                    user?.id || '',
                    selectedPlan,
                    'stripe',
                    'payment_' + Date.now()
                  );
                  handlePaymentSuccess('stripe');
                } catch (subError) {
                  console.error('Subscription creation error:', subError);
                  Alert.alert(
                    'Warning',
                    'Payment was successful, but we encountered an issue activating your subscription. Please contact support.',
                    [{ text: 'OK' }]
                  );
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Payment error:', error);
      handlePaymentError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRazorpayPayment = async () => {
    if (!selectedPlan) {
      Alert.alert('Select Plan', 'Please select a subscription plan to continue.');
      return;
    }

    try {
      setLoading(true);
      const order = await createRazorpayOrder(selectedPlan.price);
      setRazorpayOrderId(order.id);
      setRazorpayVisible(true);
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      handlePaymentError(error);
    } finally {
      setLoading(false);
    }
  };

  const initializeStripe = async () => {
    if (!selectedPlan) {
      throw new Error('No plan selected');
    }

    try {
      setLoading(true);
      const { clientSecret } = await createStripePaymentIntent(selectedPlan.price, 'inr');

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'OmniHealth',
        defaultBillingDetails: {
          name: user?.fullName || '',
        },
        appearance: {
          colors: {
            primary: '#4F46E5',
            background: '#ffffff',
            componentBackground: '#f3f4f6',
            componentBorder: '#e5e7eb',
            componentDivider: '#e5e7eb',
            primaryText: '#1f2937',
            secondaryText: '#6b7280',
            componentText: '#1f2937',
            placeholderText: '#9ca3af',
          },
          shapes: {
            borderRadius: 8,
          },
        },
      });

      if (initError) {
        throw initError;
      }
    } catch (error) {
      console.error('Error initializing payment sheet:', error);
      handlePaymentError(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (provider: 'stripe' | 'razorpay', paymentId?: string) => {
    try {
      if (provider === 'razorpay' && paymentId) {
        // Create subscription after successful Razorpay payment
        await createSubscription(
          user?.id || '',
          selectedPlan,
          'razorpay',
          paymentId
        );
      }

      Alert.alert(
        'Payment Successful',
        'Thank you for subscribing to OmniHealth Premium!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error processing payment:', error);
      Alert.alert('Error', 'There was an error processing your payment.');
    }
  };

  const handlePaymentError = (error: any) => {
    let title = 'Payment Failed';
    let message = 'An error occurred during payment. Please try again.';

    // Handle specific error cases
    switch (error.code) {
      case 'Canceled':
        title = 'Payment Canceled';
        message = 'You canceled the payment. Please try again when you\'re ready.';
        break;
      case 'Failed':
        title = 'Payment Failed';
        message = error.message || 'The payment could not be processed. Please try a different card or contact support.';
        break;
      case 'InvalidRequest':
        title = 'Invalid Request';
        message = 'There was a problem with the payment request. Please try again or contact support.';
        break;
      case 'CardError':
        title = 'Card Error';
        message = error.message || 'Your card was declined. Please try a different card.';
        break;
      case 'AuthenticationError':
        title = 'Authentication Required';
        message = 'Additional authentication is required. Please complete the authentication process.';
        break;
      case 'NetworkError':
        title = 'Network Error';
        message = 'Please check your internet connection and try again.';
        break;
      default:
        if (error.message) {
          message = error.message;
        }
    }

    Alert.alert(title, message, [
      { 
        text: 'OK',
        onPress: () => {
          // Reset payment sheet if needed
          initializeStripe();
        }
      }
    ]);
  };

  const PlanCard = ({ plan, isSelected, onSelect }) => (
    <TouchableOpacity
      onPress={() => onSelect(plan)}
      activeOpacity={0.9}
    >
      <Animated.View
        entering={FadeInDown.delay(200)}
        style={[
          styles.planCard,
          isSelected && styles.selectedPlan
        ]}
      >
        <LinearGradient
          colors={plan.color}
          style={styles.planGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.planPrice}>
            ₹{plan.price}
            <Text style={styles.duration}>/{plan.duration}</Text>
          </Text>
          <View style={styles.featuresContainer}>
            {plan.features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );

  return (
    <StripeProvider 
      publishableKey="pk_test_51PVs1qJL529a7xrpSCGTMbBwCDhjE9Z1bksK4J5vFiD1WsbEouufNrzxGSn5diY2ZfacrT3LBOi9xTVlJVmzfItT00eS8EFAHn"  
      merchantIdentifier="merchant.com.omnihealth"
    >
      <View style={[styles.container]}>
        <StatusBar style="light" />
        <LinearGradient
          colors={['#1a1b1e', '#2d2f34']}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={{ paddingTop: insets.top }}>
            <Text style={styles.title}>Premium Features</Text>
            <Text style={styles.subtitle}>Unlock all premium features</Text>

            <View style={styles.planContainer}>
              {SUBSCRIPTION_PLANS.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isSelected={selectedPlan?.id === plan.id}
                  onSelect={() => setSelectedPlan(plan)}
                />
              ))}
            </View>

            <View style={styles.paymentContainer}>
              <TouchableOpacity
                style={[
                  styles.paymentButton, 
                  styles.stripeButton,
                  (!selectedPlan || loading) && styles.disabledButton
                ]}
                onPress={handleStripePayment}
                disabled={!selectedPlan || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.buttonText}>Pay with Stripe</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentButton, 
                  styles.razorpayButton,
                  (!selectedPlan || loading) && styles.disabledButton
                ]}
                onPress={handleRazorpayPayment}
                disabled={!selectedPlan || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.buttonText}>Pay with Razorpay</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <RazorpayWebView
          isVisible={razorpayVisible}
          onClose={() => setRazorpayVisible(false)}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentError={handlePaymentError}
          orderAmount={selectedPlan?.price || 0}
          userEmail={user?.primaryEmailAddress?.emailAddress || ''}
          userName={user?.fullName || ''}
          orderId={razorpayOrderId}
        />
      </View>
    </StripeProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1b1e',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#9ca3af',
    marginBottom: 24,
  },
  planContainer: {
    marginBottom: 32,
  },
  paymentContainer: {
    marginBottom: 32,
  },
  paymentButton: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  stripeButton: {
    backgroundColor: '#4F46E5',
  },
  razorpayButton: {
    backgroundColor: '#00ADD8',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  planCard: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  selectedPlan: {
    transform: [{ scale: 1.02 }],
  },
  planGradient: {
    padding: 20,
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  duration: {
    fontSize: 16,
    fontWeight: 'normal',
  },
  featuresContainer: {
    marginTop: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
  },
});

export default PremiumScreen;
