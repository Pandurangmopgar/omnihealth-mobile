export interface NutritionGoals {
  calories?: {
    target: number;
    min?: number;
    max?: number;
  };
  protein?: {
    target: number;
    min?: number;
    max?: number;
  };
  carbs?: {
    target: number;
    min?: number;
    max?: number;
  };
  fat?: {
    target: number;
    min?: number;
    max?: number;
  };
}

export interface MacroNutrient {
  amount: number;
  unit: string;
  daily_value_percentage: number;
}

export interface NutritionalContent {
  calories: number;
  macronutrients: {
    protein: MacroNutrient;
    carbs: MacroNutrient;
    fats: MacroNutrient;
  };
}

export interface DailyProgress {
  date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  meal_entries?: {
    meal_type: string;
    food_name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    timestamp: string;
  }[];
}

export interface NutritionAnalysis {
  analysis_type: 'text' | 'image';
  basic_info: {
    food_name: string;
    portion_size?: string;
    preparation_method?: string;
    total_servings?: number;
  };
  nutritional_content: NutritionalContent;
  health_analysis?: {
    benefits: string[];
    considerations: string[];
    allergens: string[];
    processing_level?: string;
  };
  recommendations?: {
    serving_suggestions: string[];
    healthier_alternatives: string[];
    local_options: string[];
  };
  source_reliability: 'verified' | 'estimated';
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}