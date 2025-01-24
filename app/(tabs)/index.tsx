import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform, Dimensions, SafeAreaView } from 'react-native';
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
  {
    id: 'mental',
    title: 'Mental Wellness',
    description: 'Support and guidance for mental health, stress management, and mindfulness.',
    icon: 'brain',
    gradient: ['#c084fc', '#a855f7'],
  }
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
                  style={styles.card}
                  onPress={() => handleAssistantPress(assistant.id)}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={assistant.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardGradient}
                  >
                    <View style={styles.cardContent}>
                      <View style={styles.iconContainer}>
                        <Ionicons name={assistant.icon as keyof typeof Ionicons.glyphMap} size={32} color="#fff" />
                      </View>
                      <View style={styles.textContainer}>
                        <Text style={styles.cardTitle}>{assistant.title}</Text>
                        <Text style={styles.cardDescription}>{assistant.description}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="#fff" style={styles.arrow} />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </MotiView>
            ))}
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
    paddingTop: Platform.OS === 'android' ? 20 : 0,
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  card: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  cardGradient: {
    padding: 20,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
    marginRight: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
  arrow: {
    opacity: 0.9,
  },
});
