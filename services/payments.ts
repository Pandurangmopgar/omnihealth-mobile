import { Platform } from 'react-native';
import axios from 'axios';
import { loadStripe } from '@stripe/stripe-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import base64 from 'base-64';

export interface PaymentGatewayConfig {
  razorpay: {
    key_id: string;
    key_secret: string;
  };
  stripe: {
    publishable_key: string;
    secret_key: string;
  };
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  duration: 'monthly' | 'yearly';
  stripePrice?: string;
}

interface PaymentIntent {
  clientSecret: string;
  ephemeralKey?: string;
  customer?: string;
}

// Test mode API configuration
const PAYMENT_CONFIG = {
  razorpay: {
    key_id: 'rzp_test_yfFeMeVDWcZCcO',  // Your Razorpay test key ID
    key_secret: '0ZcmjRNzdGzLjT4ASilENhbd',  // Your Razorpay test secret key
  },
  stripe: {
    publishable_key: process.env.stripe_Publishable_key,
    secret_key: process.env.stripe_Secret_key,
  },
};

// Stripe test mode configuration
const stripePromise = loadStripe(PAYMENT_CONFIG.stripe.publishable_key);

// Create a payment intent for Stripe
export const createStripePaymentIntent = async (amount: number, currency: string = 'INR'): Promise<PaymentIntent> => {
  try {
    // Get the secret key from environment variables
    const stripeSecretKey = 'sk_test_51PVs1qJL529a7xrpGzYvFMtdlpq4U7Bqvt7d0vOhmcpW5Lz02Dp8WdEpYzQ1cOnHdFKw6fIyJrtDXBh7HYJkqQD600fR4vQCZE';  // Use the actual test key directly for now

    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `amount=${Math.round(amount * 100)}&currency=${currency.toLowerCase()}&payment_method_types[]=card`,
    });

    const data = await response.json();
    
    if (!response.ok) {
      // Handle specific API errors
      let errorMessage = 'Payment processing failed';
      if (data.error) {
        switch (data.error.type) {
          case 'card_error':
            errorMessage = 'There was an issue with your card. Please try a different card.';
            break;
          case 'validation_error':
            errorMessage = 'The payment information was invalid. Please check and try again.';
            break;
          case 'authentication_error':
            errorMessage = 'Authentication with Stripe failed. Please try again later.';
            break;
          default:
            errorMessage = data.error.message || 'An unexpected error occurred';
        }
      }
      throw new Error(errorMessage);
    }

    return {
      clientSecret: data.client_secret,
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

// Create a Razorpay order
export const createRazorpayOrder = async (amount: number, currency: string = 'INR') => {
  try {
    const auth = base64.encode(`${PAYMENT_CONFIG.razorpay.key_id}:${PAYMENT_CONFIG.razorpay.key_secret}`);
    
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Convert to smallest currency unit (paise)
        currency: currency,
        receipt: 'order_' + Date.now(),
        payment_capture: 1,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      let errorMessage = 'Payment processing failed';
      if (data.error) {
        errorMessage = data.error.description || data.error.message || 'An unexpected error occurred';
      }
      throw new Error(errorMessage);
    }

    return {
      id: data.id,
      amount: data.amount,
      currency: data.currency,
    };
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    throw error;
  }
};

// Verify Razorpay payment
export const verifyRazorpayPayment = async (paymentId: string, orderId: string, signature: string) => {
  try {
    // In production, this verification should be done on your backend
    const body = orderId + "|" + paymentId;
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac("sha256", PAYMENT_CONFIG.razorpay.key_secret)
      .update(body.toString())
      .digest("hex");

    const isValid = expectedSignature === signature;

    if (!isValid) {
      throw new Error('Invalid payment signature');
    }

    return true;
  } catch (error) {
    console.error('Error verifying Razorpay payment:', error);
    throw error;
  }
};

// Create subscription
export const createSubscription = async (
  userId: string,
  plan: SubscriptionPlan,
  paymentMethod: 'stripe' | 'razorpay',
  paymentId: string
) => {
  try {
    // In a real app, this would create a subscription in your backend
    const subscription = {
      id: 'sub_' + Math.random().toString(36).substr(2, 9),
      userId,
      planId: plan.id,
      paymentMethod,
      paymentId,
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + (plan.duration === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000),
    };

    // Store subscription in local storage for testing
    await storeSubscription(userId, subscription);
    return subscription;
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
};

// Store subscription data (for testing purposes)
const storeSubscription = async (userId: string, subscription: any) => {
  try {
    const key = `subscription_${userId}`;
    await AsyncStorage.setItem(key, JSON.stringify(subscription));
  } catch (error) {
    console.error('Error storing subscription:', error);
  }
};

// Check subscription status
export const checkSubscriptionStatus = async (userId: string) => {
  try {
    // In testing mode, we'll check local storage
    const key = `subscription_${userId}`;
    const storedSubscription = await AsyncStorage.getItem(key);
    
    if (storedSubscription) {
      const subscription = JSON.parse(storedSubscription);
      const now = new Date();
      const endDate = new Date(subscription.endDate);
      
      return {
        isSubscribed: now < endDate,
        plan: subscription.planId,
        expiryDate: endDate,
        subscription,
      };
    }

    return {
      isSubscribed: false,
      plan: null,
      expiryDate: null,
      subscription: null,
    };
  } catch (error) {
    console.error('Error checking subscription status:', error);
    throw error;
  }
};
