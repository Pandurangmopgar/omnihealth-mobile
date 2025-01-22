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
      "protein": { "amount": number, "unit": "g", "daily_value_percentage": number },
      "carbs": { "amount": number, "unit": "g", "daily_value_percentage": number },
      "fats": { "amount": number, "unit": "g", "daily_value_percentage": number }
    }
  },
  "health_analysis": {
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
  "meal_type": "breakfast" | "lunch" | "dinner" | "snack"
}`;

interface NutritionAnalysis {
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
      protein: { amount: number; unit: 'g'; daily_value_percentage: number };
      carbs: { amount: number; unit: 'g'; daily_value_percentage: number };
      fats: { amount: number; unit: 'g'; daily_value_percentage: number };
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
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
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
): Promise<{ analysis: NutritionAnalysis; progress: { calories: number; protein: number; carbs: number; fat: number; meals_logged: number } }> {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    let prompt = '';
    if (type === 'text') {
      prompt = `Analyze the nutritional content of: ${content}`;
    } else {
      prompt = `Analyze the nutritional content of this food image: ${content}`;
    }

    // Check cache first
    const cacheKey = `nutrition_analysis:${type}:${content.substring(0, 100)}`;
    try {
      const cachedResult = await redis.get(cacheKey);
      if (cachedResult) {
        const analysis = JSON.parse(cachedResult);
        const progress = await updateDailyProgress(userId, analysis.nutritional_content);
        return { analysis, progress };
      }
    } catch (error) {
      console.warn('Cache retrieval failed:', error);
    }

    // Generate content
    const result = await model.generateContent([{ text: systemPrompt }, { text: prompt }]);
    const response = await result.response;
    const analysis = formatAIResponse(response.text());

    // Update progress and store result
    const progress = await updateDailyProgress(userId, analysis.nutritional_content);
    await storeAnalysisResult(userId, analysis);

    // Cache the result
    try {
      await redis.set(cacheKey, JSON.stringify(analysis), { ex: CACHE_TTL });
    } catch (error) {
      console.warn('Cache storage failed:', error);
    }

    return { analysis, progress };
  } catch (error) {
    throw new NutritionAnalysisError(error instanceof Error ? error.message : 'Failed to analyze nutrition');
  }
};

async function getDailyProgress(userId: string): Promise<{ progress: { calories: number; protein: number; carbs: number; fat: number; meals_logged: number; }, goals: { daily_calories: number; daily_protein: number; daily_carbs: number; daily_fat: number } }> {
  try {
    console.log('[Progress] Fetching progress for user:', userId);
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's progress from progress_tracking table
    const { data: progressData, error: progressError } = await supabase
      .from('progress_tracking')
      .select(`
        total_calories,
        total_protein,
        total_carbs,
        total_fat,
        meals_logged,
        date
      `)
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (progressError) {
      console.error('[Progress] Error fetching progress:', progressError);
      throw progressError;
    }

    console.log('[Progress] Retrieved progress data:', progressData);

    // Get user's goals
    const goals = await getDailyGoals(userId);

    // If no progress data exists for today, return zeros
    const progress = progressData ? {
      calories: progressData.total_calories || 0,
      protein: progressData.total_protein || 0,
      carbs: progressData.total_carbs || 0,
      fat: progressData.total_fat || 0,
      meals_logged: progressData.meals_logged || 0
    } : {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      meals_logged: 0
    };

    console.log('[Progress] Returning progress:', progress);
    console.log('[Progress] Returning goals:', goals);

    return {
      progress,
      goals
    };

  } catch (error) {
    console.error('[Progress] Error in getDailyProgress:', error);
    // Return zeros for progress and default goals if there's an error
    return {
      progress: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        meals_logged: 0
      },
      goals: getDefaultGoals()
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

export { analyzeNutrition, getDailyProgress, getDailyGoals, getDefaultGoals };
