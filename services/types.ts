export interface NutrientInfo {
  amount: number;
  unit: string;
  daily_value_percentage: number | null;
}

export interface MealTiming {
  hour: number;
  minute: number;
}

export interface NutritionProgress {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals_logged: number;
}

export interface NutritionAnalysis {
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
