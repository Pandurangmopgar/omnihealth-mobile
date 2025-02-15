import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

// Initialize clients
const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GOOGLE_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

// Initialize Redis
const redis = new Redis({
  url: process.env.EXPO_PUBLIC_UPSTASH_REDIS_REST_URL!,
  token: process.env.EXPO_PUBLIC_UPSTASH_REDIS_REST_TOKEN!,
});

const CACHE_TTL = 3600; // 1 hour

const systemPrompt = `You are NutrInfo, a specialized AI for analyzing food descriptions and images. Provide thorough nutritional analysis in JSON format.

For text descriptions:
1. Parse the food description and quantity
2. Calculate nutritional content based on standard portions
3. Provide health insights
4. Consider common preparation methods
5. Suggest alternatives

For food images:
1. Identify the food and estimate portion size
2. Calculate nutritional content
3. Provide health insights
4. Consider preparation method
5. Suggest alternatives

Return analysis in this exact JSON structure:

{
  "analysis_type": "text" | "image",
  "basic_info": {
    "food_name": string,
    "portion_size": string,
    "preparation_method": string,
    "total_servings": number
  },
  "nutritional_content": {
    "calories": number,
    "macronutrients": {
      "protein": {
        "amount": number,
        "unit": "g",
        "daily_value_percentage": number | null
      },
      "carbs": {
        "amount": number,
        "unit": "g",
        "daily_value_percentage": number | null
      },
      "fats": {
        "amount": number,
        "unit": "g",
        "daily_value_percentage": number | null
      }
    },
    "vitamins_minerals": {
      "[name]": {
        "amount": number,
        "unit": string,
        "daily_value_percentage": number | null
      }
    },
    "fiber": {
      "amount": number,
      "unit": "g",
      "daily_value_percentage": number | null
    },
    "added_sugars": {
      "amount": number,
      "unit": "g",
      "daily_value_percentage": number | null
    }
  },
  "health_analysis": {
    "health_score": {
      "score": number,
      "explanation": string,
      "factors": string[]
    },
    "benefits": string[],
    "considerations": string[],
    "allergens": string[],
    "processing_level": string
  },
  "recommendations": {
    "serving_suggestions": string[],
    "healthier_alternatives": string[],
    "local_options": string[]
  },
  "source_reliability": "verified" | "estimated",
  "meal_type": string
}`


interface NutritionAnalysis {
  analysis_type: 'text' | 'image';
  basic_info: {
    food_name: string;
    portion_size: string;
    preparation_method: string;
  };
  nutritional_content: {
    calories: number;
    macronutrients: {
      protein: NutrientInfo;
      carbs: NutrientInfo;
      fats: NutrientInfo;
    };
    vitamins_minerals: {
      [key: string]: NutrientInfo;
    };
    fiber: NutrientInfo;
    added_sugars: NutrientInfo;
  };
  health_analysis: {
    health_score: {
      score: number;
      explanation: string;
      factors: string[];
    };
    benefits: string[];
    considerations: string[];
    allergens: string[];
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
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

interface NutrientInfo {
  amount: number;
  unit: string;
  daily_value_percentage: number | null;
}

interface MealTiming {
  hour: number;
  minute: number;
}

interface MealTimings {
  [key: string]: MealTiming[];
}

interface NutritionProgress {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals_logged: number;
}

interface ReminderSettings {
  meal: string;
  time: MealTiming;
}

class NutritionAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NutritionAnalysisError';
  }
}

function handleError(error: unknown): never {
  if (error instanceof Error) {
    throw new NutritionAnalysisError(error.message);
  }
  throw new NutritionAnalysisError('An unknown error occurred');
}

function formatAIResponse(responseText: string): NutritionAnalysis {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    throw new NutritionAnalysisError(error instanceof Error ? error.message : 'Failed to parse AI response');
  }
}

