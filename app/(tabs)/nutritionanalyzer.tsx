import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, StyleSheet, Platform, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MotiView } from 'moti';
import { useAuth } from '@clerk/clerk-expo';
import { analyzeNutrition, getDailyProgress } from '../../services/nutritionAnalyzer';
import { PieChart, LineChart } from 'react-native-chart-kit';
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';

interface ProgressRingProps {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
}

interface NutrientCardProps {
  title: string;
  current: number;
  target: number;
  unit: string;
  colors: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
}

interface ChartData {
  name: string;
  value: number;
  color: string;
}

interface NutrientTrendData {
  date: number;
  value: number;
}

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
  meal_type: string;
}

interface DailyProgress {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals_logged: number;
}

interface NutritionVisualizationProps {
  result?: NutritionResult | null;
  dailyProgress: DailyProgress;
}

// Color palette with gradients
const COLORS = {
  protein: ['#4F46E5', '#818CF8'] as [string, string],
  carbs: ['#059669', '#34D399'] as [string, string],
  fats: ['#DC2626', '#F87171'] as [string, string],
  calories: ['#DC2626', '#F87171'] as [string, string]
};

const AnimatedProgressRing = ({ progress, size, strokeWidth, color }: ProgressRingProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', duration: 1000 }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1F2937"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </MotiView>
  );
};

const NutrientCard = ({ title, current, target, unit, colors, icon }: NutrientCardProps) => {
  const progress = Math.min((current / target) * 100, 100);
  const isExceeded = current > target;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 500 }}
      style={styles.nutrientCard}
    >
      <LinearGradient
        colors={[colors[0] + '20', colors[1] + '20']}
        style={styles.nutrientCardGradient}
      >
        <View style={styles.nutrientCardHeader}>
          <View style={styles.nutrientCardIcon}>
            <Ionicons name={icon} size={24} color={colors[0]} />
          </View>
          <Text style={styles.nutrientCardTitle}>{title}</Text>
        </View>
        <View style={styles.nutrientCardContent}>
          <View style={styles.nutrientCardValues}>
            <Text style={[styles.nutrientCardCurrent, { color: colors[0] }]}>
              {current.toFixed(1)}
            </Text>
            <Text style={styles.nutrientCardUnit}>{unit}</Text>
            <Text style={styles.nutrientCardTarget}>/ {target}</Text>
          </View>
        </View>

        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <MotiView
              from={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ type: 'timing', duration: 1000 }}
              style={[
                styles.progressBarFill,
                { backgroundColor: colors[0] }
              ]}
            />
          </View>
          {isExceeded && (
            <Text style={styles.exceededText}>Exceeded</Text>
          )}
        </View>
      </LinearGradient>
    </MotiView>
  );
};

const MacroDistributionChart = ({ data }: { data: ChartData[] }) => {
  const screenWidth = Dimensions.get('window').width;
  const chartConfig = {
    backgroundGradientFrom: '#1E2923',
    backgroundGradientTo: '#08130D',
    color: (opacity = 1) => `rgba(26, 255, 146, ${opacity})`,
  };

  // Transform data to match PieChart's expected format
  const chartData = data.map(item => ({
    name: item.name,
    population: item.value,
    color: item.color,
    legendFontColor: '#FFF',
    legendFontSize: 12,
  }));

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Macro Distribution</Text>
      <PieChart
        data={chartData}
        width={screenWidth * 0.8}
        height={screenWidth * 0.8}
        chartConfig={chartConfig}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="15"
        absolute
      />
    </View>
  );
};

const NutrientTrendChart = ({ data, nutrient, color }: { data: NutrientTrendData[], nutrient: string, color: string }) => {
  const screenWidth = Dimensions.get('window').width;
  const chartConfig = {
    backgroundGradientFrom: '#1E2923',
    backgroundGradientTo: '#08130D',
    color: (opacity = 1) => color,
    strokeWidth: 2,
    barPercentage: 0.5,
  };

  const chartData = {
    labels: data.map(d => new Date(d.date).toLocaleDateString()),
    datasets: [{
      data: data.map(d => d.value),
    }],
  };

  return (
    <View style={styles.trendChartContainer}>
      <Text style={styles.chartTitle}>{nutrient} Trend</Text>
      <LineChart
        data={chartData}
        width={screenWidth * 0.9}
        height={220}
        chartConfig={chartConfig}
        bezier
        style={{
          marginVertical: 8,
          borderRadius: 16,
        }}
      />
    </View>
  );
};

