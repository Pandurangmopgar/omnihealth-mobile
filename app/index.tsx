import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ImageBackground,
  Platform,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Carousel from 'react-native-reanimated-carousel';

// Custom components
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Avatar } from '../components/ui/avatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type IconName = keyof typeof Ionicons.glyphMap;

interface PredictionTool {
  name: string;
  icon: IconName;
  color: string;
}

interface AIAgent {
  name: string;
  icon: IconName;
  color: string;
  description: string;
}

interface Testimonial {
  name: string;
  role: string;
  quote: string;
}

const predictionTools: PredictionTool[] = [
  { name: 'Heart Disease', icon: 'heart-outline', color: '#f87171' },
  { name: 'Brain Tumor', icon: 'medical-outline', color: '#c084fc' },
  { name: "Alzheimer's", icon: 'analytics-outline', color: '#60a5fa' },
  { name: 'Pneumonia', icon: 'fitness-outline', color: '#4ade80' },
  { name: 'Diabetes', icon: 'water-outline', color: '#fbbf24' },
  { name: 'Lung Cancer', icon: 'medkit-outline', color: '#f472b6' },
];

const aiAgents: AIAgent[] = [
  { 
    name: 'Nutrition Analyzer',
    icon: 'nutrition-outline',
    color: '#4ade80',
    description: 'Get personalized nutrition analysis and dietary recommendations'
  },
  { 
    name: 'Diet Planner',
    icon: 'restaurant-outline',
    color: '#fb923c',
    description: 'Create customized meal plans based on your health goals'
  },
  { 
    name: 'Exercise Coach',
    icon: 'barbell-outline',
    color: '#60a5fa',
    description: 'Get tailored workout plans and exercise guidance'
  },
];

const testimonials: Testimonial[] = [
  {
    name: 'Dr. Sarah Wilson',
    role: 'Cardiologist',
    quote: 'OmniHealth has revolutionized how I approach patient diagnostics. The AI predictions are remarkably accurate.',
  },
  {
    name: 'Dr. Michael Chen',
    role: 'Neurologist',
    quote: 'The brain tumor detection capabilities are impressive. This tool has become indispensable in my practice.',
  },
];

export default function LandingScreen() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const { height: SCREEN_HEIGHT } = useWindowDimensions();

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const heroScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.2, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Animated Header */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <BlurView intensity={80} style={styles.headerBlur}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>OmniHealth</Text>
            <TouchableOpacity style={styles.menuButton}>
              <Ionicons name="menu-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollView}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={['#151C2F', '#1B2A47']}
            style={styles.heroGradient}
          >
            <Animated.View style={[styles.heroContent, { transform: [{ scale: heroScale }] }]}>
              <Text style={styles.heroTitle}>
                AI-Powered Healthcare
              </Text>
              <Text style={styles.heroSubtitle}>
                Transform your health journey with advanced AI predictions
              </Text>
              <Button
                onPress={() => {}}
                style={styles.ctaButton}
                textStyle={styles.ctaButtonText}
              >
                Get Started
              </Button>
            </Animated.View>
          </LinearGradient>
        </View>

        {/* Prediction Tools Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Prediction Tools</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolsContainer}
          >
            {predictionTools.map((tool) => (
              <TouchableOpacity
                key={tool.name}
                style={styles.toolCard}
                onPress={() => {}}
              >
                <LinearGradient
                  colors={['rgba(59, 130, 246, 0.1)', 'rgba(14, 165, 233, 0.1)']}
                  style={styles.toolGradient}
                >
                  <View style={[styles.toolIcon, { backgroundColor: tool.color + '20' }]}>
                    <Ionicons name={tool.icon} size={24} color={tool.color} />
                  </View>
                  <Text style={styles.toolName}>{tool.name}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* AI Agents Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Health Assistants</Text>
          <View style={styles.agentsGrid}>
            {aiAgents.map((agent) => (
              <Card key={agent.name} style={styles.agentCard}>
                <View style={[styles.agentIcon, { backgroundColor: agent.color + '20' }]}>
                  <Ionicons name={agent.icon} size={24} color={agent.color} />
                </View>
                <Text style={styles.agentName}>{agent.name}</Text>
                <Text style={styles.agentDescription}>{agent.description}</Text>
              </Card>
            ))}
          </View>
        </View>

        {/* Testimonials Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What Experts Say</Text>
          <Carousel
            loop
            width={SCREEN_WIDTH - 48}
            height={200}
            data={testimonials}
            renderItem={({ item }: { item: Testimonial }) => (
              <Card style={styles.testimonialCard}>
                <Avatar
                  size={60}
                  source={{ uri: `https://i.pravatar.cc/150?u=${item.name}` }}
                />
                <Text style={styles.testimonialQuote}>{item.quote}</Text>
                <Text style={styles.testimonialName}>{item.name}</Text>
                <Text style={styles.testimonialRole}>{item.role}</Text>
              </Card>
            )}
          />
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerBlur: {
    ...Platform.select({
      ios: {
        backgroundColor: 'rgba(11, 17, 32, 0.8)',
      },
      android: {
        backgroundColor: 'rgba(11, 17, 32, 0.95)',
      },
    }),
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  menuButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  heroSection: {
    height: 500,
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  heroContent: {
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 18,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
  },
  ctaButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  section: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  toolsContainer: {
    paddingRight: 24,
  },
  toolCard: {
    width: 150,
    height: 150,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  toolGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  toolName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  agentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  agentCard: {
    width: '48%',
    padding: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
  },
  agentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  agentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  agentDescription: {
    fontSize: 14,
    color: '#94a3b8',
  },
  testimonialCard: {
    margin: 8,
    padding: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    alignItems: 'center',
  },
  testimonialQuote: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginVertical: 12,
  },
  testimonialName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  testimonialRole: {
    fontSize: 14,
    color: '#64748b',
  },
}); 