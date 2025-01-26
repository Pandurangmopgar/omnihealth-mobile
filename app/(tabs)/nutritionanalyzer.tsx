import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, StyleSheet, Platform, ActivityIndicator, Alert, Dimensions, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MotiView } from 'moti';
import { useAuth } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analyzeNutrition, getDailyProgress, getDailyGoals, generateNutritionReport, getWeeklyData } from '../../services/nutritionAnalyzer';
import { registerForPushNotifications, scheduleNutritionReminders } from '../../services/pushNotifications';
import { PieChart, LineChart } from 'react-native-chart-kit';
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { VictoryPie, VictoryChart, VictoryBar, VictoryAxis, VictoryLabel } from 'victory-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import debounce from 'lodash/debounce';
import { NutritionGoalsModal as GoalsModalComponent } from '../../components/NutritionGoalsModal';
import { NutritionAnalyzerOnboarding } from '../../components/NutritionAnalyzerOnboarding';
import { 
  fetchUserNutritionGoals, 
  updateUserNutritionGoals, 
  NutritionGoals as UserNutritionGoals, 
  NutritionGoalInput as UserGoalInput 
} from '../../services/nutritionGoals';

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
    micronutrients: {
      vitamins: Array<{
        name: string;
        amount: number;
        unit: string;
        daily_value_percentage: number;
      }>;
      minerals: Array<{
        name: string;
        amount: number;
        unit: string;
        daily_value_percentage: number;
      }>;
    };
  };
  health_analysis: {
    benefits: string[];
    considerations: string[];
    allergens: string[];
    processing_level: string;
    health_score: {
      score: number;
      factors: string[];
    };
  };
  recommendations: {
    serving_suggestions: string[];
    healthier_alternatives: string[];
    local_options: string[];
    meal_timing: {
      best_time: string;
      reason: string;
    };
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
  result: NutritionResult | null;
  dailyProgress: DailyProgress;
}

interface NutritionData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface NutritionGoals {
  daily_calories: number;
  daily_protein: number;
  daily_carbs: number;
  daily_fat: number;
}

interface NutritionProgress {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals_logged: number;
}

interface NutritionTip {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  text: string;
}

interface WeeklyData {
  protein: NutrientTrendData[];
  carbs: NutrientTrendData[];
  fats: NutrientTrendData[];
  calories: NutrientTrendData[];
}

interface NutritionGoalInput {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

interface NutritionGoalsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (goals: UserGoalInput) => Promise<void>;
  initialGoals?: UserNutritionGoals;
}

// Color palette with gradients
const COLORS = {
  protein: ['#4F46E5', '#818CF8'] as [string, string],
  carbs: ['#059669', '#34D399'] as [string, string],
  fat: ['#DC2626', '#F87171'] as [string, string],
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
  const chartData = data.map(item => ({
    value: item.value,
    date: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })
  }));

  return (
    <View style={styles.chartContainer}>
      <LineChart
        data={{
          labels: chartData.map(item => item.date),
          datasets: [{
            data: chartData.map(item => item.value),
            color: () => color,
            strokeWidth: 2
          }]
        }}
        width={Dimensions.get('window').width - 32}
        height={220}
        chartConfig={{
          backgroundColor: 'transparent',
          backgroundGradientFrom: 'transparent',
          backgroundGradientTo: 'transparent',
          decimalPlaces: 1,
          color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
          style: {
            borderRadius: 16
          }
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );
};

const MacroCard = ({ title, current, target, unit, icon, colors }: {
  title: string;
  current: number;
  target: number;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: string[];
}) => {
  const percentage = Math.min((current / target) * 100, 100);
  
  return (
    <Animated.View 
      entering={FadeInUp.delay(200)} 
      style={styles.macroCard}
    >
      <BlurView intensity={20} style={styles.cardBlur}>
        <LinearGradient
          colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
          style={styles.cardGradient}
        >
          <View style={styles.cardHeader}>
            <Ionicons name={icon} size={24} color={colors[0]} />
            <Text style={styles.cardTitle}>{title}</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.currentValue}>{current}{unit}</Text>
            <Text style={styles.targetValue}>of {target}{unit}</Text>
          </View>
          <View style={styles.progressBarContainer}>
            <LinearGradient
              colors={colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.progressBar,
                { width: `${percentage}%` }
              ]}
            />
          </View>
        </LinearGradient>
      </BlurView>
    </Animated.View>
  );
};

const MealsLoggedIndicator = ({ mealsLogged }: { mealsLogged: number }) => (
  <View style={styles.mealsLoggedContainer}>
    <Text style={styles.mealsLoggedTitle}>Meals Logged Today</Text>
    <View style={styles.mealsLoggedCircle}>
      <Text style={styles.mealsLoggedNumber}>{mealsLogged}</Text>
    </View>
  </View>
);

