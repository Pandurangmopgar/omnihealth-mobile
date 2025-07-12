import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform, Dimensions, SafeAreaView, Image, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn, FadeInUp, FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { MotiView } from 'moti';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { LandingPage } from '../../components/LandingPage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// Enhanced nutrition stats with premium light theme
const NUTRITION_STATS = [
  { label: 'AI Analyses', value: '2.5M+', icon: 'brain-outline', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)' },
  { label: 'Active Users', value: '50K+', icon: 'people-outline', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
  { label: 'Accuracy Rate', value: '99.1%', icon: 'checkmark-circle-outline', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)' },
];

// Premium feature highlights with modern gradients
const FEATURE_HIGHLIGHTS = [
  {
    title: 'AI Vision Scanner',
    description: 'Revolutionary computer vision technology analyzes any meal in seconds with precision',
    icon: 'scan-outline',
    gradient: ['#10b981', '#059669'],
    iconBg: ['#10b981', '#059669'],
    delay: 0,
  },
  {
    title: 'Smart Nutrition Intelligence',
    description: 'Personalized insights powered by machine learning for optimal health outcomes',
    icon: 'analytics-outline',
    gradient: ['#3b82f6', '#1d4ed8'],
    iconBg: ['#3b82f6', '#1d4ed8'],
    delay: 200,
  },
  {
    title: 'Real-time Health Scoring',
    description: 'Advanced algorithms provide instant nutritional assessments and recommendations',
    icon: 'heart-outline',
    gradient: ['#8b5cf6', '#7c3aed'],
    iconBg: ['#8b5cf6', '#7c3aed'],
    delay: 400,
  },
];

const TESTIMONIALS = [
  {
    name: 'Sarah K.',
    text: 'The AI accuracy is mind-blowing. It identified my complex salad ingredients perfectly!',
    rating: 5,
    avatar: '👩‍💼',
    role: 'Fitness Coach'
  },
  {
    name: 'Mike R.',
    text: 'This is the future of nutrition tracking. Zero effort, maximum results.',
    rating: 5,
    avatar: '👨‍💻',
    role: 'Tech Professional'
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [showLandingPage, setShowLandingPage] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Check if user has seen landing page before
    const checkLandingPageStatus = async () => {
      try {
        const hasSeenLanding = await AsyncStorage.getItem('hasSeenLandingPage');
        if (hasSeenLanding === 'true') {
          setShowLandingPage(false);
        }
      } catch (error) {
        console.log('Error checking landing page status:', error);
      }
    };
    
    checkLandingPageStatus();
  }, []);

  const handleGetStarted = async () => {
    try {
      await AsyncStorage.setItem('hasSeenLandingPage', 'true');
      setShowLandingPage(false);
    } catch (error) {
      console.log('Error saving landing page status:', error);
      setShowLandingPage(false);
    }
  };

  if (!isSignedIn) {
    return null;
  }

  // Show landing page for first-time users
  if (showLandingPage) {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }

  const handleStartScanning = () => {
    console.log('Start Scanning clicked!'); // Debug log
    router.push('/(tabs)/nutritionanalyzer');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Use background image directly */}
      <ImageBackground
        source={require('../../assets/images/background_image.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.content}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Main hero section with clickable scanning area */}
            <View style={styles.heroSection}>
              {/* Clickable area positioned over the "Start Scanning" button */}
              <TouchableOpacity
                style={styles.scanningButtonArea}
                onPress={handleStartScanning}
                activeOpacity={0.7}
              >
                {/* Visual feedback for debugging */}
                {/* <View style={styles.debugButton} /> */}
              </TouchableOpacity>
            </View>

            {/* Stats Section with premium white theme */}
            <Animated.View entering={FadeInUp.delay(800)} style={styles.statsSection}>
              <MotiView
                from={{ opacity: 0, translateY: 50 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', duration: 1000, delay: 1000 }}
              >
                <Text style={styles.sectionTitle}>Trusted by Thousands</Text>
                <Text style={styles.sectionSubtitle}>Join the nutrition revolution</Text>
              </MotiView>
              
              <View style={styles.statsGrid}>
                {NUTRITION_STATS.map((stat, index) => (
                  <MotiView
                    key={stat.label}
                    from={{ opacity: 0, translateY: 60, scale: 0.8 }}
                    animate={{ opacity: 1, translateY: 0, scale: 1 }}
                    transition={{ 
                      type: 'spring', 
                      delay: 1200 + index * 200,
                      damping: 15,
                      stiffness: 100
                    }}
                    style={styles.statCard}
                  >
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
                      style={styles.statGradient}
                    >
                      <MotiView
                        from={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', duration: 600, delay: 1400 + index * 200 }}
                        style={[styles.statIcon, { backgroundColor: stat.bgColor }]}
                      >
                        <Ionicons name={stat.icon as any} size={28} color={stat.color} />
                      </MotiView>
                      <Text style={styles.statValue}>{stat.value}</Text>
                      <Text style={styles.statLabel}>{stat.label}</Text>
                    </LinearGradient>
                  </MotiView>
                ))}
              </View>
            </Animated.View>

            {/* Features Section with enhanced animations */}
            <Animated.View entering={FadeInUp.delay(1600)} style={styles.featuresSection}>
              <MotiView
                from={{ opacity: 0, translateY: 50 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', duration: 1000, delay: 1800 }}
                style={styles.featureHeader}
              >
                <Text style={styles.sectionTitle}>Why Choose Our Nutrition AI?</Text>
                <Text style={styles.sectionSubtitle}>Cutting-edge technology meets user experience</Text>
              </MotiView>
              
              <View style={styles.featuresGrid}>
                {FEATURE_HIGHLIGHTS.map((feature, index) => (
                  <MotiView
                    key={feature.title}
                    from={{ 
                      opacity: 0, 
                      translateX: index % 2 === 0 ? -100 : 100,
                      rotateY: index % 2 === 0 ? '-15deg' : '15deg'
                    }}
                    animate={{ 
                      opacity: 1, 
                      translateX: 0,
                      rotateY: '0deg'
                    }}
                    transition={{ 
                      type: 'spring', 
                      delay: 2000 + feature.delay,
                      damping: 12,
                      stiffness: 80
                    }}
                    style={styles.featureCard}
                  >
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.98)', 'rgba(255, 255, 255, 0.92)']}
                      style={styles.featureGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <LinearGradient
                        colors={feature.gradient}
                        style={styles.featureIcon}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Ionicons name={feature.icon as any} size={32} color="white" />
                      </LinearGradient>
                      <Text style={styles.featureTitle}>{feature.title}</Text>
                      <Text style={styles.featureDescription}>{feature.description}</Text>
                    </LinearGradient>
                  </MotiView>
                ))}
              </View>
            </Animated.View>

            {/* Testimonials Section with premium styling */}
            <Animated.View entering={FadeInUp.delay(2400)} style={styles.testimonialsSection}>
              <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', duration: 800, delay: 2600 }}
              >
                <Text style={styles.sectionTitle}>What Our Users Say</Text>
                <Text style={styles.sectionSubtitle}>Real stories from real users</Text>
              </MotiView>
              
              <MotiView
                key={currentTestimonial}
                from={{ opacity: 0, scale: 0.8, rotateX: '45deg' }}
                animate={{ opacity: 1, scale: 1, rotateX: '0deg' }}
                transition={{ type: 'spring', damping: 15, stiffness: 100 }}
                style={styles.testimonialCard}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.9)']}
                  style={styles.testimonialGradient}
                >
                  <Text style={styles.testimonialAvatar}>
                    {TESTIMONIALS[currentTestimonial].avatar}
                  </Text>
                  <Text style={styles.testimonialText}>
                    "{TESTIMONIALS[currentTestimonial].text}"
                  </Text>
                  <View style={styles.testimonialFooter}>
                    <Text style={styles.testimonialName}>
                      {TESTIMONIALS[currentTestimonial].name}
                    </Text>
                    <Text style={styles.testimonialRole}>
                      {TESTIMONIALS[currentTestimonial].role}
                    </Text>
                    <View style={styles.ratingContainer}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <MotiView
                          key={i}
                          from={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', duration: 400, delay: 100 * i }}
                        >
                          <Ionicons
                            name="star"
                            size={16}
                            color="#fbbf24"
                          />
                        </MotiView>
                      ))}
                    </View>
                  </View>
                </LinearGradient>
              </MotiView>
            </Animated.View>

            {/* Premium CTA with enhanced styling */}
            <Animated.View entering={FadeInUp.delay(2800)} style={styles.premiumSection}>
              <MotiView
                from={{ opacity: 0, translateY: 50, scale: 0.9 }}
                animate={{ opacity: 1, translateY: 0, scale: 1 }}
                transition={{ type: 'spring', delay: 3000, damping: 12, stiffness: 80 }}
              >
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/premium')}
                  style={styles.premiumCard}
                >
                  <LinearGradient
                    colors={['#667eea', '#764ba2', '#6366f1']}
                    style={styles.premiumGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.premiumContent}>
                      <MotiView
                        from={{ rotate: '0deg' }}
                        animate={{ rotate: '360deg' }}
                        transition={{ type: 'timing', duration: 2000, loop: true }}
                      >
                        <Ionicons name="diamond" size={40} color="#fbbf24" />
                      </MotiView>
                      <Text style={styles.premiumTitle}>Unlock Premium</Text>
                      <Text style={styles.premiumDescription}>
                        Get unlimited analyses, advanced insights, and personalized meal plans
                      </Text>
                      <View style={styles.premiumButton}>
                        <Text style={styles.premiumButtonText}>Upgrade Now</Text>
                        <Ionicons name="arrow-forward" size={18} color="#667eea" />
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </MotiView>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  // Background and layout
  backgroundImage: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Account for tab bar
  },
  
  // Hero section with full background image
  heroSection: {
    height: height * 0.85, // Take most of screen height to show full image
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Clickable area positioned over the "Start Scanning" button in the image
  scanningButtonArea: {
    position: 'absolute',
    top: height * 0.26, // Moved up to better match the button position
    left: width * 0.2,
    right: width * 0.2,
    height: 65,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Debug button for visual feedback (remove in production)
  // debugButton: {
  //   width: '100%',
  //   height: '100%',
  //   backgroundColor: 'rgba(16, 185, 129, 0.1)', // Very subtle green overlay
  //   borderRadius: 32,
  //   borderWidth: 2,
  //   borderColor: 'rgba(16, 185, 129, 0.3)',
  // },
  
  // Stats Section with premium white theme
  statsSection: {
    paddingHorizontal: 24,
    paddingVertical: 50,
    backgroundColor: '#f8fafc',
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 40,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  statGradient: {
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  statIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1e293b',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '600',
  },
  
  // Features Section
  featuresSection: {
    paddingHorizontal: 24,
    paddingVertical: 50,
    backgroundColor: 'rgba(248, 250, 252, 0.95)',
  },
  featureHeader: {
    marginBottom: 40,
  },
  featuresGrid: {
    gap: 20,
  },
  featureCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  featureGradient: {
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.6)',
  },
  featureIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  featureTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 12,
  },
  featureDescription: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
    fontWeight: '500',
  },
  
  // Testimonials Section
  testimonialsSection: {
    paddingHorizontal: 24,
    paddingVertical: 50,
    backgroundColor: '#ffffff',
  },
  testimonialCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.1,
    shadowRadius: 32,
    elevation: 16,
  },
  testimonialGradient: {
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.5)',
  },
  testimonialAvatar: {
    fontSize: 64,
    marginBottom: 24,
  },
  testimonialText: {
    fontSize: 20,
    color: '#334155',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 24,
    lineHeight: 28,
    fontWeight: '500',
  },
  testimonialFooter: {
    alignItems: 'center',
    gap: 8,
  },
  testimonialName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  testimonialRole: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  
  // Premium Section
  premiumSection: {
    paddingHorizontal: 24,
    paddingVertical: 50,
    backgroundColor: '#f1f5f9',
  },
  premiumCard: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  premiumGradient: {
    padding: 32,
  },
  premiumContent: {
    alignItems: 'center',
  },
  premiumTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    marginVertical: 16,
  },
  premiumDescription: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 26,
    fontWeight: '500',
  },
  premiumButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  premiumButtonText: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: '800',
  },
});

