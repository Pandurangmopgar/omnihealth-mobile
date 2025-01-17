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

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2;
const CARD_SPACING = 20;

WebBrowser.maybeCompleteAuthSession();

const AI_ASSISTANTS = [
  {
    id: 'nutrition',
    title: 'Nutrition Analyzer',
    description: 'Get personalized nutrition analysis and dietary recommendations based on your health profile.',
    icon: 'nutrition-outline' as const,
    color: '#51cf66',
  },
  {
    id: 'exercise',
    title: 'Exercise Coach',
    description: 'Get tailored workout plans and real-time exercise guidance for your fitness goals.',
    icon: 'barbell-outline' as const,
    color: '#339af0',
  },
  {
    id: 'diet',
    title: 'Diet Planner',
    description: 'Create customized meal plans that match your nutritional needs and preferences.',
    icon: 'restaurant-outline' as const,
    color: '#fcc419',
  }
];

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { isSignedIn, isLoaded } = useAuth();
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

      // Close any existing sessions
      await WebBrowser.coolDownAsync();

      const result = await signIn.create({
        strategy: "oauth_google",
        redirectUrl,
      });
      
      const { firstFactorVerification: { externalVerificationRedirectURL } } = result;
      
      if (!externalVerificationRedirectURL) return;

      const authResult = await WebBrowser.openAuthSessionAsync(
        externalVerificationRedirectURL.toString(),
        redirectUrl,
        {
          showInRecents: true,
          preferEphemeralSession: true,
        }
      );

      if (authResult.type === 'success') {
        // The OAuth flow will handle the rest through the root layout
        console.log("OAuth flow completed successfully");
      }
    } catch (err) {
      console.error("OAuth error", err);
    }
  };

  // Show loading state while auth is being determined
  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderAIAssistant = useCallback((assistant: typeof AI_ASSISTANTS[number]) => {
    const cardStyle: ViewStyle = {
      ...styles.assistantCard,
      backgroundColor: colorScheme === 'dark' ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.8)',
      width: CARD_WIDTH,
    };

    return (
      <Card
        key={assistant.id}
        gradient
        style={cardStyle}
        onPress={() => {}}>
        <View style={[styles.iconContainer, { backgroundColor: `${assistant.color}20` }]}>
          <Ionicons name={assistant.icon} size={36} color={assistant.color} />
        </View>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
          {assistant.title}
        </Text>
        <Text style={[styles.cardDescription, { color: colors.tabIconDefault }]} numberOfLines={3}>
          {assistant.description}
        </Text>
        <TouchableOpacity 
          style={[styles.tryNowButton, { backgroundColor: assistant.color + '20' }]}
          onPress={() => {}}
        >
          <Text style={[styles.tryNowText, { color: assistant.color }]}>Start Chat</Text>
          <Ionicons name="chatbubble-outline" size={16} color={assistant.color} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </Card>
    );
  }, [colorScheme, colors]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={[styles.title, { color: colors.text }]}>OmniHealth</Text>
            {isSignedIn ? (
              <TouchableOpacity 
                onPress={() => router.push('/profile')}
                style={styles.profileButton}
              >
                <Ionicons name="person-circle-outline" size={32} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                onPress={handleSignIn}
                style={styles.signInButton}
              >
                <Text style={[styles.signInText, { color: colors.tint }]}>Sign In</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.subtitle, { color: colors.text }]}>
            AI Health Assistants
          </Text>
          <Text style={[styles.description, { color: colors.tabIconDefault }]}>
            Access our suite of intelligent health assistants powered by advanced AI to help you maintain and improve your wellbeing
          </Text>
        </View>

        {/* AI Health Assistants Section */}
        <View style={styles.section}>
          <View style={styles.assistantsGrid}>
            {AI_ASSISTANTS.map(renderAIAssistant)}
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
    paddingTop: Platform.OS === 'android' ? 20 : 0,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 30,
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
  signInButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  signInText: {
    fontSize: 16,
    fontWeight: '600',
  },
  profileButton: {
    padding: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    lineHeight: 24,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    opacity: 0.8,
  },
  assistantsGrid: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  assistantCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 0,
    height: 240,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.8,
    marginBottom: 16,
    flex: 1,
  },
  tryNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 'auto',
  },
  tryNowText: {
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    marginBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
