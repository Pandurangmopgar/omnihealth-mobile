import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform, Dimensions, SafeAreaView, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { Link, router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

const HEALTH_ASSISTANTS = [
  {
    id: 'nutrition',
    title: 'Nutrition Analyzer',
    description: 'Get personalized nutrition advice',
    icon: 'nutrition-outline',
    gradient: ['#4ade80', '#22c55e'],
  },
  {
    id: 'exercise',
    title: 'Exercise Coach',
    description: 'Tailored workout plans',
    icon: 'barbell-outline',
    gradient: ['#60a5fa', '#3b82f6'],
  },
  {
    id: 'diet',
    title: 'Diet Planner',
    description: 'Customized meal plans',
    icon: 'restaurant-outline',
    gradient: ['#fbbf24', '#f59e0b'],
  }
];

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  if (!isSignedIn) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#0B1120' }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>OmniHealth</Text>
            <TouchableOpacity 
              style={styles.signInButton}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Text style={styles.signInText}>
                Profile
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            Transform your health journey with AI
          </Text>
        </View>

        {/* Get Started Button */}
        <TouchableOpacity
          style={styles.getStartedButton}
          onPress={() => router.push('/(tabs)/aiassistant')}
        >
          <LinearGradient
            colors={['#4C6EF5', '#228BE6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.getStartedGradient}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Health Assistants */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Health Assistants</Text>
          </View>

          <View style={styles.grid}>
            {HEALTH_ASSISTANTS.map((assistant, index) => (
              <Animated.View
                key={assistant.id}
                entering={FadeInDown.delay(index * 100)}
                style={styles.gridItem}
              >
                <TouchableOpacity
                  onPress={() => router.push({
                    pathname: '/(tabs)/aiassistant',
                    params: { service: assistant.id }
                  })}
                >
                  <LinearGradient
                    colors={assistant.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.card}
                  >
                    <View style={styles.cardIcon}>
                      <Ionicons 
                        name={assistant.icon as keyof typeof Ionicons.glyphMap} 
                        size={24} 
                        color="#fff" 
                      />
                    </View>
                    <Text style={styles.cardTitle}>{assistant.title}</Text>
                    <Text style={styles.cardDescription}>
                      {assistant.description}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  signInButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  signInText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  getStartedButton: {
    marginBottom: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  getStartedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  getStartedText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    flex: 1,
    minWidth: width * 0.44,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    height: 180,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
