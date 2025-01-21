import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MotiView } from 'moti';
import { useAuth } from '@clerk/clerk-expo';
import { analyzeNutrition } from '../../services/nutritionAnalyzer';

interface NutritionResult {
  analysis_type: 'text' | 'image';
  basic_info: {
    food_name: string;
    portion_size: string;
    preparation_method: string;
    total_servings: number;
  };
  nutritional_content: {
    calories: number;
    macronutrients: {
      protein: { amount: number; unit: string; daily_value_percentage: number };
      carbs: { amount: number; unit: string; daily_value_percentage: number };
      fats: { amount: number; unit: string; daily_value_percentage: number };
    };
  };
  health_analysis: {
    benefits: string[];
    considerations: string[];
    allergens: string[];
    processing_level: string;
  };
  recommendations: {
    serving_suggestions: string[];
    healthier_alternatives: string[];
    local_options: string[];
  };
  source_reliability: 'verified' | 'estimated';
  meal_type?: string;
}

export default function NutritionAnalyzer() {
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [image, setImage] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<NutritionResult | null>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to analyze food images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImage(result.assets[0].uri);
      setTextInput('');
      analyzeFood('image', result.assets[0].base64);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera permissions to take food photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImage(result.assets[0].uri);
      setTextInput('');
      analyzeFood('image', result.assets[0].base64);
    }
  };

  const analyzeFood = async (type: 'text' | 'image', content: string) => {
    if (!userId) {
      Alert.alert('Error', 'Please sign in to analyze food.');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const analysis = await analyzeNutrition(type, content, userId);
      setResult(analysis);
    } catch (error) {
      console.error('Error analyzing food:', error);
      Alert.alert(
        'Analysis Failed',
        'Failed to analyze the food. Please try again or use a different image/description.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      setImage(null);
      analyzeFood('text', textInput);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#0B1120', '#1A237E']}
        style={[styles.gradient, { paddingTop: insets.top }]}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Nutrition Analyzer</Text>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.inputSection}>
            <View style={styles.imageInputs}>
              <TouchableOpacity
                style={styles.imageButton}
                onPress={takePhoto}
              >
                <LinearGradient
                  colors={['#4C6EF5', '#3D5AFE']}
                  style={styles.buttonGradient}
                >
                  <Ionicons name="camera" size={24} color="#fff" />
                  <Text style={styles.buttonText}>Take Photo</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.imageButton}
                onPress={pickImage}
              >
                <LinearGradient
                  colors={['#4C6EF5', '#3D5AFE']}
                  style={styles.buttonGradient}
                >
                  <Ionicons name="images" size={24} color="#fff" />
                  <Text style={styles.buttonText}>Pick Image</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <Text style={styles.orText}>OR</Text>

            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Describe your food..."
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={textInput}
                onChangeText={setTextInput}
                multiline
                returnKeyType="done"
                onSubmitEditing={handleTextSubmit}
              />
              <TouchableOpacity
                style={[styles.submitButton, !textInput.trim() && styles.submitButtonDisabled]}
                onPress={handleTextSubmit}
                disabled={!textInput.trim() || isLoading}
              >
                <LinearGradient
                  colors={textInput.trim() ? ['#4C6EF5', '#3D5AFE'] : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.1)']}
                  style={styles.submitButtonGradient}
                >
                  <Ionicons
                    name="arrow-forward"
                    size={24}
                    color={textInput.trim() ? '#fff' : '#6B7280'}
                  />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {image && (
            <MotiView
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 300 }}
              style={styles.imagePreview}
            >
              <Image source={{ uri: image }} style={styles.previewImage} />
            </MotiView>
          )}

          {isLoading && (
            <MotiView
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 300 }}
              style={styles.loadingContainer}
            >
              <ActivityIndicator size="large" color="#4C6EF5" />
              <Text style={styles.loadingText}>Analyzing nutrition...</Text>
            </MotiView>
          )}

          {result && (
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300 }}
              style={styles.resultContainer}
            >
              <Text style={styles.foodName}>{result.basic_info.food_name}</Text>
              
              <View style={styles.nutritionGrid}>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionLabel}>Calories</Text>
                  <Text style={styles.nutritionValue}>{result.nutritional_content.calories}</Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionLabel}>Protein</Text>
                  <Text style={styles.nutritionValue}>{result.nutritional_content.macronutrients.protein.amount}g</Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionLabel}>Carbs</Text>
                  <Text style={styles.nutritionValue}>{result.nutritional_content.macronutrients.carbs.amount}g</Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionLabel}>Fats</Text>
                  <Text style={styles.nutritionValue}>{result.nutritional_content.macronutrients.fats.amount}g</Text>
                </View>
              </View>

              <Text style={styles.analysis}>{result.health_analysis.benefits.join(', ')}</Text>
            </MotiView>
          )}
        </ScrollView>
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  inputSection: {
    marginBottom: 20,
  },
  imageInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  imageButton: {
    flex: 1,
    marginHorizontal: 5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  orText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginVertical: 16,
    fontSize: 16,
  },
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 8,
    minHeight: 40,
  },
  submitButton: {
    marginLeft: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonGradient: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreview: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  resultContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 20,
  },
  foodName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  nutritionItem: {
    width: '50%',
    padding: 8,
  },
  nutritionLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 4,
  },
  nutritionValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  analysis: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    lineHeight: 24,
  },
});
