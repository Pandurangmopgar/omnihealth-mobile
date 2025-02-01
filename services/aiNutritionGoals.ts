import { NutritionGoals } from './nutritionGoals';

export interface AIGoalCalculationInput {
  age: number;
  gender: 'male' | 'female';
  weight: number; // in kg
  height: number; // in cm
  activityLevel: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'super_active';
  healthGoal: 'maintain' | 'lose' | 'gain';
  dietaryRestrictions?: string[];
}

const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  super_active: 1.9
};

export function calculateBMR(input: AIGoalCalculationInput): number {
  const { age, gender, weight, height } = input;
  const baseBMR = (10 * weight) + (6.25 * height) - (5 * age);
  return gender === 'male' ? baseBMR + 5 : baseBMR - 161;
}

export function calculateTotalCalories(input: AIGoalCalculationInput): number {
  const bmr = calculateBMR(input);
  const activityFactor = ACTIVITY_FACTORS[input.activityLevel];
  let totalCalories = bmr * activityFactor;

  // Adjust based on health goal
  switch (input.healthGoal) {
    case 'lose':
      totalCalories *= 0.85; // 15% deficit
      break;
    case 'gain':
      totalCalories *= 1.15; // 15% surplus
      break;
    default:
      // maintain weight
      break;
  }

  return Math.round(totalCalories);
}

export function calculateMacronutrients(calories: number, input: AIGoalCalculationInput): {
  protein: number;
  carbs: number;
  fat: number;
} {
  let proteinPercentage = 0.25; // Default 25%
  let fatPercentage = 0.3; // Default 30%
  let carbsPercentage = 0.45; // Default 45%

  // Adjust macros based on health goal
  if (input.healthGoal === 'gain') {
    proteinPercentage = 0.3;
    carbsPercentage = 0.5;
    fatPercentage = 0.2;
  } else if (input.healthGoal === 'lose') {
    proteinPercentage = 0.35;
    fatPercentage = 0.35;
    carbsPercentage = 0.3;
  }

  // Calculate grams of each macro
  const protein = Math.round((calories * proteinPercentage) / 4); // 4 calories per gram of protein
  const carbs = Math.round((calories * carbsPercentage) / 4); // 4 calories per gram of carbs
  const fat = Math.round((calories * fatPercentage) / 9); // 9 calories per gram of fat

  return { protein, carbs, fat };
}

export function calculateAINutritionGoals(input: AIGoalCalculationInput): NutritionGoals {
  const totalCalories = calculateTotalCalories(input);
  const macros = calculateMacronutrients(totalCalories, input);

  return {
    daily_calories: totalCalories,
    daily_protein: macros.protein,
    daily_carbs: macros.carbs,
    daily_fat: macros.fat
  };
}
