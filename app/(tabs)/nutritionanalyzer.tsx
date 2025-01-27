import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, StyleSheet, Platform, ActivityIndicator, Alert, Dimensions, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MotiView } from 'moti';
import { useAuth } from '@clerk/clerk-expo';
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
      vitamins: {
        name: string;
        amount: number;
        unit: string;
        daily_value_percentage: number;
      }[];
      minerals: {
        name: string;
        amount: number;
        unit: string;
        daily_value_percentage: number;
      }[];
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
            <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={colors[0]} />
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
            <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={colors[0]} />
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
                      protein: { color: COLORS.protein[0], icon: 'barbell' as const },
                      carbs: { color: COLORS.carbs[0], icon: 'leaf' as const },
                      fat: { color: COLORS.fat[0], icon: 'water' as const }
                    }).map(([nutrient, { color, icon }]) => (
                      <View key={nutrient} style={styles.macroItem}>
                        <View style={styles.macroHeader}>
                          <View style={styles.macroIconContainer}>
                            <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={color} />
                          </View>
                          <Text style={styles.macroName}>
                            {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}
                          </Text>
                          <Text style={[styles.macroPercentage, { color }]}>
                            {goals ? Math.round((nutritionData[nutrient as keyof NutritionData] / 
                              goals[`daily_${nutrient}` as keyof NutritionGoals]) * 100) : 0}%
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
                                  goals[`daily_${nutrient}` as keyof NutritionGoals]) * 100, 100)}%` : '0%'
                              }
                            ]}
                          />
                        </View>
                        <Text style={styles.macroText}>
                          {Math.round(nutritionData[nutrient as keyof NutritionData])}g / {goals ? goals[`daily_${nutrient}` as keyof NutritionGoals] : 0}g
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
                        <Ionicons name={tip.icon as keyof typeof Ionicons.glyphMap} size={20} color={tip.color} />
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
            {/* Health Score Section */}
            {result?.health_analysis?.health_score && (
              <HealthScoreCard 
                score={result.health_analysis.health_score.score}
                factors={result.health_analysis.health_score.factors}
              />
            )}

            {/* Macronutrients Section */}
            {result?.nutritional_content?.macronutrients && (
              <View style={styles.macronutrientsSection}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name={'cellular-outline' as keyof typeof Ionicons.glyphMap} size={20} color="#4C6EF5" /> Macronutrients
                </Text>
                {Object.entries({
                  protein: { 
                    data: result.nutritional_content.macronutrients.protein,
                    color: COLORS.protein[0], 
                    icon: 'fitness-outline' 
                  },
                  carbs: { 
                    data: result.nutritional_content.macronutrients.carbs,
                    color: COLORS.carbs[0], 
                    icon: 'leaf-outline' 
                  },
                  fat: { 
                    data: result.nutritional_content.macronutrients.fats,
                    color: COLORS.fat[0], 
                    icon: 'water-outline' 
                  }
                }).map(([nutrient, { data, color, icon }]) => (
                  <View key={nutrient} style={styles.macronutrientItem}>
                    <View style={styles.macronutrientHeader}>
                      <View style={styles.macronutrientIcon}>
                        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={color} />
                      </View>
                      <Text style={styles.macronutrientName}>
                        {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}
                      </Text>
                      <Text style={[styles.macronutrientPercentage, { color }]}>
                        {data.daily_value_percentage}%
                      </Text>
                    </View>
                    <View style={styles.macronutrientProgressBar}>
                      <LinearGradient
                        colors={COLORS[nutrient === 'fats' ? 'fat' : nutrient as keyof typeof COLORS]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.progressBar,
                          {
                            width: `${Math.min(data.daily_value_percentage, 100)}%`
                          }
                        ]}
                      />
                    </View>
                    <View style={styles.macronutrientDetails}>
                      <Text style={styles.macronutrientAmount}>
                        {Math.round(data.amount)}g
                      </Text>
                      <Text style={styles.macronutrientGoal}>
                        of daily recommended value
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            
            {/* Vitamins Section */}
            {result?.nutritional_content?.micronutrients?.vitamins && 
             result.nutritional_content.micronutrients.vitamins.length > 0 && (
              <View style={styles.micronutrientsSection}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name={'flash-outline' as keyof typeof Ionicons.glyphMap} size={20} color="#4C6EF5" /> Vitamins
                </Text>
                {result.nutritional_content.micronutrients.vitamins.map((vitamin, index) => (
                  <MicronutrientCard
                    key={index}
                    name={vitamin.name}
                    amount={vitamin.amount}
                    unit={vitamin.unit}
                    percentage={vitamin.daily_value_percentage}
                    type="vitamin"
                  />
                ))}
              </View>
            )}
            
            {/* Minerals Section */}
            {result?.nutritional_content?.micronutrients?.minerals && 
             result.nutritional_content.micronutrients.minerals.length > 0 && (
              <View style={styles.micronutrientsSection}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name={'fitness-outline' as keyof typeof Ionicons.glyphMap} size={20} color="#14B8A6" /> Minerals
                </Text>
                {result.nutritional_content.micronutrients.minerals.map((mineral, index) => (
                  <MicronutrientCard
                    key={index}
                    name={mineral.name}
                    amount={mineral.amount}
                    unit={mineral.unit}
                    percentage={mineral.daily_value_percentage}
                    type="mineral"
                  />
                ))}
              </View>
            )}

            {/* Meal Timing Section */}
            {result && result.recommendations?.meal_timing && (
              <View style={styles.mealTimingSection}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name={'time-outline' as keyof typeof Ionicons.glyphMap} size={20} color="#4C6EF5" /> Meal Timing
                </Text>
                <View style={styles.mealTimingCard}>
                  <Ionicons name={'time-outline' as keyof typeof Ionicons.glyphMap} size={24} color="#4C6EF5" />
                  <View style={styles.mealTimingContent}>
                    <Text style={styles.mealTimingTime}>
                      {result.recommendations.meal_timing.best_time}
                    </Text>
                    <Text style={styles.mealTimingReason}>
                      {result.recommendations.meal_timing.reason}
                    </Text>
                  </View>
                </View>
              </View>
            )}
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
                      protein: { color: COLORS.protein[0], icon: 'barbell' as const },
                      carbs: { color: COLORS.carbs[0], icon: 'leaf' as const },
                      fat: { color: COLORS.fat[0], icon: 'water' as const }
                    }).map(([nutrient, { color, icon }]) => (
                      <View key={nutrient} style={styles.macroItem}>
                        <View style={styles.macroHeader}>
                          <View style={styles.macroIconContainer}>
                            <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={color} />
                          </View>
                          <Text style={styles.macroName}>
                            {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}
                          </Text>
                          <Text style={[styles.macroPercentage, { color }]}>
                            {goals ? Math.round((nutritionData[nutrient as keyof NutritionData] / 
                              goals[`daily_${nutrient}` as keyof NutritionGoals]) * 100) : 0}%
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
                                  goals[`daily_${nutrient}` as keyof NutritionGoals]) * 100, 100)}%` : '0%'
                              }
                            ]}
                          />
                        </View>
                        <Text style={styles.macroText}>
                          {Math.round(nutritionData[nutrient as keyof NutritionData])}g / {goals ? goals[`daily_${nutrient}` as keyof NutritionGoals] : 0}g
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
                        <Ionicons name={tip.icon as keyof typeof Ionicons.glyphMap} size={20} color={tip.color} />
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
                    protein: { color: COLORS.protein[0], icon: 'barbell' as const },
                    carbs: { color: COLORS.carbs[0], icon: 'leaf' as const },
                    fat: { color: COLORS.fat[0], icon: 'water' as const }
                  }).map(([nutrient, { color, icon }]) => (
                    <View key={nutrient} style={styles.macroItem}>
                      <View style={styles.macroHeader}>
                        <View style={styles.macroIconContainer}>
                          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={color} />
                        </View>
                        <Text style={styles.macroName}>
                          {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}
                        </Text>
                        <Text style={[styles.macroPercentage, { color }]}>
                          {goals ? Math.round((nutritionData[nutrient as keyof NutritionData] / 
                            goals[`daily_${nutrient}` as keyof NutritionGoals]) * 100) : 0}%
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
                                goals[`daily_${nutrient}` as keyof NutritionGoals]) * 100, 100)}%` : '0%'
                            }
                          ]}
                        />
                      </View>
                      <Text style={styles.macroText}>
                        {Math.round(nutritionData[nutrient as keyof NutritionData])}g / {goals ? goals[`daily_${nutrient}` as keyof NutritionGoals] : 0}g
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
                      <Ionicons name={tip.icon as keyof typeof Ionicons.glyphMap} size={20} color={tip.color} />
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
          {/* Health Score Section */}
          {result?.health_analysis?.health_score && (
            <HealthScoreCard 
              score={result.health_analysis.health_score.score}
              factors={result.health_analysis.health_score.factors}
            />
          )}

                {/* Macronutrients Section */}
          <View style={styles.macronutrientsSection}>
            <Text style={styles.sectionTitle}>
              <Ionicons name={'cellular-outline' as keyof typeof Ionicons.glyphMap} size={20} color="#4C6EF5" /> Macronutrients
            </Text>
                    {Object.entries({
              protein: { 
                data: result?.nutritional_content?.macronutrients?.protein,
                color: COLORS.protein[0], 
                icon: 'fitness-outline' 
              },
              carbs: { 
                data: result?.nutritional_content?.macronutrients?.carbs,
                color: COLORS.carbs[0], 
                icon: 'leaf-outline' 
              },
              fat: { 
                data: result?.nutritional_content?.macronutrients?.fats,
                color: COLORS.fat[0], 
                icon: 'water-outline' 
              }
                    }).map(([nutrient, { data, color, icon }]) => (
              <View key={nutrient} style={styles.macronutrientItem}>
                <View style={styles.macronutrientHeader}>
                  <View style={styles.macronutrientIcon}>
                    <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={color} />
                          </View>
                  <Text style={styles.macronutrientName}>
                            {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}
                          </Text>
                  <Text style={[styles.macronutrientPercentage, { color }]}>
                    {data?.daily_value_percentage}%
                          </Text>
                        </View>
                <View style={styles.macronutrientProgressBar}>
                          <LinearGradient
                            colors={COLORS[nutrient === 'fats' ? 'fat' : nutrient as keyof typeof COLORS]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[
                              styles.progressBar,
                              {
                        width: `${Math.min(data.daily_value_percentage, 100)}%`
                              }
                            ]}
                          />
                        </View>
                <View style={styles.macronutrientDetails}>
                  <Text style={styles.macronutrientAmount}>
                    {Math.round(data.amount)}g
                          </Text>
                  <Text style={styles.macronutrientGoal}>
                            of daily recommended value
                          </Text>
                        </View>
                      </View>
                    ))}
                </View>

          {/* Vitamins Section */}
          {result?.nutritional_content?.micronutrients?.vitamins && 
           result?.nutritional_content.micronutrients.vitamins.length > 0 && (
            <View style={styles.micronutrientsSection}>
              <Text style={styles.sectionTitle}>
                <Ionicons name={'flash-outline' as keyof typeof Ionicons.glyphMap} size={20} color="#4C6EF5" /> Vitamins
              </Text>
              {result?.nutritional_content.micronutrients.vitamins.map((vitamin, index) => (
                <MicronutrientCard
                  key={index}
                  name={vitamin.name}
                  amount={vitamin.amount}
                  unit={vitamin.unit}
                  percentage={vitamin.daily_value_percentage}
                  type="vitamin"
                />
              ))}
                    </View>
          )}
          
          {/* Minerals Section */}
          {result?.nutritional_content?.micronutrients?.minerals && 
           result?.nutritional_content.micronutrients.minerals.length > 0 && (
            <View style={styles.micronutrientsSection}>
              <Text style={styles.sectionTitle}>
                <Ionicons name={'fitness-outline' as keyof typeof Ionicons.glyphMap} size={20} color="#14B8A6" /> Minerals
                      </Text>
              {result?.nutritional_content.micronutrients.minerals.map((mineral, index) => (
                <MicronutrientCard
                  key={index}
                  name={mineral.name}
                  amount={mineral.amount}
                  unit={mineral.unit}
                  percentage={mineral.daily_value_percentage}
                  type="mineral"
                />
              ))}
                    </View>
          )}
          
          {/* Meal Timing Section */}
          {result && result.recommendations?.meal_timing && (
            <View style={styles.mealTimingSection}>
              <Text style={styles.sectionTitle}>
                <Ionicons name={'time-outline' as keyof typeof Ionicons.glyphMap} size={20} color="#4C6EF5" /> Meal Timing
              </Text>
              <View style={styles.mealTimingCard}>
                <Ionicons name={'time-outline' as keyof typeof Ionicons.glyphMap} size={24} color="#4C6EF5" />
                <View style={styles.mealTimingContent}>
                  <Text style={styles.mealTimingTime}>
                    {result.recommendations.meal_timing.best_time}
                  </Text>
                  <Text style={styles.mealTimingReason}>
                    {result.recommendations.meal_timing.reason}
                  </Text>
                      </View>
                  </View>
                </View>
          )}
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

const MicronutrientCard = ({ name, amount, unit, percentage, type }: {
  name: string;
  amount: number;
  unit: string;
  percentage: number;
  type: 'vitamin' | 'mineral';
}) => {
  const color = type === 'vitamin' ? '#4C6EF5' : '#14B8A6';
  
  return (
    <Animated.View entering={FadeInUp.delay(200)} style={styles.micronutrientCard}>
      <BlurView intensity={20} style={styles.cardBlur}>
        <LinearGradient
          colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
          style={styles.micronutrientGradient}
        >
          <View style={styles.micronutrientHeader}>
            <Ionicons 
              name={type === 'vitamin' ? 'flash-outline' : 'fitness-outline' as keyof typeof Ionicons.glyphMap} 
              size={20} 
              color={color} 
            />
            <Text style={styles.micronutrientName}>{name}</Text>
          </View>
          <View style={styles.micronutrientContent}>
            <Text style={styles.micronutrientAmount}>{amount}{unit}</Text>
            <View style={styles.micronutrientProgressBar}>
              <LinearGradient
                colors={[color, color + '80']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressBar,
                  { width: `${Math.min(percentage, 100)}%` }
                ]}
              />
            </View>
            <Text style={styles.micronutrientPercentage}>{percentage}% DV</Text>
          </View>
        </LinearGradient>
      </BlurView>
    </Animated.View>
  );
};

const HealthScoreCard = ({ score, factors }: { score: number; factors: string[] }) => {
  const color = score >= 7 ? '#10B981' : score >= 4 ? '#F59E0B' : '#EF4444';
  
  return (
    <Animated.View entering={FadeInUp.delay(200)} style={styles.healthScoreCard}>
      <BlurView intensity={20} style={styles.cardBlur}>
        <LinearGradient
          colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
          style={styles.healthScoreGradient}
        >
          <View style={styles.healthScoreHeader}>
            <Ionicons name={'heart-outline' as keyof typeof Ionicons.glyphMap} size={24} color={color} />
            <Text style={styles.healthScoreTitle}>Nutrition Score</Text>
          </View>
          <View style={styles.healthScoreContent}>
            <View style={[styles.scoreCircle, { borderColor: color }]}>
              <Text style={[styles.scoreText, { color }]}>{score.toFixed(1)}</Text>
              <Text style={styles.scoreMax}>/10</Text>
            </View>
            <View style={styles.factorsList}>
              {factors.map((factor, index) => (
                <View key={index} style={styles.factorItem}>
                  <Ionicons name={'checkmark-circle-outline' as keyof typeof Ionicons.glyphMap} size={16} color={color} />
                  <Text style={styles.factorText}>{factor}</Text>
                </View>
              ))}
            </View>
          </View>
        </LinearGradient>
      </BlurView>
    </Animated.View>
  );
};

const NutritionGoalsModal = ({ visible, onClose, onSave, initialGoals }: NutritionGoalsModalProps) => {
  const [goalInput, setGoalInput] = useState<NutritionGoalInput>({
    calories: initialGoals?.daily_calories?.toString() || '2000',
    protein: initialGoals?.daily_protein?.toString() || '100',
    carbs: initialGoals?.daily_carbs?.toString() || '225',
    fat: initialGoals?.daily_fat?.toString() || '65',
  });

  const handleSave = () => {
    // Validate inputs
    const values = Object.values(goalInput);
    for (const value of values) {
      const num = Number(value);
      if (isNaN(num) || num <= 0) {
        Alert.alert('Invalid Input', 'Please enter valid positive numbers for all fields.');
        return;
      }
    }
    onSave(goalInput);
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
              value={goalInput.calories}
              onChangeText={(text) => setGoalInput(prev => ({ ...prev, calories: text }))}
              placeholder="e.g., 2000"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Protein (g)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={goalInput.protein}
              onChangeText={(text) => setGoalInput(prev => ({ ...prev, protein: text }))}
              placeholder="e.g., 100"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Carbs (g)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={goalInput.carbs}
              onChangeText={(text) => setGoalInput(prev => ({ ...prev, carbs: text }))}
              placeholder="e.g., 225"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Fat (g)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={goalInput.fat}
              onChangeText={(text) => setGoalInput(prev => ({ ...prev, fat: text }))}
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
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 8,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginVertical: 8,
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 14,
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
    color: '#9CA3AF',
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
    color: '#9CA3AF',
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
    marginTop: 16,
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
    color: '#4C6EF5',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
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
  chart: {
    // Define your chart style here
    marginVertical: 8,
    borderRadius: 16,
  },
  micronutrientCard: {
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  micronutrientGradient: {
    padding: 16,
    borderRadius: 16,
  },
  micronutrientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  micronutrientName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  micronutrientContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  micronutrientAmount: {
    color: '#fff',
    fontSize: 14,
    width: 80,
  },
  micronutrientProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  micronutrientPercentage: {
    color: '#fff',
    fontSize: 14,
    width: 60,
    textAlign: 'right',
  },
  healthScoreCard: {
    marginVertical: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  healthScoreGradient: {
    padding: 20,
    borderRadius: 16,
  },
  healthScoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  healthScoreTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  healthScoreContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scoreMax: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  factorsList: {
    flex: 1,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  factorText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  micronutrientsSection: {
    marginTop: 16,
  },
  macronutrientsSection: {
    marginTop: 16,
  },
  macronutrientItem: {
    marginVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  macronutrientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  macronutrientIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  macronutrientName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  macronutrientPercentage: {
    fontSize: 16,
    fontWeight: '600',
  },
  macronutrientProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  macronutrientDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  macronutrientAmount: {
    color: '#fff',
    fontSize: 14,
  },
  macronutrientGoal: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
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
    color: '#4C6EF5',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  mealTimingReason: {
    color: '#9CA3AF',
    fontSize: 14,
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

  // Fetch daily progress and goals
  const fetchDailyProgress = useCallback(async () => {
    if (!userId) return;
    try {
      const { progress, goals } = await getDailyProgress(userId);
      console.log('Fetched daily progress:', progress);
      setDailyProgress(progress);
      setCurrentGoals(goals);
    } catch (error) {
      console.error('Error fetching daily progress:', error);
    }
  }, [userId]);

  // Fetch weekly data
  const fetchWeeklyData = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getWeeklyData(userId);
      setWeeklyData(data);
    } catch (error) {
      console.error('Error fetching weekly data:', error);
    }
  }, [userId]);

  // Initial data load
  useEffect(() => {
    if (userId) {
      fetchDailyProgress();
      fetchWeeklyData();
    }
  }, [userId, fetchDailyProgress, fetchWeeklyData]);

  // Refresh data periodically
  useEffect(() => {
    if (!userId) return;

    const refreshInterval = setInterval(() => {
      fetchDailyProgress();
    }, 60000); // Refresh every minute

    return () => clearInterval(refreshInterval);
  }, [userId, fetchDailyProgress]);

  // Update progress after analysis
  useEffect(() => {
    if (result) {
      fetchDailyProgress();
    }
  }, [result, fetchDailyProgress]);

  const resetAnalysis = () => {
    setImage(null);
    setTextInput('');
    setResult(null);
  };

  const debouncedAnalyzeText = useCallback(
    debounce(async (text: string) => {
      if (!text.trim() || isLoading || !userId) return;
      
      try {
        setIsLoading(true);
        router.push('/(tabs)/nutritionanalyzer');
        const { analysis } = await analyzeNutrition('text', text, userId);
        setResult(analysis);
      } catch (error) {
        console.error('Error analyzing nutrition:', error);
        Alert.alert('Error', 'Failed to analyze nutrition. Please try again.');
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
    if (!userId) {
      Alert.alert('Error', 'Please sign in to analyze food.');
      return;
    }

    try {
      setIsLoading(true);
      router.push('/(tabs)/nutritionanalyzer');
      const { analysis, progress } = await analyzeNutrition('image', imageUri, userId);
      setResult(analysis);
      setDailyProgress(progress); // Update progress immediately after analysis
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

  const handleSaveGoals = async (goals: UserGoalInput) => {
    if (!userId) return;
    
    try {
      await updateUserNutritionGoals(userId, goals);
      await fetchDailyProgress(); // Fetch updated progress and goals
      Alert.alert('Success', 'Your nutrition goals have been updated!');
      setShowGoalsModal(false);
    } catch (error) {
      console.error('Error saving nutrition goals:', error);
      Alert.alert('Error', 'Failed to save nutrition goals. Please try again.');
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
                    <ActivityIndicator size="large" color="#4F46E5" />
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
                        <Ionicons name="time" size={16} color="#4C6EF5" /> {result.meal_type}
                      </Text>
                      {result.basic_info.portion_size && (
                        <Text style={styles.portionSize}>
                          <Ionicons name="restaurant" size={16} color="rgba(255, 255, 255, 0.7)" /> {result.basic_info.portion_size}
                        </Text>
                      )}
                    </View>

                    {result.health_analysis && (
                      <View style={styles.healthAnalysis}>
                        <Text style={styles.sectionTitle}>
                          <Ionicons name={'medical-outline' as keyof typeof Ionicons.glyphMap} size={20} color="#fff" /> Health Analysis
                        </Text>
                        {result.health_analysis.benefits.length > 0 && (
                          <View style={styles.benefitsContainer}>
                            <Text style={styles.benefitsTitle}>
                              <Ionicons name="checkmark-circle" size={18} color="#4C6EF5" /> Benefits
                            </Text>
                            {result.health_analysis.benefits.map((benefit, index) => (
                              <Text key={index} style={styles.benefitItem}>• {benefit}</Text>
                            ))}
                          </View>
                        )}
                        {result.health_analysis.considerations.length > 0 && (
                          <View style={styles.considerationsContainer}>
                            <Text style={styles.considerationsTitle}>
                              <Ionicons name="information-circle" size={18} color="#4C6EF5" /> Considerations
                            </Text>
                            {result.health_analysis.considerations.map((consideration, index) => (
                              <Text key={index} style={styles.considerationItem}>• {consideration}</Text>
                            ))}
                          </View>
                        )}
                        {result.health_analysis.allergens.length > 0 && (
                          <View style={styles.allergensContainer}>
                            <Text style={styles.allergensTitle}>
                              <Ionicons name="alert-circle" size={18} color="#4C6EF5" /> Allergens
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
      <NutritionGoalsModal
        visible={showGoalsModal}
        onClose={() => setShowGoalsModal(false)}
        onSave={handleSaveGoals}
        initialGoals={currentGoals || undefined}
      />
    </View>
  );
}