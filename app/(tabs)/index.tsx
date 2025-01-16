import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>AI-Powered Healthcare</Text>
        <Text style={[styles.subtitle, { color: colors.text }]}>
          Transform your health journey with advanced AI predictions
        </Text>
      </View>

      <TouchableOpacity style={styles.getStartedButton}>
        <LinearGradient
          colors={['#4c669f', '#3b5998', '#192f6a']}
          style={styles.gradient}>
          <Text style={styles.getStartedText}>Get Started</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>AI Prediction Tools</Text>
      </View>

      <View style={styles.cardContainer}>
        <TouchableOpacity style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
          <View style={[styles.iconContainer, { backgroundColor: '#ff6b6b20' }]}>
            <Ionicons name="heart-outline" size={32} color="#ff6b6b" />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Heart Health</Text>
          <Text style={[styles.cardDescription, { color: colors.tabIconDefault }]}>
            Predict cardiovascular risks and get personalized recommendations
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
          <View style={[styles.iconContainer, { backgroundColor: '#4dabf720' }]}>
            <Ionicons name="fitness-outline" size={32} color="#4dabf7" />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Fitness Analysis</Text>
          <Text style={[styles.cardDescription, { color: colors.tabIconDefault }]}>
            Get AI-powered insights for your workout routine
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
          <View style={[styles.iconContainer, { backgroundColor: '#51cf6620' }]}>
            <Ionicons name="nutrition-outline" size={32} color="#51cf66" />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Nutrition Guide</Text>
          <Text style={[styles.cardDescription, { color: colors.tabIconDefault }]}>
            Personalized diet recommendations based on your health data
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    lineHeight: 24,
  },
  getStartedButton: {
    marginHorizontal: 20,
    marginBottom: 40,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  getStartedText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  cardContainer: {
    paddingHorizontal: 20,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
});