const NutritionVisualization = ({ result, dailyProgress }: NutritionVisualizationProps) => {
  // Use result data if available, otherwise use daily progress
  const nutritionData = result ? {
    calories: result.nutritional_content.calories,
    protein: result.nutritional_content.macronutrients.protein.amount,
    carbs: result.nutritional_content.macronutrients.carbs.amount,
    fats: result.nutritional_content.macronutrients.fats.amount,
  } : {
    calories: dailyProgress.calories,
    protein: dailyProgress.protein,
    carbs: dailyProgress.carbs,
    fats: dailyProgress.fat,
  };

  const macroData = [
    { name: 'Protein', value: nutritionData.protein, color: COLORS.protein[0] },
    { name: 'Carbs', value: nutritionData.carbs, color: COLORS.carbs[0] },
    { name: 'Fats', value: nutritionData.fats, color: COLORS.fats[0] },
  ];

  return (
    <View style={styles.visualizationContainer}>
      {/* Daily Progress Overview */}
      <View style={styles.progressOverview}>
        <Text style={styles.sectionTitle}>Daily Progress</Text>
        <View style={styles.progressRings}>
          <View style={styles.progressRingItem}>
            <AnimatedProgressRing
              progress={(nutritionData.calories / 2000) * 100}
              size={80}
              strokeWidth={8}
              color={COLORS.calories[0]}
            />
            <Text style={styles.progressLabel}>Calories</Text>
            <Text style={styles.progressValue}>{nutritionData.calories} kcal</Text>
          </View>
          <View style={styles.progressRingItem}>
            <AnimatedProgressRing
              progress={(nutritionData.protein / 50) * 100}
              size={80}
              strokeWidth={8}
              color={COLORS.protein[0]}
            />
            <Text style={styles.progressLabel}>Protein</Text>
            <Text style={styles.progressValue}>{nutritionData.protein}g</Text>
          </View>
          <View style={styles.progressRingItem}>
            <AnimatedProgressRing
              progress={(nutritionData.carbs / 300) * 100}
              size={80}
              strokeWidth={8}
              color={COLORS.carbs[0]}
            />
            <Text style={styles.progressLabel}>Carbs</Text>
            <Text style={styles.progressValue}>{nutritionData.carbs}g</Text>
          </View>
        </View>
      </View>

      {/* Macro Distribution */}
      <View style={styles.macroDistribution}>
        <Text style={styles.sectionTitle}>Macro Distribution</Text>
        <MacroDistributionChart data={macroData} />
      </View>

      {/* Nutrient Tracking */}
      <View style={styles.nutrientCardsContainer}>
        <Text style={styles.sectionTitle}>Nutrient Tracking</Text>
        <NutrientCard
          title="Protein"
          current={nutritionData.protein}
          target={50}
          unit="g"
          colors={COLORS.protein}
          icon="barbell-outline"
        />
        <NutrientCard
          title="Carbs"
          current={nutritionData.carbs}
          target={300}
          unit="g"
          colors={COLORS.carbs}
          icon="leaf-outline"
        />
        <NutrientCard
          title="Fats"
          current={nutritionData.fats}
          target={65}
          unit="g"
          colors={COLORS.fats}
          icon="water-outline"
        />
      </View>

      {/* Stats Overview */}
      <View style={styles.statsOverview}>
        <Text style={styles.sectionTitle}>Today's Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Ionicons name="restaurant-outline" size={24} color="#4C6EF5" />
            <Text style={styles.statLabel}>Meals Logged</Text>
            <Text style={styles.statValue}>{dailyProgress.meals_logged}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="flame-outline" size={24} color="#4C6EF5" />
            <Text style={styles.statLabel}>Calories Goal</Text>
            <Text style={styles.statValue}>2000 kcal</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default function NutritionAnalyzer() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId } = useAuth();
  const [image, setImage] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<NutritionResult | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [dailyProgress, setDailyProgress] = useState<DailyProgress>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    meals_logged: 0,
  });

  // Fetch daily progress when dashboard is opened
  useEffect(() => {
    if (showDashboard && userId) {
      const fetchDailyProgress = async () => {
        try {
          const progressData = await getDailyProgress(userId);
          // Extract just the progress part of the response
          setDailyProgress({
            calories: progressData.progress.calories || 0,
            protein: progressData.progress.protein || 0,
            carbs: progressData.progress.carbs || 0,
            fat: progressData.progress.fat || 0,
            meals_logged: progressData.progress.meals_logged || 0,
          });
        } catch (error) {
          console.error('Error fetching daily progress:', error);
          // Set default values if there's an error
          setDailyProgress({
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            meals_logged: 0,
          });
        }
      };
      fetchDailyProgress();
    }
  }, [showDashboard, userId]);

  const resetAnalysis = () => {
    setImage(null);
    setTextInput('');
    setResult(null);
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim() || isLoading || !userId) return;

    try {
      setIsLoading(true);
      router.push('/(tabs)/nutritionanalyzer');
      const { analysis } = await analyzeNutrition('text', textInput, userId);
      setResult(analysis);
    } catch (error) {
      console.error('Error analyzing nutrition:', error);
      Alert.alert('Error', 'Failed to analyze nutrition. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageAnalysis = async (imageUri: string) => {
    if (!userId) {
      Alert.alert('Error', 'Please sign in to analyze food.');
      return;
    }

    try {
      setIsLoading(true);
      router.push('/(tabs)/nutritionanalyzer');
      const { analysis } = await analyzeNutrition('image', imageUri, userId);
      setResult(analysis);
    } catch (error) {
      console.error('Error analyzing image:', error);
      Alert.alert('Error', 'Failed to analyze image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
      handleImageAnalysis(result.assets[0].base64);
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
      handleImageAnalysis(result.assets[0].base64);
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
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Nutrition Analyzer</Text>
            <TouchableOpacity
              style={styles.dashboardButton}
              onPress={() => setShowDashboard(!showDashboard)}
            >
              <Ionicons 
                name={showDashboard ? "stats-chart" : "stats-chart-outline"} 
                size={24} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {showDashboard ? (
            <NutritionVisualization result={result} dailyProgress={dailyProgress} />
          ) : (
            <>
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
                      <Ionicons name="camera-outline" size={24} color="#fff" />
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
                      <Ionicons name="images-outline" size={24} color="#fff" />
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
                        name="arrow-forward-outline"
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

              {result && !showDashboard && (
                <MotiView
                  from={{ opacity: 0, translateY: 20 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 300 }}
                  style={styles.resultContainer}
                >
                  <View style={styles.resultHeader}>
                    <View style={styles.resultTitleRow}>
                      <Text style={styles.foodName}>{result.basic_info.food_name}</Text>
                      <TouchableOpacity
                        style={styles.closeButton}
                        onPress={resetAnalysis}
                      >
                        <Ionicons name="close-circle" size={24} color="rgba(255, 255, 255, 0.7)" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.mealType}>
                      <Ionicons name="time-outline" size={16} color="#4C6EF5" /> {result.meal_type}
                    </Text>
                    {result.basic_info.portion_size && (
                      <Text style={styles.portionSize}>
                        <Ionicons name="restaurant-outline" size={16} color="rgba(255, 255, 255, 0.7)" /> {result.basic_info.portion_size}
                      </Text>
                    )}
                  </View>

                  {result.health_analysis && (
                    <View style={styles.healthAnalysis}>
                      <Text style={styles.sectionTitle}>
                        <Ionicons name="medical-outline" size={20} color="#fff" /> Health Analysis
                      </Text>
                      {result.health_analysis.benefits.length > 0 && (
                        <View style={styles.benefitsContainer}>
                          <Text style={styles.benefitsTitle}>
                            <Ionicons name="checkmark-circle-outline" size={18} color="#4C6EF5" /> Benefits
                          </Text>
                          {result.health_analysis.benefits.map((benefit, index) => (
                            <Text key={index} style={styles.benefitItem}>• {benefit}</Text>
                          ))}
                        </View>
                      )}
                      {result.health_analysis.considerations.length > 0 && (
                        <View style={styles.considerationsContainer}>
                          <Text style={styles.considerationsTitle}>
                            <Ionicons name="information-circle-outline" size={18} color="#4C6EF5" /> Considerations
                          </Text>
                          {result.health_analysis.considerations.map((consideration, index) => (
                            <Text key={index} style={styles.considerationItem}>• {consideration}</Text>
                          ))}
                        </View>
                      )}
                      {result.health_analysis.allergens.length > 0 && (
                        <View style={styles.allergensContainer}>
                          <Text style={styles.allergensTitle}>
                            <Ionicons name="alert-circle-outline" size={18} color="#4C6EF5" /> Allergens
                          </Text>
                          {result.health_analysis.allergens.map((allergen, index) => (
                            <Text key={index} style={styles.allergenItem}>• {allergen}</Text>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </MotiView>
              )}
            </>
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
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    paddingBottom: 20,
  },
  inputSection: {
    padding: 20,
    gap: 16,
  },
  imageInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    flex: 1,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  orText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontSize: 14,
  },
  textInputContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  submitButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  imagePreview: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  previewImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  resultContainer: {
    padding: 20,
    gap: 24,
  },
  resultHeader: {
    gap: 8,
  },
  resultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  closeButton: {
    padding: 4,
  },
  foodName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  mealType: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  portionSize: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  nutritionItem: {
    flex: 1,
    minWidth: 150,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  nutritionLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  nutritionValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  nutritionUnit: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  nutrientCardsContainer: {
    gap: 12,
  },
  nutrientCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  nutrientCardGradient: {
    padding: 16,
    gap: 12,
  },
  nutrientCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nutrientCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutrientCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  nutrientCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  nutrientCardValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  nutrientCardCurrent: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  nutrientCardUnit: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  nutrientCardTarget: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  progressBarContainer: {
    marginTop: 12,
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  exceededText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  chartContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  trendChartContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  healthAnalysis: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitsContainer: {
    gap: 8,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitItem: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    paddingLeft: 24,
  },
  considerationsContainer: {
    gap: 8,
  },
  considerationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  considerationItem: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    paddingLeft: 24,
  },
  allergensContainer: {
    gap: 8,
  },
  allergensTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allergenItem: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    paddingLeft: 24,
  },
  visualizationContainer: {
    gap: 24,
  },
  progressOverview: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  progressRings: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  progressRingItem: {
    alignItems: 'center',
    gap: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  progressValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  macroDistribution: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  nutrientTrends: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  dashboardButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsOverview: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  statItem: {
    alignItems: 'center',
    gap: 8,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
