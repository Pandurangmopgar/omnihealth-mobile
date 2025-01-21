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

const formatAIResponse = (responseText: string) => {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error parsing AI response:', error);
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }
};

export const getDailyGoals = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('nutrition_goals')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return data || {
      daily_calories: 2000,
      daily_protein: 50,
      daily_carbs: 275,
      daily_fat: 55
    };
  } catch (error) {
    console.error('Error fetching goals:', error);
    return {
      daily_calories: 2000,
      daily_protein: 50,
      daily_carbs: 275,
      daily_fat: 55
    };
  }
};

const updateDailyProgress = async (userId: string, nutritionalContent: any) => {
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
    throw new Error(`Failed to update progress: ${error.message}`);
  }
};

const storeAnalysisResult = async (userId: string, analysis: any) => {
  try {
    // Ensure meal_type is one of the allowed values
    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    const mealType = validMealTypes.includes(analysis.meal_type?.toLowerCase())
      ? analysis.meal_type.toLowerCase()
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
    console.error('Error storing analysis result:', error);
    throw error;
  }
};

export const analyzeNutrition = async (
  type: 'text' | 'image',
  content: string,
  userId: string
) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    let prompt = '';
    let parts = [];

    if (type === 'text') {
      prompt = `Analyze this food description: ${content}`;
      parts = [{ text: systemPrompt }, { text: prompt }];
    } else {
      prompt = 'Analyze this food image and provide nutritional information.';
      parts = [
        { text: systemPrompt },
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: content
          }
        }
      ];
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
    const result = await model.generateContent(parts);
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
    console.error('Error in nutrition analysis:', error);
    throw new Error(`Nutrition analysis failed: ${error.message}`);
  }
};

export const getDailyProgress = async (userId: string) => {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `progress:${userId}:${today}`;

  try {
    // Try Redis first
    const cachedProgress = await redis.get(cacheKey);
    if (cachedProgress) {
      const progress = JSON.parse(cachedProgress);
      const goals = await getDailyGoals(userId);
      return {
        ...progress,
        goals,
        progress: {
          calories: (progress.calories / goals.daily_calories) * 100,
          protein: (progress.protein / goals.daily_protein) * 100,
          carbs: (progress.carbs / goals.daily_carbs) * 100,
          fat: (progress.fat / goals.daily_fat) * 100
        }
      };
    }

    // Fallback to Supabase
    const { data, error } = await supabase
      .from('progress_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    const progress = data || {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      meals_logged: 0
    };

    const goals = await getDailyGoals(userId);

    return {
      ...progress,
      goals,
      progress: {
        calories: (progress.calories / goals.daily_calories) * 100,
        protein: (progress.protein / goals.daily_protein) * 100,
        carbs: (progress.carbs / goals.daily_carbs) * 100,
        fat: (progress.fat / goals.daily_fat) * 100
      }
    };
  } catch (error) {
    console.error('Error fetching progress:', error);
    throw new Error(`Failed to fetch progress: ${error.message}`);
  }
};
