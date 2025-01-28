import Together from 'together-ai';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import type { NutritionAnalysis, NutritionProgress } from './types';

// Initialize clients
const together = new Together({
  apiKey: "6402ad6b52a76c813a981c34ba6f6563f2831207df8697597ff6715b20648d5f",
});

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

const systemPrompt = `You are a nutrition analysis AI. Return analysis in this exact JSON format:
{
  "analysis_type": "text",
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
    },
    "vitamins_minerals": { "[name]": { "amount": number, "unit": string, "daily_value_percentage": number } },
    "fiber": { "amount": number, "unit": "g", "daily_value_percentage": number },
    "added_sugars": { "amount": number, "unit": "g", "daily_value_percentage": number }
  },
  "health_analysis": {
    "health_score": { "score": number, "explanation": string, "factors": string[] },
    "benefits": string[],
    "considerations": string[],
    "allergens": string[],
    "processing_level": string
  },
  "recommendations": {
    "serving_suggestions": string[],
    "healthier_alternatives": string[],
    "local_options": string[],
    "meal_timing": { "best_time": string, "reason": string }
  },
  "source_reliability": "verified",
  "meal_type": "breakfast" | "lunch" | "dinner" | "snack"
}`;

class NutritionAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NutritionAnalysisError';
  }
}

const handleError = (error: unknown): never => {
  if (error instanceof Error) {
    throw new NutritionAnalysisError(error.message);
  }
  throw new NutritionAnalysisError('An unknown error occurred');
};

const formatAIResponse = (responseText: string): NutritionAnalysis => {
  try {
    // Remove markdown code block if present
    let cleanResponse = responseText;
    if (responseText.startsWith('```json')) {
      cleanResponse = responseText
        .replace(/^```json\n/, '') // Remove starting ```json
        .replace(/\n```$/, '');    // Remove ending ```
    }
    
    console.log('🧹 Cleaned response:', cleanResponse);
    const parsedResponse = JSON.parse(cleanResponse);
    
    // Validate required fields
    if (!parsedResponse.analysis_type || !parsedResponse.basic_info || !parsedResponse.nutritional_content) {
      throw new Error('Missing required fields in response');
    }
    
    return parsedResponse as NutritionAnalysis;
  } catch (error) {
    console.error('❌ Parse error:', error);
    throw new NutritionAnalysisError('Failed to parse AI response: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
};

const updateDailyProgress = async (userId: string, nutritionalContent: NutritionAnalysis['nutritional_content']): Promise<NutritionProgress> => {
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

const storeAnalysisResult = async (
  userId: string,
  analysis: NutritionAnalysis
): Promise<void> => {
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

export const analyzeNutritionWithDeepSeek = async (
  foodDescription: string,
  userId: string
): Promise<{ analysis: NutritionAnalysis; progress: NutritionProgress }> => {
  try {
    console.log('🚀 Starting DeepSeek analysis for:', foodDescription);
    console.log('👤 User ID:', userId);

    console.log('📡 Making API call to DeepSeek...');
    const completion = await together.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this food: ${foodDescription}` }
      ],
      model: "deepseek-ai/DeepSeek-V3",
      temperature: 0.3, // Reduced for more consistent outputs
      max_tokens: 1000, // Reduced since we need less tokens
      top_p: 0.9,
      frequency_penalty: 0.2,
      presence_penalty: 0.1
    });

    console.log('🤖 DeepSeek API Response:', {
      id: completion.id,
      model: completion.model,
      choices: completion.choices?.map(c => ({
        role: c.message?.role,
        contentLength: c.message?.content?.length,
        finishReason: c.finish_reason
      }))
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      console.error('❌ No response content from DeepSeek');
      throw new NutritionAnalysisError('No response from AI model');
    }

    try {
      // Parse and validate the response
      console.log('🔄 Parsing DeepSeek response...');
      const analysis = formatAIResponse(response);
      console.log('✨ Formatted analysis:', JSON.stringify(analysis, null, 2));

      // Store the analysis result
      console.log('💾 Storing analysis result in Supabase...');
      await storeAnalysisResult(userId, analysis);
      console.log('✅ Analysis stored successfully');

      // Update and get daily progress
      console.log('📊 Updating daily progress in Redis...');
      const progress = await updateDailyProgress(userId, analysis.nutritional_content);
      console.log('✅ Progress updated:', progress);

      console.log('🎉 Analysis complete!');
      return { analysis, progress };
    } catch (parseError) {
      console.error('❌ Error parsing DeepSeek response:', parseError);
      console.error('Raw response that failed parsing:', response);
      throw new NutritionAnalysisError('Failed to parse nutrition analysis: ' + (parseError instanceof Error ? parseError.message : 'Unknown error'));
    }
  } catch (error) {
    console.error('❌ DeepSeek analysis error:', error);
    return handleError(error);
  }
};