const updateDailyProgress = async (userId: string, nutritionalContent: NutritionAnalysis['nutritional_content']): Promise<{ calories: number; protein: number; carbs: number; fat: number; meals_logged: number }> => {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `progress:${userId}:${today}`;

  try {
    // Initialize default progress
    let progress = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      meals_logged: 0
    };

    // Get existing progress from Redis
    try {
      const cachedProgress = await redis.get(cacheKey);
      if (cachedProgress) {
        const parsedProgress = typeof cachedProgress === 'string'
          ? JSON.parse(cachedProgress)
          : cachedProgress;

        progress = {
          calories: Number(parsedProgress.calories || 0),
          protein: Number(parsedProgress.protein || 0),
          carbs: Number(parsedProgress.carbs || 0),
          fat: Number(parsedProgress.fat || 0),
          meals_logged: Number(parsedProgress.meals_logged || 0)
        };
      }
    } catch (error) {
      console.warn('Redis parsing error:', error);
    }

    // Update progress with new values
    const newProgress = {
      calories: progress.calories + Number(nutritionalContent?.calories || 0),
      protein: progress.protein + Number(nutritionalContent?.macronutrients?.protein?.amount || 0),
      carbs: progress.carbs + Number(nutritionalContent?.macronutrients?.carbs?.amount || 0),
      fat: progress.fat + Number(nutritionalContent?.macronutrients?.fats?.amount || 0),
      meals_logged: progress.meals_logged + 1
    };

    // Store in Redis
    await redis.set(cacheKey, JSON.stringify(newProgress), {
      ex: 24 * 60 * 60 // 24 hours
    });

    // Update Supabase
    const { error } = await supabase
      .from('progress_tracking')
      .upsert({
        user_id: userId,
        date: today,
        total_calories: newProgress.calories,
        total_protein: newProgress.protein,
        total_carbs: newProgress.carbs,
        total_fat: newProgress.fat,
        meals_logged: newProgress.meals_logged,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,date'
      });

    if (error) throw error;

    return newProgress;
  } catch (error) {
    console.error('Error updating progress:', error);
    throw new NutritionAnalysisError(error instanceof Error ? error.message : 'Failed to update progress');
  }
};

async function storeAnalysisResult(userId: string, analysis: NutritionAnalysis): Promise<void> {
  try {
    // Ensure meal_type is one of the allowed values
    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
    const mealType = validMealTypes.includes(analysis.meal_type as typeof validMealTypes[number])
      ? analysis.meal_type
      : 'snack'; // Default to snack if invalid or missing

    const { error } = await supabase
      .from('nutrition_analysis')
      .insert([{
        user_id: userId,
        date: new Date().toISOString().split('T')[0],
        meal_type: mealType,
        food_name: analysis.basic_info.food_name,
        calories: analysis.nutritional_content.calories,
        protein: analysis.nutritional_content.macronutrients.protein.amount,
        carbs: analysis.nutritional_content.macronutrients.carbs.amount,
        fat: analysis.nutritional_content.macronutrients.fats.amount,
        analysis_data: analysis,
        created_at: new Date().toISOString()
      }]);

    if (error) throw error;
  } catch (error) {
    throw new NutritionAnalysisError(error instanceof Error ? error.message : 'Failed to store analysis result');
  }
};

