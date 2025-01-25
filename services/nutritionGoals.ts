// import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

export interface NutritionGoals {
  daily_calories: number;
  daily_protein: number;
  daily_carbs: number;
  daily_fat: number;
}

export interface NutritionGoalInput {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

export const fetchUserNutritionGoals = async (userId: string): Promise<NutritionGoals | null> => {
  try {
    const { data: goals, error } = await supabase
      .from('nutrition_goals')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;

    if (goals) {
      return {
        daily_calories: goals.calories_target,
        daily_protein: goals.protein_target,
        daily_carbs: goals.carbs_target,
        daily_fat: goals.fat_target,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching nutrition goals:', error);
    throw error;
  }
};

export const updateUserNutritionGoals = async (
  userId: string,
  goals: NutritionGoalInput
): Promise<void> => {
  try {
    const goalsData = {
      user_id: userId,
      calories_target: parseInt(goals.calories),
      protein_target: parseInt(goals.protein),
      carbs_target: parseInt(goals.carbs),
      fat_target: parseInt(goals.fat),
      start_date: new Date().toISOString(),
    };

    // First, insert the new goals
    const { error: insertError } = await supabase
      .from('nutrition_goals')
      .insert(goalsData);

    if (insertError) throw insertError;

  } catch (error) {
    console.error('Error updating nutrition goals:', error);
    throw error;
  }
};