const NutritionVisualization = ({ result, dailyProgress }: NutritionVisualizationProps) => {
  const [activeTab, setActiveTab] = useState<'progress' | 'details' | 'trends' | 'report'>('progress');
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [goals, setGoals] = useState<UserNutritionGoals | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyData>({
    protein: [],
    carbs: [],
    fats: [],
    calories: []
  });
  const { userId } = useAuth();

  useEffect(() => {
    if (userId) {
      setupNotifications();
      fetchGoals();
      fetchWeeklyData();
    }
  }, [userId]);

  const setupNotifications = async () => {
    if (!userId) return;
    try {
      const token = await registerForPushNotifications(userId);
      await scheduleNutritionReminders(userId);
    } catch (error) {
      console.error('Error setting up notifications:', error);
    }
  };

  const fetchGoals = async () => {
    if (!userId) return;
    try {
      const userGoals = await getDailyGoals(userId);
      setGoals(userGoals);
    } catch (error) {
      console.error('Error fetching goals:', error);
    }
  };

  const fetchWeeklyData = async () => {
    if (!userId) return;
    try {
      const weeklyStats = await getWeeklyData(userId);
      setWeeklyData(weeklyStats);
    } catch (error) {
      console.error('Error fetching weekly data:', error);
    }
  };

  const generateReport = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const reportText = await generateNutritionReport(userId);
      setReport(reportText);
    } catch (error) {
      console.error('Error generating report:', error);
      Alert.alert('Error', 'Failed to generate nutrition report');
    } finally {
      setLoading(false);
    }
  };

  // Calculate nutrition data
  const nutritionData: NutritionData = result ? {
    calories: result.nutritional_content.calories,
    protein: result.nutritional_content.macronutrients.protein.amount,
    carbs: result.nutritional_content.macronutrients.carbs.amount,
    fat: result.nutritional_content.macronutrients.fats.amount,
  } : {
    calories: dailyProgress.calories,
    protein: dailyProgress.protein,
    carbs: dailyProgress.carbs,
    fat: dailyProgress.fat,
  };

  // Calculate macro percentages
  const macroCalories = {
    protein: nutritionData.protein * 4,
    carbs: nutritionData.carbs * 4,
    fat: nutritionData.fat * 9,
  };

  const totalCalories = Object.values(macroCalories).reduce((acc, curr) => acc + curr, 0);
  const macroPercentages = {
    protein: (macroCalories.protein / totalCalories) * 100 || 0,
    carbs: (macroCalories.carbs / totalCalories) * 100 || 0,
    fat: (macroCalories.fat / totalCalories) * 100 || 0,
  };

  const formatAIResponse = (text: string) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    return lines.map((line, index) => {
      // Main headers (##)
      if (line.startsWith('##')) {
        return (
          <Text key={index} style={styles.aiMainHeader}>
            {line.replace(/##/g, '').trim()}
          </Text>
        );
      }
      
      // Numbered headers (1., 2., etc)
      if (/^\d+\./.test(line)) {
        return (
          <Text key={index} style={styles.aiNumberedHeader}>
            {line.trim()}
          </Text>
        );
      }

      // List items with highlights (*)
      if (line.trim().startsWith('*')) {
        const content = line.trim().substring(1).trim();
        // Extract content between ** **
        const parts = content.split(/\*\*(.*?)\*\*/g).filter(Boolean);
        
        return (
          <View key={index} style={styles.aiListItemContainer}>
            <View style={styles.aiBulletPoint} />
            <View style={styles.aiListContent}>
              <Text style={styles.aiListItem}>
                {parts.map((part, pIndex) => {
                  // Even indices are normal text, odd indices are highlighted
                  if (pIndex % 2 === 0) {
                    return <Text key={pIndex} style={styles.aiNormalText}>{part}</Text>;
                  } else {
                    return (
                      <Text key={pIndex} style={styles.aiHighlightedText}>
                        {part}
                      </Text>
                    );
                  }
                })}
              </Text>
            </View>
          </View>
        );
      }

      // Regular text with potential highlights
      if (line.trim()) {
        const parts = line.trim().split(/\*\*(.*?)\*\*/g).filter(Boolean);
        return (
          <Text key={index} style={styles.aiRegularText}>
            {parts.map((part, pIndex) => {
              if (pIndex % 2 === 0) {
                return <Text key={pIndex}>{part}</Text>;
              } else {
                return (
                  <Text key={pIndex} style={styles.aiHighlightedText}>
                    {part}
                  </Text>
                );
              }
            })}
          </Text>
        );
      }

      return <View key={index} style={styles.aiSpacer} />;
    });
  };

  const renderReportTab = () => (
    <Animated.View
      entering={FadeInDown}
      style={styles.reportContainer}
    >
      {loading ? (
        <ActivityIndicator size="large" color="#4F46E5" />
      ) : report ? (
        <ScrollView style={styles.reportContent}>
          <BlurView intensity={80} style={styles.reportCard}>
            {formatAIResponse(report)}
            <TouchableOpacity
              style={styles.generateButton}
              onPress={generateReport}
            >
              <Text style={styles.generateButtonText}>Generate New Report</Text>
            </TouchableOpacity>
          </BlurView>
        </ScrollView>
      ) : (
        <TouchableOpacity
          style={styles.generateButton}
          onPress={generateReport}
        >
          <Ionicons name="document-text" size={24} color="#FFFFFF" />
          <Text style={styles.generateButtonText}>Generate Nutrition Report</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'progress':
        return (
          <ScrollView style={styles.progressContainer}>
            {/* Overall Progress Card */}
            <Animated.View entering={FadeInDown.delay(100)} style={styles.progressCard}>
              <BlurView intensity={20} style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                  style={styles.cardGradient}
                >
                  <Text style={styles.sectionTitle}>Today's Progress</Text>
                  
                  {/* Calories Progress */}
                  <View style={styles.calorieSection}>
                    <View style={styles.calorieHeader}>
                      <Ionicons name="flame-outline" size={24} color={COLORS.calories[0]} />
                      <Text style={styles.calorieTitle}>Calories</Text>
                      <Text style={[styles.caloriePercentage, { color: COLORS.calories[0] }]}>
                        {goals ? Math.round((nutritionData.calories / goals.daily_calories) * 100) : 0}%
                      </Text>
                    </View>
                    <View style={styles.calorieProgress}>
                      <LinearGradient
                        colors={COLORS.calories}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.progressBar,
                          {
                            width: goals ? 
                              `${Math.min((nutritionData.calories / goals.daily_calories) * 100, 100)}%` : '0%'
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.calorieText}>
                      {nutritionData.calories} / {goals?.daily_calories || 0} kcal
                    </Text>
                  </View>

                  {/* Macronutrients Progress */}
                  <View style={styles.macroSection}>
                    <Text style={styles.macroTitle}>Macronutrients</Text>
                    {Object.entries({
                      protein: { color: COLORS.protein[0], icon: 'barbell-outline' as const },
                      carbs: { color: COLORS.carbs[0], icon: 'leaf-outline' as const },
                      fat: { color: COLORS.fat[0], icon: 'water-outline' as const }
                    }).map(([nutrient, { color, icon }]) => (
                      <View key={nutrient} style={styles.macroItem}>
                        <View style={styles.macroHeader}>
                          <View style={styles.macroIconContainer}>
                            <Ionicons name={icon} size={20} color={color} />
                          </View>
                          <Text style={styles.macroName}>
                            {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}
                          </Text>
                          <Text style={[styles.macroPercentage, { color }]}>
                            {goals ? Math.round((nutritionData[nutrient as keyof NutritionData] / 
                              goals[`daily_${nutrient}` as keyof UserNutritionGoals]) * 100) : 0}%
                          </Text>
                        </View>
                        <View style={styles.macroProgressBar}>
                          <LinearGradient
                            colors={COLORS[nutrient as keyof typeof COLORS]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[
                              styles.progressBar,
                              {
                                width: goals ? 
                                  `${Math.min((nutritionData[nutrient as keyof NutritionData] / 
                                  goals[`daily_${nutrient}` as keyof UserNutritionGoals]) * 100, 100)}%` : '0%'
                              }
                            ]}
                          />
                        </View>
                        <Text style={styles.macroText}>
                          {nutritionData[nutrient as keyof NutritionData]}g / {goals ? goals[`daily_${nutrient}` as keyof UserNutritionGoals] : 0}g
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Meals Logged */}
                  <View style={styles.mealsSection}>
                    <View style={styles.mealHeader}>
                      <Ionicons name="restaurant-outline" size={24} color="#14B8A6" />
                      <Text style={styles.mealTitle}>Meals Logged Today</Text>
                    </View>
                    <Text style={styles.mealCount}>{dailyProgress.meals_logged}</Text>
                  </View>
                </LinearGradient>
              </BlurView>
            </Animated.View>

            {/* Quick Tips */}
            <Animated.View entering={FadeInDown.delay(200)} style={styles.tipsCard}>
              <BlurView intensity={20} style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                  style={styles.cardGradient}
                >
                  <Text style={styles.sectionTitle}>Quick Tips</Text>
                  <View style={styles.tipsList}>
                    {generateNutritionTips(nutritionData, goals, dailyProgress).map((tip, index) => (
                      <View key={index} style={styles.tipItem}>
                        <Ionicons name={tip.icon} size={20} color={tip.color} />
                        <Text style={styles.tipText}>{tip.text}</Text>
                      </View>
                    ))}
                  </View>
                </LinearGradient>
              </BlurView>
            </Animated.View>
          </ScrollView>
        );

      case 'details':
        return (
          <ScrollView style={styles.detailsContainer}>
            {/* Detailed Nutrient Analysis */}
            <Animated.View entering={FadeInDown.delay(100)} style={styles.analysisCard}>
              <BlurView intensity={20} style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                  style={styles.cardGradient}
                >
                  <Text style={styles.sectionTitle}>Comprehensive Analysis</Text>
                  
                  {/* Micronutrients Section */}
                  <View style={styles.micronutrientSection}>
                    <Text style={styles.sectionSubtitle}>Vitamins & Minerals</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.micronutrientScroll}>
                      {result?.nutritional_content.micronutrients.vitamins.map((vitamin: { 
                        name: string;
                        amount: number;
                        unit: string;
                        daily_value_percentage: number;
                      }, index: number) => (
                        <View key={`vitamin-${index}`} style={styles.micronutrientCard}>
                          <View style={styles.micronutrientHeader}>
                            <Ionicons name="flash-outline" size={20} color="#14B8A6" />
                            <Text style={styles.micronutrientName}>{vitamin.name}</Text>
                          </View>
                          <Text style={styles.micronutrientValue}>
                            {vitamin.amount}{vitamin.unit}
                          </Text>
                          <View style={styles.micronutrientProgress}>
                            <View 
                              style={[
                                styles.micronutrientProgressBar,
                                { width: `${Math.min(vitamin.daily_value_percentage, 100)}%` }
                              ]} 
                            />
                          </View>
                          <Text style={styles.micronutrientPercentage}>
                            {Math.round(vitamin.daily_value_percentage)}% DV
                          </Text>
                        </View>
                      ))}
                    </ScrollView>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.micronutrientScroll}>
                      {result?.nutritional_content.micronutrients.minerals.map((mineral: {
                        name: string;
                        amount: number;
                        unit: string;
                        daily_value_percentage: number;
                      }, index: number) => (
                        <View key={`mineral-${index}`} style={styles.micronutrientCard}>
                          <View style={styles.micronutrientHeader}>
                            <Ionicons name="diamond-outline" size={20} color="#6366F1" />
                            <Text style={styles.micronutrientName}>{mineral.name}</Text>
                          </View>
                          <Text style={styles.micronutrientValue}>
                            {mineral.amount}{mineral.unit}
                          </Text>
                          <View style={styles.micronutrientProgress}>
                            <View 
                              style={[
                                styles.micronutrientProgressBar,
                                { width: `${Math.min(mineral.daily_value_percentage, 100)}%` }
                              ]} 
                            />
                          </View>
                          <Text style={styles.micronutrientPercentage}>
                            {Math.round(mineral.daily_value_percentage)}% DV
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Health Insights */}
                  <View style={styles.healthInsightsSection}>
                    <Text style={styles.sectionSubtitle}>Health Insights</Text>
                    <View style={styles.healthScore}>
                      <Text style={styles.healthScoreTitle}>Nutrition Score</Text>
                      <View style={styles.healthScoreCircle}>
                        <Text style={styles.healthScoreValue}>
                          {result?.health_analysis.health_score.score}
                        </Text>
                      </View>
                      <ScrollView style={styles.healthFactors}>
                        {result?.health_analysis.health_score.factors.map((factor: string, index: number) => (
                          <Text key={index} style={styles.healthFactor}>• {factor}</Text>
                        ))}
                      </ScrollView>
                    </View>
                  </View>

                  {/* Meal Timing Analysis */}
                  <View style={styles.mealTimingSection}>
                    <Text style={styles.sectionSubtitle}>Optimal Meal Timing</Text>
                    <View style={styles.mealTimingCard}>
                      <Ionicons name="time-outline" size={24} color="#14B8A6" />
                      <View style={styles.mealTimingContent}>
                        <Text style={styles.mealTimingTime}>
                          {result?.recommendations.meal_timing.best_time}
                        </Text>
                        <Text style={styles.mealTimingReason}>
                          {result?.recommendations.meal_timing.reason}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Macronutrients Section */}
                  <View style={styles.nutrientSection}>
                    <Text style={styles.nutrientSectionTitle}>Macronutrients</Text>
                    <View style={styles.nutrientList}>
                      {Object.entries({
                        protein: { color: COLORS.protein[0], icon: 'fitness-outline' as const },
                        carbs: { color: COLORS.carbs[0], icon: 'leaf-outline' as const },
                        fat: { color: COLORS.fat[0], icon: 'water-outline' as const }
                      }).map(([nutrient, { color, icon }]) => (
                        <View key={nutrient} style={styles.nutrientDetailItem}>
                          <View style={styles.nutrientHeader}>
                            <View style={styles.nutrientIconContainer}>
                              <Ionicons name={icon} size={20} color={color} />
                            </View>
                            <Text style={styles.nutrientName}>
                              {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}
                            </Text>
                            <Text style={[styles.nutrientPercentage, { color }]}>
                              {Math.round((nutritionData[nutrient as keyof typeof nutritionData] / 
                                (goals?.[`daily_${nutrient}` as keyof UserNutritionGoals] || 1)) * 100)}%
                            </Text>
                          </View>
                          <View style={styles.nutrientProgress}>
                            <LinearGradient
                              colors={COLORS[nutrient as keyof typeof COLORS]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={[
                                styles.progressBar,
                                {
                                  width: `${(nutritionData[nutrient as keyof typeof nutritionData] / 
                                    (goals?.[`daily_${nutrient}` as keyof UserNutritionGoals] || 1)) * 100}%`
                                }
                              ]}
                            />
                          </View>
                          <View style={styles.nutrientDetailsCard}>
                            <Text style={styles.nutrientAmount}>
                              {nutritionData[nutrient as keyof typeof nutritionData]}g
                            </Text>
                            <Text style={styles.nutrientGoal}>
                              of {goals?.[`daily_${nutrient}` as keyof UserNutritionGoals]}g goal
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Daily Summary */}
                  <View style={styles.summarySection}>
                    <Text style={styles.nutrientSectionTitle}>Daily Summary</Text>
                    <View style={styles.summaryGrid}>
                      <View style={styles.summaryItem}>
                        <Ionicons name="restaurant" size={24} color="#14B8A6" />
                        <Text style={styles.summaryValue}>{dailyProgress.meals_logged}</Text>
                        <Text style={styles.summaryLabel}>Meals Logged</Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Ionicons name="flame" size={24} color={COLORS.calories[0]} />
                        <Text style={styles.summaryValue}>
                          {Math.round((nutritionData.calories / (goals?.daily_calories || 2000)) * 100)}%
                        </Text>
                        <Text style={styles.summaryLabel}>Calorie Goal</Text>
                      </View>
                    </View>
                  </View>

                  {/* Nutrition Tips */}
                  <View style={styles.tipsSection}>
                    <Text style={styles.nutrientSectionTitle}>Nutrition Tips</Text>
                    <View style={styles.tipsList}>
                      {generateNutritionTips(nutritionData, goals, dailyProgress).map((tip, index) => (
                        <View key={index} style={styles.tipItem}>
                          <Ionicons name={tip.icon} size={20} color={tip.color} />
                          <Text style={styles.tipText}>{tip.text}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </LinearGradient>
              </BlurView>
            </Animated.View>
          </ScrollView>
        );

      case 'trends':
        return (
          <ScrollView style={styles.trendsContainer}>
            <Animated.View entering={FadeInDown.delay(100)} style={styles.trendsCardContainer}>
              <BlurView intensity={20} style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                  style={styles.cardGradient}
                >
                  <Text style={styles.sectionTitle}>Nutrient Trends</Text>
                  <View style={styles.chartContainer}>
                    <LineChart
                      data={{
                        labels: weeklyData.protein.map(item => new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })),
                        datasets: [
                          {
                            data: weeklyData.protein.map(item => item.value),
                            color: () => COLORS.protein[0],
                            strokeWidth: 2
                          },
                          {
                            data: weeklyData.carbs.map(item => item.value),
                            color: () => COLORS.carbs[0],
                            strokeWidth: 2
                          },
                          {
                            data: weeklyData.fats.map(item => item.value),
                            color: () => COLORS.fat[0],
                            strokeWidth: 2
                          }
                        ]
                      }}
                      width={Dimensions.get('window').width - 64}
                      height={220}
                      chartConfig={{
                        backgroundColor: 'transparent',
                        backgroundGradientFrom: 'transparent',
                        backgroundGradientTo: 'transparent',
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                        style: {
                          borderRadius: 16
                        }
                      }}
                      bezier
                      style={styles.chartWrapper}
                    />
                  </View>

                  <View style={styles.trendLegendContainer}>
                    {Object.entries({
                      Protein: COLORS.protein[0],
                      Carbs: COLORS.carbs[0],
                      Fats: COLORS.fat[0]
                    }).map(([nutrient, color]) => (
                      <View key={nutrient} style={styles.legendItemWrapper}>
                        <View style={[styles.legendDot, { backgroundColor: color }]} />
                        <Text style={styles.legendTextStyle}>{nutrient}</Text>
                      </View>
                    ))}
                  </View>
                </LinearGradient>
              </BlurView>
            </Animated.View>

            {/* Calorie Trend */}
            <Animated.View entering={FadeInDown.delay(200)} style={styles.trendsCardContainer}>
              <BlurView intensity={20} style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                  style={styles.cardGradient}
                >
                  <Text style={styles.sectionTitle}>Calorie Intake Trend</Text>
                  <View style={styles.chartContainer}>
                    <LineChart
                      data={{
                        labels: weeklyData.calories.map(item => new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })),
                        datasets: [{
                          data: weeklyData.calories.map(item => item.value),
                          color: () => COLORS.calories[0],
                          strokeWidth: 2
                        }]
                      }}
                      width={Dimensions.get('window').width - 64}
                      height={220}
                      chartConfig={{
                        backgroundColor: 'transparent',
                        backgroundGradientFrom: 'transparent',
                        backgroundGradientTo: 'transparent',
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                        style: {
                          borderRadius: 16
                        }
                      }}
                      bezier
                      style={styles.chartWrapper}
                    />
                  </View>
                </LinearGradient>
              </BlurView>
            </Animated.View>
          </ScrollView>
        );

      case 'report':
        return renderReportTab();
      default:
        return (
          <ScrollView style={styles.progressContainer}>
            {/* Overall Progress Card */}
            <Animated.View entering={FadeInDown.delay(100)} style={styles.progressCard}>
              <BlurView intensity={20} style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                  style={styles.cardGradient}
                >
                  <Text style={styles.sectionTitle}>Today's Progress</Text>
                  
                  {/* Calories Progress */}
                  <View style={styles.calorieSection}>
                    <View style={styles.calorieHeader}>
                      <Ionicons name="flame-outline" size={24} color={COLORS.calories[0]} />
                      <Text style={styles.calorieTitle}>Calories</Text>
                      <Text style={[styles.caloriePercentage, { color: COLORS.calories[0] }]}>
                        {goals ? Math.round((nutritionData.calories / goals.daily_calories) * 100) : 0}%
                      </Text>
                    </View>
                    <View style={styles.calorieProgress}>
                      <LinearGradient
                        colors={COLORS.calories}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.progressBar,
                          {
                            width: goals ? 
                              `${Math.min((nutritionData.calories / goals.daily_calories) * 100, 100)}%` : '0%'
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.calorieText}>
                      {nutritionData.calories} / {goals?.daily_calories || 0} kcal
                    </Text>
                  </View>

                  {/* Macronutrients Progress */}
                  <View style={styles.macroSection}>
                    <Text style={styles.macroTitle}>Macronutrients</Text>
                    {Object.entries({
                      protein: { color: COLORS.protein[0], icon: 'barbell-outline' as const },
                      carbs: { color: COLORS.carbs[0], icon: 'leaf-outline' as const },
                      fat: { color: COLORS.fat[0], icon: 'water-outline' as const }
                    }).map(([nutrient, { color, icon }]) => (
                      <View key={nutrient} style={styles.macroItem}>
                        <View style={styles.macroHeader}>
                          <View style={styles.macroIconContainer}>
                            <Ionicons name={icon} size={20} color={color} />
                          </View>
                          <Text style={styles.macroName}>
                            {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}
                          </Text>
                          <Text style={[styles.macroPercentage, { color }]}>
                            {goals ? Math.round((nutritionData[nutrient as keyof NutritionData] / 
                              goals[`daily_${nutrient}` as keyof UserNutritionGoals]) * 100) : 0}%
                          </Text>
                        </View>
                        <View style={styles.macroProgressBar}>
                          <LinearGradient
                            colors={COLORS[nutrient as keyof typeof COLORS]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[
                              styles.progressBar,
                              {
                                width: goals ? 
                                  `${Math.min((nutritionData[nutrient as keyof NutritionData] / 
                                  goals[`daily_${nutrient}` as keyof UserNutritionGoals]) * 100, 100)}%` : '0%'
                              }
                            ]}
                          />
                        </View>
                        <Text style={styles.macroText}>
                          {nutritionData[nutrient as keyof NutritionData]}g / {goals ? goals[`daily_${nutrient}` as keyof UserNutritionGoals] : 0}g
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Meals Logged */}
                  <View style={styles.mealsSection}>
                    <View style={styles.mealHeader}>
                      <Ionicons name="restaurant-outline" size={24} color="#14B8A6" />
                      <Text style={styles.mealTitle}>Meals Logged Today</Text>
                    </View>
                    <Text style={styles.mealCount}>{dailyProgress.meals_logged}</Text>
                  </View>
                </LinearGradient>
              </BlurView>
            </Animated.View>

            {/* Quick Tips */}
            <Animated.View entering={FadeInDown.delay(200)} style={styles.tipsCard}>
              <BlurView intensity={20} style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                  style={styles.cardGradient}
                >
                  <Text style={styles.sectionTitle}>Quick Tips</Text>
                  <View style={styles.tipsList}>
                    {generateNutritionTips(nutritionData, goals, dailyProgress).map((tip, index) => (
                      <View key={index} style={styles.tipItem}>
                        <Ionicons name={tip.icon} size={20} color={tip.color} />
                        <Text style={styles.tipText}>{tip.text}</Text>
                      </View>
                    ))}
                  </View>
                </LinearGradient>
              </BlurView>
            </Animated.View>
          </ScrollView>
        );
    }
  };

  if (false) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.protein[0]} />
        <Text style={styles.loadingText}>Loading nutrition data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'progress' && styles.activeTab]}
          onPress={() => setActiveTab('progress')}
        >
          <Text style={[styles.tabText, activeTab === 'progress' && styles.activeTabText]}>
            Progress
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'details' && styles.activeTab]}
          onPress={() => setActiveTab('details')}
        >
          <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>
            Details
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'trends' && styles.activeTab]}
          onPress={() => setActiveTab('trends')}
        >
          <Text style={[styles.tabText, activeTab === 'trends' && styles.activeTabText]}>
            Trends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'report' && styles.activeTab]}
          onPress={() => setActiveTab('report')}
        >
          <Text style={[styles.tabText, activeTab === 'report' && styles.activeTabText]}>
            Report
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'progress' && (
        <ScrollView style={styles.progressContainer}>
          {/* Overall Progress Card */}
          <Animated.View entering={FadeInDown.delay(100)} style={styles.progressCard}>
            <BlurView intensity={20} style={styles.cardBlur}>
              <LinearGradient
                colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                style={styles.cardGradient}
              >
                <Text style={styles.sectionTitle}>Today's Progress</Text>
                
                {/* Calories Progress */}
                <View style={styles.calorieSection}>
                  <View style={styles.calorieHeader}>
                    <Ionicons name="flame-outline" size={24} color={COLORS.calories[0]} />
                    <Text style={styles.calorieTitle}>Calories</Text>
                    <Text style={[styles.caloriePercentage, { color: COLORS.calories[0] }]}>
                      {goals ? Math.round((nutritionData.calories / goals.daily_calories) * 100) : 0}%
                    </Text>
                  </View>
                  <View style={styles.calorieProgress}>
                    <LinearGradient
                      colors={COLORS.calories}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.progressBar,
                        {
                          width: goals ? 
                            `${Math.min((nutritionData.calories / goals.daily_calories) * 100, 100)}%` : '0%'
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.calorieText}>
                    {nutritionData.calories} / {goals?.daily_calories || 0} kcal
                  </Text>
                </View>

                {/* Macronutrients Progress */}
                <View style={styles.macroSection}>
                  <Text style={styles.macroTitle}>Macronutrients</Text>
                  {Object.entries({
                    protein: { color: COLORS.protein[0], icon: 'barbell-outline' as const },
                    carbs: { color: COLORS.carbs[0], icon: 'leaf-outline' as const },
                    fat: { color: COLORS.fat[0], icon: 'water-outline' as const }
                  }).map(([nutrient, { color, icon }]) => (
                    <View key={nutrient} style={styles.macroItem}>
                      <View style={styles.macroHeader}>
                        <View style={styles.macroIconContainer}>
                          <Ionicons name={icon} size={20} color={color} />
                        </View>
                        <Text style={styles.macroName}>
                          {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}
                        </Text>
                        <Text style={[styles.macroPercentage, { color }]}>
                          {goals ? Math.round((nutritionData[nutrient as keyof NutritionData] / 
                            goals[`daily_${nutrient}` as keyof UserNutritionGoals]) * 100) : 0}%
                        </Text>
                      </View>
                      <View style={styles.macroProgressBar}>
                        <LinearGradient
                          colors={COLORS[nutrient as keyof typeof COLORS]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[
                            styles.progressBar,
                            {
                              width: goals ? 
                                `${Math.min((nutritionData[nutrient as keyof NutritionData] / 
                                goals[`daily_${nutrient}` as keyof UserNutritionGoals]) * 100, 100)}%` : '0%'
                            }
                          ]}
                        />
                      </View>
                      <Text style={styles.macroText}>
                        {nutritionData[nutrient as keyof NutritionData]}g / {goals ? goals[`daily_${nutrient}` as keyof UserNutritionGoals] : 0}g
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Meals Logged */}
                <View style={styles.mealsSection}>
                  <View style={styles.mealHeader}>
                    <Ionicons name="restaurant-outline" size={24} color="#14B8A6" />
                    <Text style={styles.mealTitle}>Meals Logged Today</Text>
                  </View>
                  <Text style={styles.mealCount}>{dailyProgress.meals_logged}</Text>
                </View>
              </LinearGradient>
            </BlurView>
          </Animated.View>

          {/* Quick Tips */}
          <Animated.View entering={FadeInDown.delay(200)} style={styles.tipsCard}>
            <BlurView intensity={20} style={styles.cardBlur}>
              <LinearGradient
                colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                style={styles.cardGradient}
              >
                <Text style={styles.sectionTitle}>Quick Tips</Text>
                <View style={styles.tipsList}>
                  {generateNutritionTips(nutritionData, goals, dailyProgress).map((tip, index) => (
                    <View key={index} style={styles.tipItem}>
                      <Ionicons name={tip.icon} size={20} color={tip.color} />
                      <Text style={styles.tipText}>{tip.text}</Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>
            </BlurView>
          </Animated.View>
        </ScrollView>
      )}

      {activeTab === 'details' && (
        <ScrollView style={styles.detailsContainer}>
          {/* Detailed Nutrient Analysis */}
          <Animated.View entering={FadeInDown.delay(100)} style={styles.analysisCard}>
            <BlurView intensity={20} style={styles.cardBlur}>
              <LinearGradient
                colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                style={styles.cardGradient}
              >
                <Text style={styles.sectionTitle}>Comprehensive Analysis</Text>
                
                {/* Micronutrients Section */}
                <View style={styles.micronutrientSection}>
                  <Text style={styles.sectionSubtitle}>Vitamins & Minerals</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.micronutrientScroll}>
                    {result?.nutritional_content.micronutrients.vitamins.map((vitamin: { 
                      name: string;
                      amount: number;
                      unit: string;
                      daily_value_percentage: number;
                    }, index: number) => (
                      <View key={`vitamin-${index}`} style={styles.micronutrientCard}>
                        <View style={styles.micronutrientHeader}>
                          <Ionicons name="flash-outline" size={20} color="#14B8A6" />
                          <Text style={styles.micronutrientName}>{vitamin.name}</Text>
                        </View>
                        <Text style={styles.micronutrientValue}>
                          {vitamin.amount}{vitamin.unit}
                        </Text>
                        <View style={styles.micronutrientProgress}>
                          <View 
                            style={[
                              styles.micronutrientProgressBar,
                              { width: `${Math.min(vitamin.daily_value_percentage, 100)}%` }
                            ]} 
                          />
                        </View>
                        <Text style={styles.micronutrientPercentage}>
                          {Math.round(vitamin.daily_value_percentage)}% DV
                        </Text>
                      </View>
                    ))}
                  </ScrollView>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.micronutrientScroll}>
                    {result?.nutritional_content.micronutrients.minerals.map((mineral: {
                      name: string;
                      amount: number;
                      unit: string;
                      daily_value_percentage: number;
                    }, index: number) => (
                      <View key={`mineral-${index}`} style={styles.micronutrientCard}>
                        <View style={styles.micronutrientHeader}>
                          <Ionicons name="diamond-outline" size={20} color="#6366F1" />
                          <Text style={styles.micronutrientName}>{mineral.name}</Text>
                        </View>
                        <Text style={styles.micronutrientValue}>
                          {mineral.amount}{mineral.unit}
                        </Text>
                        <View style={styles.micronutrientProgress}>
                          <View 
                            style={[
                              styles.micronutrientProgressBar,
                              { width: `${Math.min(mineral.daily_value_percentage, 100)}%` }
                            ]} 
                          />
                        </View>
                        <Text style={styles.micronutrientPercentage}>
                          {Math.round(mineral.daily_value_percentage)}% DV
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>

                {/* Health Insights */}
                <View style={styles.healthInsightsSection}>
                  <Text style={styles.sectionSubtitle}>Health Insights</Text>
                  <View style={styles.healthScore}>
                    <Text style={styles.healthScoreTitle}>Nutrition Score</Text>
                    <View style={styles.healthScoreCircle}>
                      <Text style={styles.healthScoreValue}>
                        {result?.health_analysis.health_score.score}
                      </Text>
                    </View>
                    <ScrollView style={styles.healthFactors}>
                      {result?.health_analysis.health_score.factors.map((factor: string, index: number) => (
                        <Text key={index} style={styles.healthFactor}>• {factor}</Text>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                {/* Meal Timing Analysis */}
                <View style={styles.mealTimingSection}>
                  <Text style={styles.sectionSubtitle}>Optimal Meal Timing</Text>
                  <View style={styles.mealTimingCard}>
                    <Ionicons name="time-outline" size={24} color="#14B8A6" />
                    <View style={styles.mealTimingContent}>
                      <Text style={styles.mealTimingTime}>
                        {result?.recommendations.meal_timing.best_time}
                      </Text>
                      <Text style={styles.mealTimingReason}>
                        {result?.recommendations.meal_timing.reason}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Macronutrients Section */}
                <View style={styles.nutrientSection}>
                  <Text style={styles.nutrientSectionTitle}>Macronutrients</Text>
                  <View style={styles.nutrientList}>
                    {Object.entries({
                      protein: { color: COLORS.protein[0], icon: 'fitness-outline' as const },
                      carbs: { color: COLORS.carbs[0], icon: 'leaf-outline' as const },
                      fat: { color: COLORS.fat[0], icon: 'water-outline' as const }
                    }).map(([nutrient, { color, icon }]) => (
                      <View key={nutrient} style={styles.nutrientDetailItem}>
                        <View style={styles.nutrientHeader}>
                          <View style={styles.nutrientIconContainer}>
                            <Ionicons name={icon} size={20} color={color} />
                          </View>
                          <Text style={styles.nutrientName}>
                            {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}
                          </Text>
                          <Text style={[styles.nutrientPercentage, { color }]}>
                            {Math.round((nutritionData[nutrient as keyof typeof nutritionData] / 
                              (goals?.[`daily_${nutrient}` as keyof UserNutritionGoals] || 1)) * 100)}%
                          </Text>
                        </View>
                        <View style={styles.nutrientProgress}>
                          <LinearGradient
                            colors={COLORS[nutrient as keyof typeof COLORS]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[
                              styles.progressBar,
                              {
                                width: `${(nutritionData[nutrient as keyof typeof nutritionData] / 
                                  (goals?.[`daily_${nutrient}` as keyof UserNutritionGoals] || 1)) * 100}%`
                              }
                            ]}
                          />
                        </View>
                        <View style={styles.nutrientDetailsCard}>
                          <Text style={styles.nutrientAmount}>
                            {nutritionData[nutrient as keyof typeof nutritionData]}g
                          </Text>
                          <Text style={styles.nutrientGoal}>
                            of {goals?.[`daily_${nutrient}` as keyof UserNutritionGoals]}g goal
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Daily Summary */}
                <View style={styles.summarySection}>
                  <Text style={styles.nutrientSectionTitle}>Daily Summary</Text>
                  <View style={styles.summaryGrid}>
                    <View style={styles.summaryItem}>
                      <Ionicons name="restaurant" size={24} color="#14B8A6" />
                      <Text style={styles.summaryValue}>{dailyProgress.meals_logged}</Text>
                      <Text style={styles.summaryLabel}>Meals Logged</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Ionicons name="flame" size={24} color={COLORS.calories[0]} />
                      <Text style={styles.summaryValue}>
                        {Math.round((nutritionData.calories / (goals?.daily_calories || 2000)) * 100)}%
                      </Text>
                      <Text style={styles.summaryLabel}>Calorie Goal</Text>
                    </View>
                  </View>
                </View>

                {/* Nutrition Tips */}
                <View style={styles.tipsSection}>
                  <Text style={styles.nutrientSectionTitle}>Nutrition Tips</Text>
                  <View style={styles.tipsList}>
                    {generateNutritionTips(nutritionData, goals, dailyProgress).map((tip, index) => (
                      <View key={index} style={styles.tipItem}>
                        <Ionicons name={tip.icon} size={20} color={tip.color} />
                        <Text style={styles.tipText}>{tip.text}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </LinearGradient>
            </BlurView>
          </Animated.View>
        </ScrollView>
      )}

      {activeTab === 'trends' && (
        <ScrollView style={styles.trendsContainer}>
          <Animated.View entering={FadeInDown.delay(100)} style={styles.trendsCardContainer}>
            <BlurView intensity={20} style={styles.cardBlur}>
              <LinearGradient
                colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                style={styles.cardGradient}
              >
                <Text style={styles.sectionTitle}>Nutrient Trends</Text>
                <View style={styles.chartContainer}>
                  <LineChart
                    data={{
                      labels: weeklyData.protein.map(item => new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })),
                      datasets: [
                        {
                          data: weeklyData.protein.map(item => item.value),
                          color: () => COLORS.protein[0],
                          strokeWidth: 2
                        },
                        {
                          data: weeklyData.carbs.map(item => item.value),
                          color: () => COLORS.carbs[0],
                          strokeWidth: 2
                        },
                        {
                          data: weeklyData.fats.map(item => item.value),
                          color: () => COLORS.fat[0],
                          strokeWidth: 2
                        }
                      ]
                    }}
                    width={Dimensions.get('window').width - 64}
                    height={220}
                    chartConfig={{
                      backgroundColor: 'transparent',
                      backgroundGradientFrom: 'transparent',
                      backgroundGradientTo: 'transparent',
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                      style: {
                        borderRadius: 16
                      }
                    }}
                    bezier
                    style={styles.chartWrapper}
                  />
                </View>

                <View style={styles.trendLegendContainer}>
                  {Object.entries({
                    Protein: COLORS.protein[0],
                    Carbs: COLORS.carbs[0],
                    Fats: COLORS.fat[0]
                  }).map(([nutrient, color]) => (
                    <View key={nutrient} style={styles.legendItemWrapper}>
                      <View style={[styles.legendDot, { backgroundColor: color }]} />
                      <Text style={styles.legendTextStyle}>{nutrient}</Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>
            </BlurView>
          </Animated.View>

          {/* Calorie Trend */}
          <Animated.View entering={FadeInDown.delay(200)} style={styles.trendsCardContainer}>
            <BlurView intensity={20} style={styles.cardBlur}>
              <LinearGradient
                colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                style={styles.cardGradient}
              >
                <Text style={styles.sectionTitle}>Calorie Intake Trend</Text>
                <View style={styles.chartContainer}>
                  <LineChart
                    data={{
                      labels: weeklyData.calories.map(item => new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })),
                      datasets: [{
                        data: weeklyData.calories.map(item => item.value),
                        color: () => COLORS.calories[0],
                        strokeWidth: 2
                      }]
                    }}
                    width={Dimensions.get('window').width - 64}
                    height={220}
                    chartConfig={{
                      backgroundColor: 'transparent',
                      backgroundGradientFrom: 'transparent',
                      backgroundGradientTo: 'transparent',
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                      style: {
                        borderRadius: 16
                      }
                    }}
                    bezier
                    style={styles.chartWrapper}
                  />
                </View>
              </LinearGradient>
            </BlurView>
          </Animated.View>
        </ScrollView>
      )}

      {activeTab === 'report' && renderReportTab()}
    </ScrollView>
  );
};

const NutritionGoalsModal = ({ visible, onClose, onSave, initialGoals }: NutritionGoalsModalProps) => {
  const [goals, setGoals] = useState<UserGoalInput>({
    calories: '2000',
    protein: '100',
    carbs: '225',
    fat: '65',
  });

  useEffect(() => {
    if (initialGoals) {
      setGoals({
        calories: initialGoals.daily_calories.toString(),
        protein: initialGoals.daily_protein.toString(),
        carbs: initialGoals.daily_carbs.toString(),
        fat: initialGoals.daily_fat.toString(),
      });
    }
  }, [initialGoals]);

  const handleSave = () => {
    // Validate inputs
    const values = Object.values(goals);
    for (const value of values) {
      const num = Number(value);
      if (isNaN(num) || num <= 0) {
        Alert.alert('Invalid Input', 'Please enter valid positive numbers for all fields.');
        return;
      }
    }
    onSave(goals);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Your Nutrition Goals</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Daily Calories</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={goals.calories}
              onChangeText={(text) => setGoals(prev => ({ ...prev, calories: text }))}
              placeholder="e.g., 2000"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Protein (g)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={goals.protein}
              onChangeText={(text) => setGoals(prev => ({ ...prev, protein: text }))}
              placeholder="e.g., 100"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Carbs (g)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={goals.carbs}
              onChangeText={(text) => setGoals(prev => ({ ...prev, carbs: text }))}
              placeholder="e.g., 225"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Fat (g)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={goals.fat}
              onChangeText={(text) => setGoals(prev => ({ ...prev, fat: text }))}
              placeholder="e.g., 65"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <LinearGradient
              colors={['#4F46E5', '#818CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveButtonGradient}
            >
              <Text style={styles.saveButtonText}>Save Goals</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  gradient: {
    flex: 1,
  },
  chartContainer: {
    padding: 15,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 20,
  },
  chart: {
    marginTop: 10,
    alignItems: 'center',
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
    flex: 1,
    backgroundColor: 'transparent',
  },
  resultContent: {
    flex: 1,
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
  caloriesCard: {
    height: 150,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  cardBlur: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 20,
  },
  cardGradient: {
    flex: 1,
    padding: 16,
  },
  sectionTitleAlt: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  caloriesContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 8,
  },
  caloriesValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  caloriesUnit: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 4,
  },
  caloriesProgress: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginVertical: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  caloriesTarget: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  macroDistributionAlt: {
    height: 400,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  chartContainerAlt: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  macroCards: {
    marginBottom: 16,
  },
  macroCard: {
    height: 120,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  currentValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  targetValue: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 8,
  },
  progressBarContainerAlt: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
  },
  weeklyProgress: {
    height: 300,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  nutrientDetailsCard: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  nutrientGridLayout: {
    padding: 16,
  },
  nutrientGrid: {
    padding: 16,
  },
  nutrientItem: {
    marginBottom: 16,
  },
  nutrientLabel: {
    color: 'white',
    fontSize: 14,
    marginBottom: 4,
  },
  nutrientValue: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  nutrientProgress: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  nutrientProgressBar: {
    height: '100%',
    backgroundColor: '#14B8A6',
    borderRadius: 2,
  },
  nutrientTarget: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  legendTextContainer: {
    flex: 1,
  },
  legendSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  activeTab: {
    borderBottomColor: '#4F46E5',
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#4F46E5',
  },
  reportContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  reportContent: {
    flex: 1,
  },
  reportCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  reportText: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 24,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  mealsLoggedContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  mealsLoggedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  mealsLoggedCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealsLoggedNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  aiMainHeader: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginVertical: 12,
    textShadowColor: 'rgba(99, 102, 241, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 0.5,
  },
  aiNumberedHeader: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 16,
    textShadowColor: 'rgba(99, 102, 241, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 0.5,
  },
  aiListItemContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 8,
    paddingRight: 16,
  },
  aiBulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6366F1',
    marginTop: 8,
    marginRight: 12,
    marginLeft: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  aiListContent: {
    flex: 1,
  },
  aiListItem: {
    fontSize: 16,
    color: '#F9FAFB',
    marginVertical: 6,
    lineHeight: 24,
    letterSpacing: 0.3,
  },
  aiHighlightedText: {
    color: '#818CF8',
    fontWeight: '600',
    textShadowColor: 'rgba(129, 140, 248, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  aiNormalText: {
    color: '#F9FAFB',
  },
  aiRegularText: {
    fontSize: 16,
    color: '#F9FAFB',
    marginVertical: 6,
    lineHeight: 24,
    letterSpacing: 0.3,
  },
  aiSpacer: {
    height: 12,
  },
  detailsContainer: {
    flex: 1,
  },
  analysisCard: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  nutrientGrid: {
    padding: 16,
  },
  nutrientDetailItem: {
    marginBottom: 20,
  },
  nutrientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  nutrientAmount: {
    fontSize: 14,
    color: '#E0E0E0',
    marginBottom: 8,
  },
  nutrientProgress: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  nutrientProgressBar: {
    height: '100%',
    backgroundColor: '#14B8A6',
    borderRadius: 2,
  },
  nutrientTarget: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  legendTextContainer: {
    flex: 1,
  },
  legendSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  trendsContainer: {
    flex: 1,
  },
  trendsCardContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  trendsContent: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  comingSoonText: {
    fontSize: 16,
    color: '#E0E0E0',
    fontStyle: 'italic',
  },
  nutrientSection: {
    marginBottom: 24,
  },
  nutrientSectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  nutrientList: {
    gap: 16,
  },
  nutrientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  nutrientIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  nutrientPercentage: {
    marginLeft: 'auto',
    fontSize: 16,
    fontWeight: '600',
  },
  nutrientDetailsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  nutrientAmount: {
    color: '#E0E0E0',
    fontSize: 14,
    fontWeight: '600',
  },
  nutrientGoal: {
    color: '#9CA3AF',
    fontSize: 14,
    marginLeft: 4,
  },
  summarySection: {
    marginBottom: 24,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 8,
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginVertical: 8,
  },
  summaryLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  tipsSection: {
    marginBottom: 24,
  },
  tipsList: {
    gap: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  tipText: {
    color: '#E0E0E0',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  progressContainer: {
    flex: 1,
    padding: 16,
  },
  progressCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  calorieSection: {
    marginBottom: 24,
  },
  calorieHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  calorieTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  caloriePercentage: {
    marginLeft: 'auto',
    fontSize: 20,
    fontWeight: '700',
  },
  calorieProgress: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  calorieText: {
    color: '#E0E0E0',
    fontSize: 14,
    textAlign: 'right',
  },
  macroSection: {
    marginBottom: 24,
  },
  macroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  macroItem: {
    marginBottom: 16,
  },
  macroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  macroIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  macroName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  macroPercentage: {
    marginLeft: 'auto',
    fontSize: 16,
    fontWeight: '600',
  },
  macroProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  macroText: {
    color: '#E0E0E0',
    fontSize: 12,
    textAlign: 'right',
  },
  mealsSection: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  mealCount: {
    color: '#14B8A6',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  tipsCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  micronutrientSection: {
    marginTop: 24,
    marginBottom: 24,
  },
  sectionSubtitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  micronutrientScroll: {
    marginBottom: 16,
  },
  micronutrientCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 150,
  },
  micronutrientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  micronutrientName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  micronutrientValue: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  micronutrientProgress: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  micronutrientProgressBar: {
    height: '100%',
    backgroundColor: '#14B8A6',
    borderRadius: 2,
  },
  micronutrientPercentage: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  healthInsightsSection: {
    marginBottom: 24,
  },
  healthScore: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  healthScoreTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  healthScoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#14B8A6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  healthScoreValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  healthFactors: {
    maxHeight: 100,
  },
  healthFactor: {
    color: '#E0E0E0',
    fontSize: 14,
    marginBottom: 4,
  },
  mealTimingSection: {
    marginBottom: 24,
  },
  mealTimingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  mealTimingContent: {
    marginLeft: 12,
    flex: 1,
  },
  mealTimingTime: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  mealTimingReason: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  trendsCardContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  chartWrapper: {
    marginVertical: 8,
    borderRadius: 16,
  },
  trendLegendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  legendItemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendTextStyle: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#fff',
    marginBottom: 8,
    fontSize: 16,
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  saveButton: {
    marginTop: 20,
  },
  saveButtonGradient: {
    borderRadius: 8,
    padding: 14,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  mainContent: {
    flex: 1,
    width: '100%',
  },
});

const generateNutritionTips = (
  nutritionData: NutritionData,
  goals: UserNutritionGoals | null,
  dailyProgress: NutritionProgress
): NutritionTip[] => {
  if (!goals) return [];
  
  const tips: NutritionTip[] = [];
  const proteinPercentage = (nutritionData.protein / goals.daily_protein) * 100;
  const carbsPercentage = (nutritionData.carbs / goals.daily_carbs) * 100;
  const fatPercentage = (nutritionData.fat / goals.daily_fat) * 100;

  if (proteinPercentage < 50) {
    tips.push({
      icon: 'warning' as keyof typeof Ionicons.glyphMap,
      color: '#FFB020',
      text: 'Your protein intake is low. Consider adding lean meats, eggs, or legumes to your meals.'
    });
  }

  if (carbsPercentage > 90) {
    tips.push({
      icon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
      color: '#14B8A6',
      text: 'Great job meeting your carb goals! Focus on complex carbs for sustained energy.'
    });
  }

  if (fatPercentage > 100) {
    tips.push({
      icon: 'information-circle' as keyof typeof Ionicons.glyphMap,
      color: '#6366F1',
      text: 'You\'ve exceeded your fat goal. Try to include more healthy fats like avocados and nuts.'
    });
  }

  if (dailyProgress.meals_logged < 3) {
    tips.push({
      icon: 'time' as keyof typeof Ionicons.glyphMap,
      color: '#F59E0B',
      text: 'Regular meals help maintain energy levels. Try to log at least 3 meals per day.'
    });
  }

  return tips;
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dailyProgress, setDailyProgress] = useState<NutritionProgress>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    meals_logged: 0,
  });
  const [weeklyData, setWeeklyData] = useState<WeeklyData>({
    protein: [],
    carbs: [],
    fats: [],
    calories: []
  });
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [currentGoals, setCurrentGoals] = useState<UserNutritionGoals | null>(null);

  // Check if onboarding should be shown
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const hasSeenOnboarding = await AsyncStorage.getItem('nutrition_analyzer_onboarding_seen');
        if (!hasSeenOnboarding) {
          setShowOnboarding(true);
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      }
    };
    checkOnboardingStatus();
  }, []);

  const handleOnboardingClose = async () => {
    try {
      await AsyncStorage.setItem('nutrition_analyzer_onboarding_seen', 'true');
      setShowOnboarding(false);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  const handleSaveGoals = async (goals: UserGoalInput) => {
    if (!userId) return; // Ensure userId is a string
    try {
      await updateUserNutritionGoals(userId, goals);
      await loadUserGoals(); // Reload goals after saving
      Alert.alert('Success', 'Your nutrition goals have been updated!');
      setShowGoalsModal(false);
    } catch (error) {
      console.error('Error saving nutrition goals:', error);
      Alert.alert('Error', 'Failed to save nutrition goals. Please try again.');
    }
  };

  const loadUserGoals = async () => {
    if (!userId) return; // Ensure userId is a string
    try {
      const goals = await fetchUserNutritionGoals(userId);
      if (goals) {
        setCurrentGoals(goals);
      }
    } catch (error) {
      console.error('Error loading nutrition goals:', error);
    }
  };

  const resetAnalysis = () => {
    setImage(null);
    setTextInput('');
    setResult(null);
  };

  const debouncedAnalyzeText = useCallback(
    debounce(async (text: string) => {
      if (!text.trim() || isLoading || typeof userId !== 'string') return;
      
      try {
        setIsLoading(true);
        router.push('/(tabs)/nutritionanalyzer');
        const { analysis } = await analyzeNutrition('text', text, userId);
        setResult(analysis);
        setShowDashboard(true);
      } catch (error) {
        console.error('Error analyzing text:', error);
        Alert.alert('Error', 'Failed to analyze text. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }, 500),
    [userId, isLoading]
  );

  const handleTextChange = (text: string) => {
    setTextInput(text);
    if (text.trim()) {
      debouncedAnalyzeText(text);
    }
  };

  useEffect(() => {
    return () => {
      debouncedAnalyzeText.cancel();
    };
  }, [debouncedAnalyzeText]);

  const handleImageAnalysis = async (imageUri: string) => {
    if (!imageUri || isLoading || typeof userId !== 'string') return;

    try {
      setIsLoading(true);
      const { analysis } = await analyzeNutrition('image', imageUri, userId);
      setResult(analysis);
      setShowDashboard(true);
    } catch (error) {
      console.error('Error analyzing image:', error);
      Alert.alert('Error', 'Failed to analyze image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera roll permissions to analyze food images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        setImage(result.assets[0].uri);
        await handleImageAnalysis(result.assets[0].base64!);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
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
      
      <NutritionAnalyzerOnboarding
        visible={showOnboarding}
        onClose={handleOnboardingClose}
      />

      <LinearGradient
        colors={['#0B1120', '#1A237E']}
        style={[styles.gradient, { paddingTop: insets.top }]}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Nutrition Analyzer</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setShowGoalsModal(true)}
              >
                <Ionicons name="settings-outline" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
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
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {showDashboard ? (
            <NutritionVisualization result={result} dailyProgress={dailyProgress} />
          ) : (
            <View style={styles.mainContent}>
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
                    onChangeText={handleTextChange}
                    multiline
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={[styles.submitButton, !textInput.trim() && styles.submitButtonDisabled]}
                    onPress={() => debouncedAnalyzeText(textInput)}
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
              </View>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
      <GoalsModalComponent
        visible={showGoalsModal}
        onClose={() => setShowGoalsModal(false)}
        onSave={handleSaveGoals}
        initialGoals={currentGoals || undefined} // Handle null by providing undefined
      />
    </View>
  );
}