async function analyzeNutrition(
  type: 'text' | 'image',
  content: string,
  userId: string
): Promise<{ analysis: NutritionAnalysis; progress: NutritionProgress }> {
  try {
    console.log('🎯 analyzeNutrition called with:', { type, content: content.substring(0, 100), userId });
    
    if (!userId) {
      console.error('❌ No userId provided');
      throw new Error('User ID is required');
    }

    // For text analysis, use Gemini
    if (type === 'text') {
      console.log('📝 Routing text analysis to Gemini service...');
      let prompt = 'Analyze this food description and provide nutritional information.';
      let parts = [
        { text: systemPrompt },
        { text: prompt },
        { text: content }
      ];

      // Check cache first
      const cacheKey = `nutrition_analysis:${type}:${content.substring(0, 100)}`;
      console.log('🔍 Checking cache with key:', cacheKey);

      // Check cache first to reduce API calls
      try {
        const cachedResult = await redis.get(cacheKey);
        if (cachedResult) {
          console.log('✨ Found cached result');
          const analysis = typeof cachedResult === 'string' ? JSON.parse(cachedResult) : cachedResult;
          const progress = await updateDailyProgress(userId, analysis.nutritional_content);
          return { analysis, progress };
        }
        console.log('💫 No cached result found');
      } catch (error) {
        console.warn('⚠️ Cache retrieval failed:', error);
      }

      // Add retry logic with exponential backoff
      let retries = 3;
      let delay = 1000;
      let analysis: NutritionAnalysis;

      while (retries > 0) {
        try {
          console.log(`🔄 Attempting Gemini API call (${4-retries}/3)...`);
          const result = await model.generateContent(parts);
          if (!result.response) {
            throw new Error('Empty response from AI model');
          }
          const responseText = result.response.text();
          if (!responseText) {
            throw new Error('Empty text in AI response');
          }
          analysis = formatAIResponse(responseText);
          console.log('✅ Gemini API call successful');
          break;
        } catch (error) {
          retries--;
          console.error(`❌ Attempt failed (${retries} retries left):`, error);
          if (retries === 0) throw error;
          console.log(`⏳ Waiting ${delay}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        }
      }

      // Ensure all required fields are present
      if (!analysis) {
        console.error('❌ No analysis generated');
        throw new Error('Failed to generate analysis');
      }

      // Cache successful result
      try {
        console.log('💾 Caching analysis result...');
        await redis.set(cacheKey, JSON.stringify(analysis), { ex: CACHE_TTL });
        console.log('✅ Analysis cached successfully');
      } catch (error) {
        console.warn('⚠️ Cache storage failed:', error);
      }

      // Update progress with comprehensive data
      console.log('📊 Updating daily progress...');
      const progress = await updateDailyProgress(userId, analysis.nutritional_content);
      console.log('✅ Progress updated successfully');

      // Store detailed analysis
      console.log('💾 Storing analysis result...');
      await storeAnalysisResult(userId, analysis);
      console.log('✅ Analysis stored successfully');

      return { analysis, progress };
    }

    // For image analysis, continue using Gemini
    console.log('🖼️ Processing image analysis with Gemini...');
    let prompt = 'Analyze this food image and provide nutritional information.';
    let parts = [
      { text: systemPrompt },
      { text: prompt },
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: content
        }
      }
    ];

    // Check cache first
    const cacheKey = `nutrition_analysis:${type}:${content.substring(0, 100)}`;
    console.log('🔍 Checking cache with key:', cacheKey);

    // Check cache first to reduce API calls
    try {
      const cachedResult = await redis.get(cacheKey);
      if (cachedResult) {
        console.log('✨ Found cached result');
        const analysis = typeof cachedResult === 'string' ? JSON.parse(cachedResult) : cachedResult;
        const progress = await updateDailyProgress(userId, analysis.nutritional_content);
        return { analysis, progress };
      }
      console.log('💫 No cached result found');
    } catch (error) {
      console.warn('⚠️ Cache retrieval failed:', error);
    }

    // Add retry logic with exponential backoff
    let retries = 3;
    let delay = 1000;
    let analysis: NutritionAnalysis;

    while (retries > 0) {
      try {
        console.log(`🔄 Attempting Gemini API call (${4-retries}/3)...`);
        const result = await model.generateContent(parts);
        if (!result.response) {
          throw new Error('Empty response from AI model');
        }
        const responseText = result.response.text();
        if (!responseText) {
          throw new Error('Empty text in AI response');
        }
        analysis = formatAIResponse(responseText);
        console.log('✅ Gemini API call successful');
        break;
      } catch (error) {
        retries--;
        console.error(`❌ Attempt failed (${retries} retries left):`, error);
        if (retries === 0) throw error;
        console.log(`⏳ Waiting ${delay}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }

    // Ensure all required fields are present
    if (!analysis) {
      console.error('❌ No analysis generated');
      throw new Error('Failed to generate analysis');
    }

    // Cache successful result
    try {
      console.log('💾 Caching analysis result...');
      await redis.set(cacheKey, JSON.stringify(analysis), { ex: CACHE_TTL });
      console.log('✅ Analysis cached successfully');
    } catch (error) {
      console.warn('⚠️ Cache storage failed:', error);
    }

    // Update progress with comprehensive data
    console.log('📊 Updating daily progress...');
    const progress = await updateDailyProgress(userId, analysis.nutritional_content);
    console.log('✅ Progress updated successfully');

    // Store detailed analysis
    console.log('💾 Storing analysis result...');
    await storeAnalysisResult(userId, analysis);
    console.log('✅ Analysis stored successfully');

    return { analysis, progress };
  } catch (error) {
    console.error('❌ Nutrition analysis error:', error);
    throw new NutritionAnalysisError(error instanceof Error ? error.message : 'Failed to analyze nutrition');
  }
}

async function generateNutritionReport(userId: string) {
  try {
    // Check daily report limit
    const today = new Date().toISOString().split('T')[0];
    const reportCountKey = `user:${userId}:report_count:${today}`;
    
    const dailyReportCount = await redis.get(reportCountKey) || 0;
    if (Number(dailyReportCount) >= 4) {
      throw new Error('Daily report limit reached. You can generate up to 4 reports per day.');
    }

    // Fetch user's data
    const [progressData, goalsData] = await Promise.all([
      getDailyProgress(userId),
      getDailyGoals(userId)
    ]);

    // Calculate completion percentages
    const completion = {
      calories: (progressData.progress.calories / goalsData.daily_calories) * 100,
      protein: (progressData.progress.protein / goalsData.daily_protein) * 100,
      carbs: (progressData.progress.carbs / goalsData.daily_carbs) * 100,
      fat: (progressData.progress.fat / goalsData.daily_fat) * 100
    };

    // Generate report using AI
    const reportPrompt = `Generate a detailed nutrition report based on this data:
    Progress: ${JSON.stringify(progressData)}
    Goals: ${JSON.stringify(goalsData)}
    Completion: ${JSON.stringify(completion)}

    Include:
    1. Overall progress summary
    2. Specific nutrient analysis
    3. Personalized recommendations
    4. Areas needing attention
    5. Positive achievements
    6. Tips for improvement

    Format the response in a user-friendly way with sections and bullet points.`;

    const result = await model.generateContent(reportPrompt);
    const reportText = result.response.text();
    
    // Store the report in Redis
    interface RedisHashData {
      [key: string]: string;
    }
    const hashData: RedisHashData = {
      latest: JSON.stringify({
        report: reportText,
        timestamp: new Date().toISOString(),
        data: { progressData, goalsData, completion }
      })
    };
    await Promise.all([
      redis.hset(`user:${userId}:reports`, hashData),
      redis.incr(reportCountKey),
      redis.expire(reportCountKey, 86400) // Expire after 24 hours
    ]);

    return {
      report: reportText,
      remainingReports: 4 - (Number(dailyReportCount) + 1)
    };
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
}

async function calculateOptimalReminders(userId: string): Promise<ReminderSettings[]> {
  const defaultReminders: ReminderSettings[] = [
    { meal: 'breakfast', time: { hour: 8, minute: 0 } },
    { meal: 'morning_snack', time: { hour: 10, minute: 30 } },
    { meal: 'lunch', time: { hour: 13, minute: 0 } },
    { meal: 'evening_snack', time: { hour: 16, minute: 30 } },
    { meal: 'dinner', time: { hour: 19, minute: 0 } }
  ];

  try {
    // Get user's nutrition logs to analyze patterns
    const { data: logs, error } = await supabase
      .from('nutrition_analysis')
      .select('created_at, meal_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (!logs || logs.length === 0) {
      return defaultReminders;
    }

    // Analyze user's meal timing patterns
    const mealTimings: MealTimings = logs.reduce((acc: MealTimings, log) => {
      const date = new Date(log.created_at);
      const hour = date.getHours();
      const minute = date.getMinutes();
      
      if (!acc[log.meal_type]) {
        acc[log.meal_type] = [];
      }
      acc[log.meal_type].push({ hour, minute });
      return acc;
    }, {});

    // Calculate average times for each meal
    const optimizedReminders = defaultReminders.map(reminder => {
      const mealLogs = mealTimings[reminder.meal];
      if (mealLogs && mealLogs.length > 0) {
        const avgHour = Math.round(mealLogs.reduce((sum: number, time: MealTiming) => sum + time.hour, 0) / mealLogs.length);
        const avgMinute = Math.round(mealLogs.reduce((sum: number, time: MealTiming) => sum + time.minute, 0) / mealLogs.length);
        return {
          ...reminder,
          time: { hour: avgHour, minute: avgMinute }
        };
      }
      return reminder;
    });

    return optimizedReminders;
  } catch (error) {
    console.error('Error calculating optimal reminders:', error);
    return defaultReminders;
  }
}

async function getDailyProgress(userId: string): Promise<{ progress: NutritionProgress; goals: { daily_calories: number; daily_protein: number; daily_carbs: number; daily_fat: number } }> {
  try {
    console.log('[Progress] Fetching progress for user:', userId);
    
    // Get today's date in the correct format (YYYY-MM-DD)
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Get today's progress from progress_tracking table with more flexible date matching
    const { data: progressData, error: progressError } = await supabase
      .from('progress_tracking')
      .select('total_calories, total_protein, total_carbs, total_fat, meals_logged, date')
      .eq('user_id', userId)
      .gte('date', today + ' 00:00:00')
      .lte('date', today + ' 23:59:59')
      .order('date', { ascending: false })
      .limit(1);

    if (progressError) {
      console.error('[Progress] Error fetching progress:', progressError);
      throw progressError;
    }

    // Get user's goals
    const goals = await getDailyGoals(userId);

    // If no progress data exists for today, return zeros
    const progress = progressData && progressData[0] ? {
      calories: progressData[0].total_calories || 0,
      protein: progressData[0].total_protein || 0,
      carbs: progressData[0].total_carbs || 0,
      fat: progressData[0].total_fat || 0,
      meals_logged: progressData[0].meals_logged || 0
    } : {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      meals_logged: 0
    };

    console.log('[Progress] Retrieved progress:', progress);
    return { progress, goals };

  } catch (error) {
    console.error('[Progress] Error in getDailyProgress:', error);
    return {
      progress: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        meals_logged: 0
      },
      goals: await getDefaultGoals()
    };
  }
}

async function getDailyGoals(userId: string): Promise<{ daily_calories: number; daily_protein: number; daily_carbs: number; daily_fat: number }> {
  try {
    console.log(`[NutritionGoals] Fetching goals for user: ${userId}`);
    
    // Get the most recent goals entry for the user
    const { data, error } = await supabase
      .from('nutrition_goals')
      .select(`
      
        user_id,
        calories_target,
        protein_target,
        carbs_target,
        fat_target,
        start_date,
        end_date
      `)
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('[NutritionGoals] Error fetching from Supabase:', error);
      throw error;
    }

    console.log('[NutritionGoals] Retrieved data:', data);

    if (!data) {
      console.warn('[NutritionGoals] No goals found for user, using defaults');
      return getDefaultGoals();
    }

    // Check if the goals are still valid (within date range)
    const now = new Date();
    const startDate = data.start_date ? new Date(data.start_date) : null;
    const endDate = data.end_date ? new Date(data.end_date) : null;

    if (startDate && endDate && (now < startDate || now > endDate)) {
      console.warn('[NutritionGoals] Goals are outside valid date range, using defaults');
      return getDefaultGoals();
    }

    // Map the column names from the table to our expected format
    const goals = {
      daily_calories: data.calories_target || getDefaultGoals().daily_calories,
      daily_protein: data.protein_target || getDefaultGoals().daily_protein,
      daily_carbs: data.carbs_target || getDefaultGoals().daily_carbs,
      daily_fat: data.fat_target || getDefaultGoals().daily_fat
    };

    console.log('[NutritionGoals] Returning goals:', goals);
    return goals;
  } catch (error) {
    console.error('[NutritionGoals] Error in getDailyGoals:', error);
    return getDefaultGoals();
  }
};

function getDefaultGoals() {
  const defaults = {
    daily_calories: 2000,
    daily_protein: 50,
    daily_carbs: 225,
    daily_fat: 65
  };
  console.log('[NutritionGoals] Using default goals:', defaults);
  return defaults;
}

async function checkNutritionGoals(userId: string): Promise<string> {
  try {
    const [progress, goals] = await Promise.all([
      getDailyProgress(userId),
      getDailyGoals(userId)
    ]);

    const remaining = {
      calories: goals.daily_calories - progress.progress.calories,
      protein: goals.daily_protein - progress.progress.protein,
      carbs: goals.daily_carbs - progress.progress.carbs,
      fat: goals.daily_fat - progress.progress.fat
    };

    // Generate personalized message using AI
    const prompt = `Create a brief, motivational notification message based on this nutrition data:
    Remaining Goals:
    - Calories: ${remaining.calories}
    - Protein: ${remaining.protein}g
    - Carbs: ${remaining.carbs}g
    - Fat: ${remaining.fat}g

    Keep it encouraging and actionable. Maximum 2 sentences.`;

    const result = await model.generateContent(prompt);
    const defaultMessage = 'No specific recommendations at this time';
    return result.response.text() || defaultMessage;
  } catch (error) {
    console.error('Error checking nutrition goals:', error);
    return 'Remember to track your meals and stay on top of your nutrition goals!';
  }
}

export async function getWeeklyData(userId: string) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const { data: weeklyData, error } = await supabase
      .from('progress_tracking')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) throw error;

    const formattedData = {
      protein: [] as { date: number; value: number }[],
      carbs: [] as { date: number; value: number }[],
      fats: [] as { date: number; value: number }[],
      calories: [] as { date: number; value: number }[]
    };

    weeklyData?.forEach(day => {
      const timestamp = new Date(day.date).getTime();
      formattedData.protein.push({ date: timestamp, value: day.total_protein || 0 });
      formattedData.carbs.push({ date: timestamp, value: day.total_carbs || 0 });
      formattedData.fats.push({ date: timestamp, value: day.total_fat || 0 });
      formattedData.calories.push({ date: timestamp, value: day.total_calories || 0 });
    });

    return formattedData;
  } catch (error) {
    console.error('Error fetching weekly data:', error);
    throw error;
  }
}

