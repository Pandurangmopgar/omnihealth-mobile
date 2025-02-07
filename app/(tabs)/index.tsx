import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform, Dimensions, SafeAreaView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { MotiView } from 'moti';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

const HEALTH_ASSISTANTS = [
  {
    id: 'nutrition',
    title: 'Nutrition Analyzer',
    description: 'Get personalized nutrition advice and meal recommendations based on your health goals.',
    icon: 'nutrition',
    gradient: ['#4ade80', '#22c55e'],
  },
  {
    id: 'exercise',
    title: 'Exercise Coach',
    description: 'Tailored workout plans and exercise routines designed for your fitness level.',
    icon: 'barbell',
    gradient: ['#60a5fa', '#3b82f6'],
  },
  {
    id: 'diet',
    title: 'Diet Planner',
    description: 'Customized meal plans and dietary recommendations for your health journey.',
    icon: 'restaurant',
    gradient: ['#fbbf24', '#f59e0b'],
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  if (!isSignedIn) {
    return null;
  }

  const handleAssistantPress = (id: string) => {
    switch (id) {
      case 'nutrition':
        router.push('/(tabs)/nutritionanalyzer');
        break;
      case 'exercise':
      case 'diet':
      case 'mental':
        // Temporarily route to AI assistant until these features are implemented
        router.push('/(tabs)/aiassistant');
        break;
      default:
        router.push('/(tabs)/aiassistant');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#0B1120', '#1A237E']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.content}>
          <Animated.View 
            entering={FadeIn.delay(200)}
            style={styles.header}
          >
            <Text style={styles.title}>Health Assistant</Text>
            <Text style={styles.subtitle}>Choose your health companion</Text>
          </Animated.View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {HEALTH_ASSISTANTS.map((assistant, index) => (
              <MotiView
                key={assistant.id}
                from={{ opacity: 0, translateY: 50 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{
                  type: 'timing',
                  duration: 500,
                  delay: index * 100,
                }}
              >
                <TouchableOpacity
                  onPress={() => handleAssistantPress(assistant.id)}
                  style={styles.card}
                >
                  <LinearGradient
                    colors={assistant.gradient}
                    style={styles.cardGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.cardContent}>
                      <View style={styles.iconContainer}>
                        <Ionicons name={assistant.icon as any} size={28} color="white" />
                      </View>
                      <View style={styles.textContainer}>
                        <Text style={styles.cardTitle}>{assistant.title}</Text>
                        <Text style={styles.cardDescription}>{assistant.description}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="white" style={styles.arrow} />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </MotiView>
            ))}

            <MotiView
              from={{ opacity: 0, translateY: 50 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{
                type: 'timing',
                duration: 500,
                delay: HEALTH_ASSISTANTS.length * 100,
              }}
            >
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/premium')}
                style={styles.premiumBanner}
              >
                <LinearGradient
                  colors={['#4F46E5', '#818CF8']}
                  style={styles.premiumGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.premiumContent}>
                    <View style={styles.premiumLeft}>
                      <View style={styles.crownContainer}>
                        <Ionicons name="star" size={24} color="#FFD700" />
                      </View>
                      <View>
                        <Text style={styles.premiumTitle}>Upgrade to Premium</Text>
                        <Text style={styles.premiumDescription}>Get unlimited access to all features</Text>
                      </View>
                    </View>
                    <View style={styles.premiumRight}>
                      <View style={styles.premiumButton}>
                        <Text style={styles.premiumButtonText}>Upgrade</Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </MotiView>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    marginTop: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  cardGradient: {
    padding: 20,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
  },
  arrow: {
    marginLeft: 12,
  },
  premiumBanner: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  premiumGradient: {
    padding: 20,
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  premiumLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  crownContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  premiumDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  premiumRight: {
    marginLeft: 16,
  },
  premiumButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  premiumButtonText: {
    color: '#4F46E5',
    fontWeight: '600',
    fontSize: 14,
  },
});
