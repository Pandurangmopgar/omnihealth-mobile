import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  StatusBar,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp, FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { MotiView } from 'moti';

const { width, height } = Dimensions.get('window');

interface LandingPageProps {
  onGetStarted: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const router = useRouter();
  const [logoError, setLogoError] = useState(false);

  const handleStartScanning = () => {
    onGetStarted();
    router.push('/(tabs)/nutritionanalyzer');
  };

  return (
    <ImageBackground
      source={require('../assets/images/background_image.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(6, 12, 28, 0.85)', 'rgba(15, 23, 42, 0.8)', 'rgba(30, 41, 59, 0.75)']}
        style={styles.gradientOverlay}
      >
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          
          {/* Header with Logo */}
          <Animated.View entering={FadeInDown.delay(200)} style={styles.header}>
            {!logoError ? (
              <Image
                source={require('../assets/images/omnihealth_logo.png')}
                style={styles.logo}
                resizeMode="contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <View style={styles.logoFallback}>
                <Text style={styles.logoText}>OmniHealth</Text>
              </View>
            )}
          </Animated.View>

          {/* Main Content */}
          <View style={styles.content}>
            {/* Hero Text Section */}
            <Animated.View entering={FadeInUp.delay(400)} style={styles.heroTextContainer}>
              <Text style={styles.heroTitle}>Nutrition Analyzer</Text>
              <Text style={styles.heroSubtitle}>
                Snap any meal. See macros instantly.
              </Text>
            </Animated.View>

            {/* CTA Button */}
            <Animated.View entering={FadeInUp.delay(600)} style={styles.ctaContainer}>
              <TouchableOpacity
                onPress={handleStartScanning}
                style={styles.startButton}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#10b981', '#059669']}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.buttonText}>Start Scanning</Text>
                  <Ionicons name="arrow-forward" size={20} color="#ffffff" />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Premium Phone Mockup Section */}
            <Animated.View entering={FadeInRight.delay(800)} style={styles.heroImageContainer}>
              <MotiView
                from={{
                  opacity: 0,
                  scale: 0.8,
                  rotateY: '15deg',
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  rotateY: '0deg',
                }}
                transition={{
                  type: 'spring',
                  duration: 1200,
                  delay: 1000,
                }}
                style={styles.phoneContainer}
              >
                {/* Phone Frame */}
                <View style={styles.phoneFrame}>
                  <View style={styles.phoneScreen}>
                    <View style={styles.phoneContent}>
                      <View style={styles.mockHeader}>
                        <View style={styles.mockStatusBar}>
                          <Text style={styles.mockTime}>9:41</Text>
                          <View style={styles.mockIndicators}>
                            <Ionicons name="cellular" size={14} color="#ffffff" />
                            <Ionicons name="wifi" size={14} color="#ffffff" />
                            <Ionicons name="battery-full" size={14} color="#ffffff" />
                          </View>
                        </View>
                      </View>
                      
                      {/* Mock Camera View */}
                      <View style={styles.mockCameraView}>
                        <View style={styles.mockFoodImage}>
                          <Ionicons name="restaurant" size={40} color="#10b981" />
                        </View>
                        
                        {/* Scanning Animation */}
                        <MotiView
                          from={{ opacity: 0.3, scaleX: 0.5 }}
                          animate={{ opacity: [0.3, 1, 0.3], scaleX: [0.5, 1, 0.5] }}
                          transition={{
                            type: 'timing',
                            duration: 2000,
                            loop: true,
                          }}
                          style={styles.scanLine}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              </MotiView>

              {/* Floating Nutrition Card Overlay */}
              <MotiView
                from={{
                  opacity: 0,
                  translateY: 20,
                  scale: 0.9,
                }}
                animate={{
                  opacity: 1,
                  translateY: 0,
                  scale: 1,
                }}
                transition={{
                  type: 'spring',
                  duration: 800,
                  delay: 1400,
                }}
                style={styles.nutritionCardOverlay}
              >
                <View style={styles.nutritionCard}>
                  <Text style={styles.calorieText}>240 Cal</Text>
                  <Text style={styles.macroText}>12 g Protein</Text>
                  <Text style={styles.macroText}>30 g Carbs</Text>
                  <Text style={styles.macroText}>10 g Fat</Text>
                </View>
              </MotiView>
            </Animated.View>

            {/* Feature Highlights */}
            <Animated.View entering={FadeInUp.delay(1000)} style={styles.featuresContainer}>
              <View style={styles.featureRow}>
                <MotiView
                  from={{ opacity: 0, translateX: -30 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ type: 'timing', duration: 600, delay: 1200 }}
                  style={styles.featureItem}
                >
                  <View style={styles.featureIcon}>
                    <Ionicons name="scan" size={24} color="#10b981" />
                  </View>
                  <Text style={styles.featureText}>Instant Recognition</Text>
                </MotiView>

                <MotiView
                  from={{ opacity: 0, translateX: 30 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ type: 'timing', duration: 600, delay: 1400 }}
                  style={styles.featureItem}
                >
                  <View style={styles.featureIcon}>
                    <Ionicons name="analytics" size={24} color="#10b981" />
                  </View>
                  <Text style={styles.featureText}>Accurate Analysis</Text>
                </MotiView>
              </View>

              <View style={styles.featureRow}>
                <MotiView
                  from={{ opacity: 0, translateX: -30 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ type: 'timing', duration: 600, delay: 1600 }}
                  style={styles.featureItem}
                >
                  <View style={styles.featureIcon}>
                    <Ionicons name="trending-up" size={24} color="#10b981" />
                  </View>
                  <Text style={styles.featureText}>Progress Tracking</Text>
                </MotiView>

                <MotiView
                  from={{ opacity: 0, translateX: 30 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ type: 'timing', duration: 600, delay: 1800 }}
                  style={styles.featureItem}
                >
                  <View style={styles.featureIcon}>
                    <Ionicons name="heart" size={24} color="#10b981" />
                  </View>
                  <Text style={styles.featureText}>Health Insights</Text>
                </MotiView>
              </View>
            </Animated.View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  gradientOverlay: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 40,
  },
  logoFallback: {
    width: 120,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  logoText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  heroTextContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -1,
  },
  heroSubtitle: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '400',
  },
  ctaContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  startButton: {
    borderRadius: 30,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 18,
    gap: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroImageContainer: {
    alignItems: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  phoneContainer: {
    position: 'relative',
  },
  phoneFrame: {
    width: width * 0.85,
    height: width * 0.85,
    maxWidth: 400,
    maxHeight: 400,
    borderRadius: 20,
    overflow: 'hidden',
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  phoneContent: {
    flex: 1,
    justifyContent: 'center',
  },
  mockHeader: {
    height: 40,
    padding: 8,
    backgroundColor: '#000',
  },
  mockStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mockTime: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  mockIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mockCameraView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockFoodImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  nutritionCardOverlay: {
    position: 'absolute',
    top: '15%',
    left: '10%',
    zIndex: 10,
  },
  nutritionCard: {
    backgroundColor: '#10b981',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  calorieText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  macroText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    opacity: 0.95,
  },
  featuresContainer: {
    marginTop: 20,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  featureText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 18,
  },
}); 