export async function scheduleNutritionReminders(userId: string, reminders: ReminderSettings[]): Promise<void> {
  const MAX_REMINDERS = 5; // Maximum number of reminders per user
  const MIN_INTERVAL = 60 * 60 * 1000; // Minimum 1 hour between reminders

  try {
    // Limit number of reminders
    const limitedReminders = reminders.slice(0, MAX_REMINDERS);

    // Sort reminders by time
    const sortedReminders = limitedReminders.sort((a, b) => {
      const timeA = a.time.hour * 60 + a.time.minute;
      const timeB = b.time.hour * 60 + b.time.minute;
      return timeA - timeB;
    });

    // Validate intervals between reminders
    for (let i = 1; i < sortedReminders.length; i++) {
      const prevTime = sortedReminders[i - 1].time;
      const currTime = sortedReminders[i].time;
      const prevMinutes = prevTime.hour * 60 + prevTime.minute;
      const currMinutes = currTime.hour * 60 + currTime.minute;
      
      if ((currMinutes - prevMinutes) * 60 * 1000 < MIN_INTERVAL) {
        throw new Error('Reminders must be at least 1 hour apart');
      }
    }

    // Store reminders in Redis with expiration
    const reminderKey = `reminders:${userId}`;
    await redis.set(reminderKey, JSON.stringify(sortedReminders), { ex: 24 * 60 * 60 }); // Expire after 24 hours

    return;
  } catch (error) {
    console.error('Error scheduling reminders:', error);
    throw error;
  }
}

export {
  analyzeNutrition,
  getDailyProgress,
  getDailyGoals,
  getDefaultGoals,
  generateNutritionReport,
  calculateOptimalReminders,
  checkNutritionGoals,
  
};