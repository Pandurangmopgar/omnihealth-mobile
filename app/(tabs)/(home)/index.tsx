import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform, ViewStyle, Image, Dimensions, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/card';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useSignIn } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';

WebBrowser.maybeCompleteAuthSession();

const PREDICTION_TOOLS = [
  {
    id: 'heart',
    title: 'Heart Health',
    description: 'Predict cardiovascular risks',
    icon: 'heart-outline' as const,
    color: '#ff6b6b',
  },
  {
    id: 'brain',
    title: 'Brain Analysis',
    description: 'Neural pattern detection',
    icon: 'scan-outline' as const,
    color: '#845ef7',
  },
  {
    id: 'lungs',
    title: 'Respiratory',
    description: 'Lung health monitoring',
    icon: 'fitness-outline' as const,
    color: '#4dabf7',
  },
];

const AI_ASSISTANTS = [
  {
    id: 'nutrition',
    title: 'Nutrition Analyzer',
    description: 'Get personalized nutrition analysis',
    icon: 'nutrition-outline' as const,
    color: '#51cf66',
  },
  {
    id: 'diet',
    title: 'Diet Planner',
    description: 'Customized meal plans',
    icon: 'restaurant-outline' as const,
    color: '#fcc419',
  },
  {
    id: 'exercise',
    title: 'Exercise Coach',
    description: 'Tailored workout guidance',
    icon: 'barbell-outline' as const,
    color: '#339af0',
  },
];

const TESTIMONIALS = [
  {
    id: '1',
    name: 'Dr. Sarah Wilson',
    role: 'Cardiologist',
    quote: 'The AI predictions are remarkably accurate.',
    avatar: 'https://randomuser.me/api/portraits/women/1.jpg',
  },
  {
    id: '2',
    name: 'Dr. Michael Chen',
    role: 'Neurologist',
    quote: 'Revolutionary approach to diagnostics.',
    avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
  },
];

export default function HomeScreen() {
  console.log('HomeScreen component rendering in (home)/index.tsx');
  useEffect(() => {
    console.log('HomeScreen mounted in (home)/index.tsx');
  }, []);

  const colorScheme = useColorScheme();
  console.log('Current colorScheme:', colorScheme);
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { isSignedIn, signOut } = useAuth();
  const { signIn } = useSignIn();
  const router = useRouter();

  const handleSignIn = async () => {
    try {
      if (!signIn) return;

      const redirectUrl = Platform.select({
        ios: "omnihealth-mobile://oauth/native-callback",
        android: "omnihealth-mobile://oauth/native-callback",
      });

      if (!redirectUrl) return;

      const result = await signIn.create({
        strategy: "oauth_google",
        redirectUrl,
      });
      
      const url = result.firstFactorVerification.externalVerificationRedirectURL;
      if (!url) return;

      await WebBrowser.openAuthSessionAsync(
        url.toString(),
        redirectUrl
      );
    } catch (err) {
      console.error("OAuth error", err);
    }
  };

  const renderPredictionTool = useCallback((tool: typeof PREDICTION_TOOLS[number]) => {
    const cardStyle: ViewStyle = {
      ...styles.toolCard,
      backgroundColor: colorScheme === 'dark' ? 'rgba(26, 26, 26, 0.8)' : 'rgba(245, 245, 245, 0.8)',
    };

    return (
      <Card
        key={tool.id}
        gradient
        style={cardStyle}
        onPress={() => {}}>
        <View style={[styles.iconContainer, { backgroundColor: `${tool.color}20` }]}>
          <Ionicons name={tool.icon} size={28} color={tool.color} />
        </View>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{tool.title}</Text>
        <Text style={[styles.cardDescription, { color: colors.tabIconDefault }]}>
          {tool.description}
        </Text>
      </Card>
    );
  }, [colorScheme, colors]);

  const renderAIAssistant = useCallback((assistant: typeof AI_ASSISTANTS[number]) => {
    const cardStyle: ViewStyle = {
      ...styles.assistantCard,
      backgroundColor: colorScheme === 'dark' ? 'rgba(26, 26, 26, 0.8)' : 'rgba(245, 245, 245, 0.8)',
    };

    return (
      <Card
        key={assistant.id}
        gradient
        style={cardStyle}
        onPress={() => {}}>
        <View style={[styles.iconContainer, { backgroundColor: `${assistant.color}20` }]}>
          <Ionicons name={assistant.icon} size={32} color={assistant.color} />
        </View>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{assistant.title}</Text>
        <Text style={[styles.cardDescription, { color: colors.tabIconDefault }]}>
          {assistant.description}
        </Text>
      </Card>
    );
  }, [colorScheme, colors]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={[styles.title, { color: colors.text }]}>OmniHealth</Text>
            {isSignedIn ? (
              <TouchableOpacity onPress={() => signOut()}>
                <Ionicons name="person-circle-outline" size={32} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleSignIn}>
                <Text style={[styles.signInText, { color: colors.tint }]}>Sign In</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.subtitle, { color: colors.text }]}>
            Transform your health journey with AI
          </Text>
        </View>

        {/* Get Started Button */}
        <TouchableOpacity style={styles.getStartedButton}>
          <LinearGradient
            colors={['#4c669f', '#3b5998', '#192f6a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradient}>
            <Text style={styles.getStartedText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.buttonIcon} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Prediction Tools Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>AI Prediction Tools</Text>
            <TouchableOpacity style={styles.viewAllButton}>
              <Text style={[styles.viewAllText, { color: colors.tint }]}>View All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolsContainer}
          >
            {PREDICTION_TOOLS.map(renderPredictionTool)}
          </ScrollView>
        </View>

        {/* AI Assistants Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>AI Health Assistants</Text>
            <TouchableOpacity style={styles.viewAllButton}>
              <Text style={[styles.viewAllText, { color: colors.tint }]}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.assistantsGrid}>
            {AI_ASSISTANTS.map(renderAIAssistant)}
          </View>
        </View>

        {/* Testimonials Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>What Experts Say</Text>
          <View style={styles.testimonialContainer}>
            {TESTIMONIALS.map((testimonial) => (
              <Card key={testimonial.id} style={styles.testimonialCard}>
                <Image source={{ uri: testimonial.avatar }} style={styles.testimonialAvatar} />
                <Text style={[styles.testimonialQuote, { color: colors.text }]}>"{testimonial.quote}"</Text>
                <Text style={[styles.testimonialName, { color: colors.text }]}>{testimonial.name}</Text>
                <Text style={[styles.testimonialRole, { color: colors.tabIconDefault }]}>{testimonial.role}</Text>
              </Card>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  content: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 30,
    paddingTop: Platform.OS === 'android' ? 20 : 0,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: Platform.OS === 'ios' ? '800' : 'bold',
  },
  signInText: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    lineHeight: 24,
  },
  getStartedButton: {
    marginHorizontal: 20,
    marginBottom: 40,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  gradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  section: {
    marginBottom: 40,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
  },
  viewAllButton: {
    padding: 8,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toolsContainer: {
    paddingHorizontal: 20,
    paddingRight: 36,
  },
  toolCard: {
    width: 160,
    padding: 16,
    marginRight: 16,
    borderWidth: 0,
  },
  assistantsGrid: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  assistantCard: {
    width: '48%',
    padding: 16,
    marginBottom: 16,
    borderWidth: 0,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
  testimonialCard: {
    margin: 8,
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  testimonialAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 12,
  },
  testimonialQuote: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  testimonialName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  testimonialRole: {
    fontSize: 14,
    opacity: 0.8,
  },
  testimonialContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
}); 