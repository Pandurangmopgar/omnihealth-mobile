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
    const date = new Date().toISOString().split('T')[0];
    const cacheKey = `daily_progress:${userId}:${date}`;
    
    // Try to get from cache first
    const cachedProgress = await redis.get(cacheKey);
    if (cachedProgress) {
      return JSON.parse(cachedProgress);
    }

    // Get from database if not in cache
    const { data: progressData, error: dbError } = await supabase
      .from('progress_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    if (dbError) throw dbError;

    // Get user's goals
    const goals = await getDailyGoals(userId);

    // Initialize default progress
    const progress = {
      calories: progressData?.total_calories || 0,
      protein: progressData?.total_protein || 0,
      carbs: progressData?.total_carbs || 0,
      fat: progressData?.total_fat || 0,
      meals_logged: progressData?.meals_logged || 0,
    };

    const result = {
      progress,
      goals,
    };

    // Cache the result
    await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });

    return result;
  } catch (error) {
    console.error('Error in getDailyProgress:', error);
    // Return default values if there's an error
    return {
      progress: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        meals_logged: 0,
      },
      goals: {
        daily_calories: 2000,
        daily_protein: 50,
        daily_carbs: 275,
        daily_fat: 55,
      },
    };
  }
};

async function getDailyGoals(userId: string): Promise<{ daily_calories: number; daily_protein: number; daily_carbs: number; daily_fat: number }> {
  try {
    // Get the most recent goals entry for the user
    const { data, error } = await supabase
      .from('nutrition_goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;

    // Map the column names from the table to our expected format
    return {
      daily_calories: data?.calories || 2000,
      daily_protein: data?.protein || 50,
      daily_carbs: data?.carbs || 225,
      daily_fat: data?.fat_target || 65
    };
  } catch (error) {
    console.error('Error fetching nutrition goals:', error);
    // Return default values based on the table's typical values
    return {
      daily_calories: 2000, // Default calorie goal
      daily_protein: 50,    // Default protein goal
      daily_carbs: 225,     // Default carbs goal
      daily_fat: 65         // Default fat goal
    };
  }
};

export { analyzeNutrition, getDailyProgress, getDailyGoals };
