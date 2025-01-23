import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, StyleSheet, Platform, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MotiView } from 'moti';
import { useAuth } from '@clerk/clerk-expo';
import { analyzeNutrition, getDailyProgress, getDailyGoals, generateNutritionReport } from '../../services/nutritionAnalyzer';
import { registerForPushNotifications, scheduleNutritionReminders } from '../../services/pushNotifications';
import { PieChart, LineChart } from 'react-native-chart-kit';
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { VictoryPie, VictoryChart, VictoryBar, VictoryAxis, VictoryLabel } from 'victory-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

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
  result: {
    nutritional_content: {
      calories: number;
      macronutrients: {
        protein: { amount: number };
        carbs: { amount: number };
        fats: { amount: number };
      };
    };
  } | null;
  dailyProgress: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    meals_logged: number;
  };
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

const MacroCard = ({ title, current, target, unit, icon, colors }: {
  title: string;
  current: number;
  target: number;
  unit: string;
  icon: string;
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
            <Ionicons name={icon as any} size={24} color={colors[0]} />
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
  const [activeTab, setActiveTab] = useState('progress');
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [goals, setGoals] = useState<{
    daily_calories: number;
    daily_protein: number;
    daily_carbs: number;
    daily_fat: number;
  } | null>(null);
  const { userId } = useAuth();

  useEffect(() => {
    if (userId) {
      setupNotifications();
      fetchGoals();
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
  const nutritionData = result ? {
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
          <>
            {/* Calories Overview */}
            <Animated.View entering={FadeInDown.delay(100)} style={styles.caloriesCard}>
              <BlurView intensity={20} style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                  style={styles.cardGradient}
                >
                  <Text style={styles.sectionTitle}>Daily Calories</Text>
                  <View style={styles.caloriesContent}>
                    <Text style={styles.caloriesValue}>{nutritionData.calories}</Text>
                    <Text style={styles.caloriesUnit}>kcal</Text>
                  </View>
                  <View style={styles.caloriesProgress}>
                    <LinearGradient
                      colors={COLORS.calories}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.progressBar,
                        { width: `${(nutritionData.calories / (goals?.daily_calories || 2000)) * 100}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.caloriesTarget}>
                    Daily Target: {goals?.daily_calories || 2000} kcal
                  </Text>
                </LinearGradient>
              </BlurView>
            </Animated.View>

            {/* Macro Distribution */}
            <Animated.View entering={FadeInDown.delay(150)} style={styles.macroDistribution}>
              <BlurView intensity={20} style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                  style={styles.cardGradient}
                >
                  <Text style={styles.sectionTitle}>Macro Distribution</Text>
                  <View style={styles.chartContainer}>
                    <VictoryPie
                      data={[
                        { x: 'Protein', y: macroPercentages.protein },
                        { x: 'Carbs', y: macroPercentages.carbs },
                        { x: 'Fat', y: macroPercentages.fat },
                      ]}
                      width={250}
                      height={250}
                      colorScale={[COLORS.protein[0], COLORS.carbs[0], COLORS.fat[0]]}
                      innerRadius={70}
                      labelRadius={({ innerRadius }) => (innerRadius as number) + 30}
                      style={{
                        labels: {
                          fill: 'white',
                          fontSize: 14,
                        },
                      }}
                      animate={{
                        duration: 1000,
                        easing: 'bounce',
                      }}
                    />
                    <View style={styles.macroLegend}>
                      {Object.entries(macroPercentages).map(([macro, percentage], index) => (
                        <TouchableOpacity 
                          key={macro} 
                          style={styles.legendItem}
                          onPress={() => setActiveTab('details')}
                        >
                          <View style={[styles.legendColor, { backgroundColor: [COLORS.protein[0], COLORS.carbs[0], COLORS.fat[0]][index] }]} />
                          <View style={styles.legendTextContainer}>
                            <Text style={styles.legendText}>
                              {macro.charAt(0).toUpperCase() + macro.slice(1)}: {Math.round(percentage)}%
                            </Text>
                            <Text style={styles.legendSubtext}>
                              {nutritionData[macro as keyof typeof nutritionData]}g / {goals?.[`daily_${macro}` as keyof typeof goals]}g
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </LinearGradient>
              </BlurView>
            </Animated.View>

            {/* Meals Logged */}
            <MealsLoggedIndicator mealsLogged={dailyProgress.meals_logged} />
          </>
        );

      case 'details':
        return (
          <ScrollView style={styles.detailsContainer}>
            <Animated.View entering={FadeInDown.delay(100)} style={styles.analysisCard}>
              <BlurView intensity={20} style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                  style={styles.cardGradient}
                >
                  <Text style={styles.sectionTitle}>Detailed Analysis</Text>
                  <View style={styles.nutrientGrid}>
                    {Object.entries(nutritionData).map(([nutrient, amount]) => (
                      <View key={nutrient} style={styles.nutrientDetailItem}>
                        <Text style={styles.nutrientName}>
                          {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}
                        </Text>
                        <Text style={styles.nutrientAmount}>
                          {amount}{nutrient === 'calories' ? ' kcal' : 'g'}
                        </Text>
                        <View style={styles.nutrientProgress}>
                          <LinearGradient
                            colors={COLORS[nutrient as keyof typeof COLORS]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[
                              styles.progressBar,
                              {
                                width: `${(amount / (goals?.[`daily_${nutrient}` as keyof typeof goals] || 1)) * 100}%`
                              }
                            ]}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </LinearGradient>
              </BlurView>
            </Animated.View>
          </ScrollView>
        );

      case 'trends':
        return (
          <ScrollView style={styles.trendsContainer}>
            <Animated.View entering={FadeInDown.delay(100)} style={styles.trendsCard}>
              <BlurView intensity={20} style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                  style={styles.cardGradient}
                >
                  <Text style={styles.sectionTitle}>Nutrition Trends</Text>
                  <View style={styles.trendsContent}>
                    <Text style={styles.comingSoonText}>
                      Nutrition trends visualization coming soon!
                    </Text>
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
          <>
            {/* Calories Overview */}
            <Animated.View entering={FadeInDown.delay(100)} style={styles.caloriesCard}>
              <BlurView intensity={20} style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                  style={styles.cardGradient}
                >
                  <Text style={styles.sectionTitle}>Daily Calories</Text>
                  <View style={styles.caloriesContent}>
                    <Text style={styles.caloriesValue}>{nutritionData.calories}</Text>
                    <Text style={styles.caloriesUnit}>kcal</Text>
                  </View>
                  <View style={styles.caloriesProgress}>
                    <LinearGradient
                      colors={COLORS.calories}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.progressBar,
                        { width: `${(nutritionData.calories / (goals?.daily_calories || 2000)) * 100}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.caloriesTarget}>
                    Daily Target: {goals?.daily_calories || 2000} kcal
                  </Text>
                </LinearGradient>
              </BlurView>
            </Animated.View>

            {/* Macro Distribution */}
            <Animated.View entering={FadeInDown.delay(150)} style={styles.macroDistribution}>
              <BlurView intensity={20} style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                  style={styles.cardGradient}
                >
                  <Text style={styles.sectionTitle}>Macro Distribution</Text>
                  <View style={styles.chartContainer}>
                    <VictoryPie
                      data={[
                        { x: 'Protein', y: macroPercentages.protein },
                        { x: 'Carbs', y: macroPercentages.carbs },
                        { x: 'Fat', y: macroPercentages.fat },
                      ]}
                      width={250}
                      height={250}
                      colorScale={[COLORS.protein[0], COLORS.carbs[0], COLORS.fat[0]]}
                      innerRadius={70}
                      labelRadius={({ innerRadius }) => (innerRadius as number) + 30}
                      style={{
                        labels: {
                          fill: 'white',
                          fontSize: 14,
                        },
                      }}
                      animate={{
                        duration: 1000,
                        easing: 'bounce',
                      }}
                    />
                    <View style={styles.macroLegend}>
                      {Object.entries(macroPercentages).map(([macro, percentage], index) => (
                        <TouchableOpacity 
                          key={macro} 
                          style={styles.legendItem}
                          onPress={() => setActiveTab('details')}
                        >
                          <View style={[styles.legendColor, { backgroundColor: [COLORS.protein[0], COLORS.carbs[0], COLORS.fat[0]][index] }]} />
                          <View style={styles.legendTextContainer}>
                            <Text style={styles.legendText}>
                              {macro.charAt(0).toUpperCase() + macro.slice(1)}: {Math.round(percentage)}%
                            </Text>
                            <Text style={styles.legendSubtext}>
                              {nutritionData[macro as keyof typeof nutritionData]}g / {goals?.[`daily_${macro}` as keyof typeof goals]}g
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </LinearGradient>
              </BlurView>
            </Animated.View>
          </>
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
        <>
          {/* Keep existing Progress tab content exactly as is */}
          <Animated.View entering={FadeInDown.delay(100)} style={styles.caloriesCard}>
            <BlurView intensity={20} style={styles.cardBlur}>
              <LinearGradient
                colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                style={styles.cardGradient}
              >
                <Text style={styles.sectionTitle}>Daily Calories</Text>
                <View style={styles.caloriesContent}>
                  <Text style={styles.caloriesValue}>{nutritionData.calories}</Text>
                  <Text style={styles.caloriesUnit}>kcal</Text>
                </View>
                <View style={styles.caloriesProgress}>
                  <LinearGradient
                    colors={COLORS.calories}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.progressBar,
                      { width: `${(nutritionData.calories / (goals?.daily_calories || 2000)) * 100}%` }
                    ]}
                  />
                </View>
                <Text style={styles.caloriesTarget}>
                  Daily Target: {goals?.daily_calories || 2000} kcal
                </Text>
              </LinearGradient>
            </BlurView>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150)} style={styles.macroDistribution}>
            <BlurView intensity={20} style={styles.cardBlur}>
              <LinearGradient
                colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                style={styles.cardGradient}
              >
                <Text style={styles.sectionTitle}>Macro Distribution</Text>
                <View style={styles.chartContainer}>
                  <VictoryPie
                    data={[
                      { x: 'Protein', y: macroPercentages.protein },
                      { x: 'Carbs', y: macroPercentages.carbs },
                      { x: 'Fat', y: macroPercentages.fat },
                    ]}
                    width={250}
                    height={250}
                    colorScale={[COLORS.protein[0], COLORS.carbs[0], COLORS.fat[0]]}
                    innerRadius={70}
                    labelRadius={({ innerRadius }) => (innerRadius as number) + 30}
                    style={{
                      labels: {
                        fill: 'white',
                        fontSize: 14,
                      },
                    }}
                    animate={{
                      duration: 1000,
                      easing: 'bounce',
                    }}
                  />
                  <View style={styles.macroLegend}>
                    {Object.entries(macroPercentages).map(([macro, percentage], index) => (
                      <TouchableOpacity 
                        key={macro} 
                        style={styles.legendItem}
                        onPress={() => setActiveTab('details')}
                      >
                        <View style={[styles.legendColor, { backgroundColor: [COLORS.protein[0], COLORS.carbs[0], COLORS.fat[0]][index] }]} />
                        <View style={styles.legendTextContainer}>
                          <Text style={styles.legendText}>
                            {macro.charAt(0).toUpperCase() + macro.slice(1)}: {Math.round(percentage)}%
                          </Text>
                          <Text style={styles.legendSubtext}>
                            {nutritionData[macro as keyof typeof nutritionData]}g / {goals?.[`daily_${macro}` as keyof typeof goals]}g
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </LinearGradient>
            </BlurView>
          </Animated.View>

          <MealsLoggedIndicator mealsLogged={dailyProgress.meals_logged} />
        </>
      )}

      {activeTab === 'details' && (
        <ScrollView style={styles.detailsContainer}>
          <Animated.View entering={FadeInDown.delay(100)} style={styles.analysisCard}>
            <BlurView intensity={20} style={styles.cardBlur}>
              <LinearGradient
                colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                style={styles.cardGradient}
              >
                <Text style={styles.sectionTitle}>Detailed Analysis</Text>
                <View style={styles.nutrientGrid}>
                  {Object.entries(nutritionData).map(([nutrient, amount]) => (
                    <View key={nutrient} style={styles.nutrientDetailItem}>
                      <Text style={styles.nutrientName}>
                        {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}
                      </Text>
                      <Text style={styles.nutrientAmount}>
                        {amount}{nutrient === 'calories' ? ' kcal' : 'g'}
                      </Text>
                      <View style={styles.nutrientProgress}>
                        <LinearGradient
                          colors={COLORS[nutrient as keyof typeof COLORS]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[
                            styles.progressBar,
                            {
                              width: `${(amount / (goals?.[`daily_${nutrient}` as keyof typeof goals] || 1)) * 100}%`
                            }
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </LinearGradient>
            </BlurView>
          </Animated.View>
        </ScrollView>
      )}

      {activeTab === 'trends' && (
        <ScrollView style={styles.trendsContainer}>
          <Animated.View entering={FadeInDown.delay(100)} style={styles.trendsCard}>
            <BlurView intensity={20} style={styles.cardBlur}>
              <LinearGradient
                colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                style={styles.cardGradient}
              >
                <Text style={styles.sectionTitle}>Nutrition Trends</Text>
                <View style={styles.trendsContent}>
                  <Text style={styles.comingSoonText}>
                    Nutrition trends visualization coming soon!
                  </Text>
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
  nutrientDetails: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  nutrientGrid: {
    marginTop: 12,
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
    borderRadius: 2,
  },
  nutrientTarget: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 4,
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
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  trendsContainer: {
    flex: 1,
  },
  trendsCard: {
    margin: 16,
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
  }
});

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