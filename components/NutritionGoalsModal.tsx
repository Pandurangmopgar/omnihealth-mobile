import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ActionSheet, { ActionSheetRef } from 'react-native-actions-sheet';
import { NutritionGoals, NutritionGoalInput } from '../services/nutritionGoals';
import { calculateAINutritionGoals, AIGoalCalculationInput } from '../services/aiNutritionGoals';

type Gender = 'male' | 'female';
type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'super_active';
type HealthGoal = 'maintain' | 'lose' | 'gain';

interface CustomGoals {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

interface NutritionGoalsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (goals: NutritionGoals) => Promise<void>;
  initialGoals?: NutritionGoals;
}

const defaultGoals: NutritionGoals = {
  daily_calories: 2000,
  daily_protein: 150,
  daily_carbs: 250,
  daily_fat: 70,
};

const defaultCustomGoals: CustomGoals = {
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
};

const defaultAIInput: AIGoalCalculationInput = {
  age: 0,
  gender: 'male',
  weight: 0,
  height: 0,
  activityLevel: 'moderately_active',
  healthGoal: 'maintain',
  dietaryRestrictions: []
};

interface ActionSheetConfig {
  title: string;
  options: { label: string; value: string }[];
  onSelect: (value: string) => void;
}

export const NutritionGoalsModal: React.FC<NutritionGoalsModalProps> = ({
  visible,
  onClose,
  onSave,
  initialGoals,
}) => {
  const [activeTab, setActiveTab] = useState<'custom' | 'ai'>('custom');
  const [customGoals, setCustomGoals] = useState<CustomGoals>(() => ({
    calories: (initialGoals?.daily_calories || defaultGoals.daily_calories).toString(),
    protein: (initialGoals?.daily_protein || defaultGoals.daily_protein).toString(),
    carbs: (initialGoals?.daily_carbs || defaultGoals.daily_carbs).toString(),
    fat: (initialGoals?.daily_fat || defaultGoals.daily_fat).toString(),
  }));
  const [aiFormData, setAiFormData] = useState<AIGoalCalculationInput>(defaultAIInput);
  const [isLoading, setIsLoading] = useState(false);
  const [actionSheetConfig, setActionSheetConfig] = useState<ActionSheetConfig | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 3;
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const actionSheetRef = useRef<ActionSheetRef>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const showOptionPicker = (
    title: string,
    options: { label: string; value: string }[],
    onSelect: (value: string) => void
  ) => {
    setActionSheetConfig({ title, options, onSelect });
    actionSheetRef.current?.show();
  };

  const handleSave = async () => {
    if (!validateCustomGoals()) return;
    setIsLoading(true);
    try {
      const nutritionGoals: NutritionGoals = {
        daily_calories: parseInt(customGoals.calories),
        daily_protein: parseInt(customGoals.protein),
        daily_carbs: parseInt(customGoals.carbs),
        daily_fat: parseInt(customGoals.fat),
      };
      await onSave(nutritionGoals);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to save nutrition goals. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const validateCustomGoals = (): boolean => {
    const fields = [
      { name: 'Calories', value: customGoals.calories },
      { name: 'Protein', value: customGoals.protein },
      { name: 'Carbs', value: customGoals.carbs },
      { name: 'Fat', value: customGoals.fat },
    ];

    for (const field of fields) {
      const value = parseInt(field.value);
      if (!field.value.trim() || isNaN(value) || value <= 0) {
        Alert.alert('Invalid Input', `${field.name} must be a positive number`);
        return false;
      }
    }
    return true;
  };

  const validateAIForm = (): boolean => {
    if (aiFormData.age <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid age');
      return false;
    }
    if (aiFormData.weight <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid weight');
      return false;
    }
    if (aiFormData.height <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid height');
      return false;
    }
    return true;
  };

  const handleAICalculation = () => {
    if (!validateAIForm()) return;
    
    try {
      const calculatedGoals = calculateAINutritionGoals(aiFormData);
      setCustomGoals({
        calories: calculatedGoals.daily_calories.toString(),
        protein: calculatedGoals.daily_protein.toString(),
        carbs: calculatedGoals.daily_carbs.toString(),
        fat: calculatedGoals.daily_fat.toString(),
      });
      setActiveTab('custom');
    } catch (error) {
      console.error('Error calculating goals:', error);
      Alert.alert('Error', 'Failed to calculate nutrition goals. Please try again.');
    }
  };

  const handleGenderSelect = (value: string) => {
    if (value === 'male' || value === 'female') {
      setAiFormData({ ...aiFormData, gender: value });
    }
  };

  const handleActivityLevelSelect = (value: string) => {
    if (['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'super_active'].includes(value)) {
      setAiFormData({ ...aiFormData, activityLevel: value as ActivityLevel });
    }
  };

  const handleHealthGoalSelect = (value: string) => {
    if (['maintain', 'lose', 'gain'].includes(value)) {
      setAiFormData({ ...aiFormData, healthGoal: value as HealthGoal });
    }
  };

  const renderCustomForm = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.inputContainer}>
        <View style={styles.inputGroup}>
          <View style={styles.labelContainer}>
            <Text style={styles.label}>Daily Calories</Text>
            <Text style={styles.currentValue}>
              Current: {initialGoals?.daily_calories || defaultGoals.daily_calories}
            </Text>
          </View>
          <TextInput
            style={styles.input}
            value={customGoals.calories}
            onChangeText={(text) => setCustomGoals({ ...customGoals, calories: text })}
            keyboardType="numeric"
            placeholder="Enter calories"
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelContainer}>
            <Text style={styles.label}>Daily Protein (g)</Text>
            <Text style={styles.currentValue}>
              Current: {initialGoals?.daily_protein || defaultGoals.daily_protein}g
            </Text>
          </View>
          <TextInput
            style={styles.input}
            value={customGoals.protein}
            onChangeText={(text) => setCustomGoals({ ...customGoals, protein: text })}
            keyboardType="numeric"
            placeholder="Enter protein"
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelContainer}>
            <Text style={styles.label}>Daily Carbs (g)</Text>
            <Text style={styles.currentValue}>
              Current: {initialGoals?.daily_carbs || defaultGoals.daily_carbs}g
            </Text>
          </View>
          <TextInput
            style={styles.input}
            value={customGoals.carbs}
            onChangeText={(text) => setCustomGoals({ ...customGoals, carbs: text })}
            keyboardType="numeric"
            placeholder="Enter carbs"
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelContainer}>
            <Text style={styles.label}>Daily Fat (g)</Text>
            <Text style={styles.currentValue}>
              Current: {initialGoals?.daily_fat || defaultGoals.daily_fat}g
            </Text>
          </View>
          <TextInput
            style={styles.input}
            value={customGoals.fat}
            onChangeText={(text) => setCustomGoals({ ...customGoals, fat: text })}
            keyboardType="numeric"
            placeholder="Enter fat"
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <LinearGradient
            colors={['#4C6EF5', '#3D5AFE']}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Saving...' : 'Save Goals'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressSteps}>
        {Array(totalSteps).fill(0).map((_, index) => (
          <React.Fragment key={index}>
            {index > 0 && <View style={[styles.progressLine, index <= currentStep && styles.progressLineActive]} />}
            <TouchableOpacity 
              onPress={() => setCurrentStep(index)}
              style={[styles.progressDot, index <= currentStep && styles.progressDotActive]}
            >
              <Text style={[styles.progressNumber, index <= currentStep && styles.progressNumberActive]}>
                {index + 1}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>
      <View style={styles.progressLabels}>
        <Text style={styles.progressLabel}>Basic Info</Text>
        <Text style={styles.progressLabel}>Body Stats</Text>
        <Text style={styles.progressLabel}>Lifestyle</Text>
      </View>
    </View>
  );

  const renderBasicInfoStep = () => (
    <Animated.View style={styles.stepCard}>
      <View style={styles.stepHeader}>
        <Ionicons name="person" size={24} color="#4C6EF5" />
        <Text style={styles.stepTitle}>Tell us about yourself</Text>
      </View>
      <View style={styles.stepContent}>
        <View style={styles.aiInputRow}>
          <View style={[styles.aiInput, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={aiFormData.age > 0 ? aiFormData.age.toString() : ''}
              onChangeText={(value) => setAiFormData({ ...aiFormData, age: parseInt(value) || 0 })}
              placeholder="Enter age"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
            />
          </View>
          <View style={[styles.aiInput, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Gender</Text>
            <TouchableOpacity 
              style={styles.selectButton}
              onPress={() => {
                showOptionPicker(
                  'Select Gender',
                  [
                    { label: 'Male', value: 'male' },
                    { label: 'Female', value: 'female' },
                  ],
                  handleGenderSelect
                );
              }}
            >
              <Text style={styles.selectButtonText}>
                {aiFormData.gender === 'male' ? 'Male' : 'Female'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  const renderBodyStatsStep = () => (
    <Animated.View style={styles.stepCard}>
      <View style={styles.stepHeader}>
        <Ionicons name="fitness" size={24} color="#4C6EF5" />
        <Text style={styles.stepTitle}>Your body measurements</Text>
      </View>
      <View style={styles.stepContent}>
        <View style={styles.aiInputRow}>
          <View style={[styles.aiInput, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={aiFormData.weight > 0 ? aiFormData.weight.toString() : ''}
              onChangeText={(value) => setAiFormData({ ...aiFormData, weight: parseInt(value) || 0 })}
              placeholder="Enter weight"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
            />
          </View>
          <View style={[styles.aiInput, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={aiFormData.height > 0 ? aiFormData.height.toString() : ''}
              onChangeText={(value) => setAiFormData({ ...aiFormData, height: parseInt(value) || 0 })}
              placeholder="Enter height"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );

  const renderLifestyleStep = () => (
    <Animated.View style={styles.stepCard}>
      <View style={styles.stepHeader}>
        <Ionicons name="trending-up" size={24} color="#4C6EF5" />
        <Text style={styles.stepTitle}>Your lifestyle & goals</Text>
      </View>
      <View style={styles.stepContent}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Activity Level</Text>
          <TouchableOpacity 
            style={styles.selectButton}
            onPress={() => {
              showOptionPicker(
                'Select Activity Level',
                [
                  { label: 'Sedentary (little/no exercise)', value: 'sedentary' },
                  { label: 'Lightly Active (1-3 days/week)', value: 'lightly_active' },
                  { label: 'Moderately Active (3-5 days/week)', value: 'moderately_active' },
                  { label: 'Very Active (6-7 days/week)', value: 'very_active' },
                  { label: 'Super Active (athlete/physical job)', value: 'super_active' },
                ],
                handleActivityLevelSelect
              );
            }}
          >
            <Text style={styles.selectButtonText}>
              {aiFormData.activityLevel === 'sedentary' ? 'Sedentary (little/no exercise)' :
               aiFormData.activityLevel === 'lightly_active' ? 'Lightly Active (1-3 days/week)' :
               aiFormData.activityLevel === 'moderately_active' ? 'Moderately Active (3-5 days/week)' :
               aiFormData.activityLevel === 'very_active' ? 'Very Active (6-7 days/week)' :
               'Super Active (athlete/physical job)'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Health Goal</Text>
          <TouchableOpacity 
            style={styles.selectButton}
            onPress={() => {
              showOptionPicker(
                'Select Health Goal',
                [
                  { label: 'Maintain Weight', value: 'maintain' },
                  { label: 'Lose Weight', value: 'lose' },
                  { label: 'Gain Weight', value: 'gain' },
                ],
                handleHealthGoalSelect
              );
            }}
          >
            <Text style={styles.selectButtonText}>
              {aiFormData.healthGoal === 'maintain' ? 'Maintain Weight' :
               aiFormData.healthGoal === 'lose' ? 'Lose Weight' :
               'Gain Weight'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  const renderAIForm = () => {
    return (
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.aiFormContainer}>
          {renderProgressBar()}
          
          {currentStep === 0 && renderBasicInfoStep()}
          {currentStep === 1 && renderBodyStatsStep()}
          {currentStep === 2 && renderLifestyleStep()}

          <View style={styles.navigationButtons}>
            {currentStep > 0 && (
              <TouchableOpacity
                style={[styles.navButton, styles.backButton]}
                onPress={() => setCurrentStep(currentStep - 1)}
              >
                <Ionicons name="arrow-back" size={20} color="#fff" />
                <Text style={styles.navButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            
            {currentStep < totalSteps - 1 ? (
              <TouchableOpacity
                style={[styles.navButton, styles.nextButton]}
                onPress={() => setCurrentStep(currentStep + 1)}
              >
                <Text style={styles.navButtonText}>Next</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.navButton, styles.calculateButton]}
                onPress={handleAICalculation}
              >
                <Text style={styles.navButtonText}>Calculate</Text>
                <Ionicons name="calculator" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={['#0A1128', '#1E3A8A']}
            style={styles.gradientContainer}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Nutrition Goals</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'custom' && styles.activeTab]}
                onPress={() => setActiveTab('custom')}
              >
                <Text style={[styles.tabText, activeTab === 'custom' && styles.activeTabText]}>
                  Set Custom Goals
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'ai' && styles.activeTab]}
                onPress={() => setActiveTab('ai')}
              >
                <Text style={[styles.tabText, activeTab === 'ai' && styles.activeTabText]}>
                  Calculate with AI
                </Text>
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView 
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.formContainer}
            >
              {activeTab === 'custom' ? renderCustomForm() : renderAIForm()}
            </KeyboardAvoidingView>
          </LinearGradient>
        </View>

        <ActionSheet
          ref={actionSheetRef}
          containerStyle={styles.actionSheet}
          indicatorStyle={styles.actionSheetIndicator}
        >
          <View style={styles.actionSheetContent}>
            <Text style={styles.actionSheetTitle}>{actionSheetConfig?.title}</Text>
            {actionSheetConfig?.options.map((option, index) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.actionSheetOption,
                  index === actionSheetConfig.options.length - 1 && styles.actionSheetOptionLast
                ]}
                onPress={() => {
                  actionSheetConfig?.onSelect(option.value);
                  actionSheetRef.current?.hide();
                }}
              >
                <Text style={styles.actionSheetOptionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.actionSheetOption, styles.actionSheetCancel]}
              onPress={() => actionSheetRef.current?.hide()}
            >
              <Text style={styles.actionSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ActionSheet>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0A1128',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    minHeight: '85%',
    width: '100%',
  },
  gradientContainer: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  formContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  inputContainer: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  currentValue: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  selectButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonGradient: {
    padding: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  aiFormContainer: {
    flex: 1,
    paddingBottom: 24,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    backgroundColor: '#4C6EF5',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 4,
  },
  progressLineActive: {
    backgroundColor: '#4C6EF5',
  },
  progressNumber: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  progressNumberActive: {
    color: '#fff',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginTop: 8,
  },
  progressLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
    flex: 1,
  },
  stepCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  stepTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  stepContent: {
    marginTop: 8,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  nextButton: {
    backgroundColor: '#4C6EF5',
  },
  calculateButton: {
    backgroundColor: '#4C6EF5',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginHorizontal: 8,
  },
  actionSheet: {
    backgroundColor: '#0A1128',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  actionSheetIndicator: {
    backgroundColor: '#4B5563',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
  actionSheetContent: {
    padding: 16,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  actionSheetOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(75, 85, 99, 0.2)',
  },
  actionSheetOptionLast: {
    borderBottomWidth: 0,
  },
  actionSheetOptionText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  actionSheetCancel: {
    marginTop: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
  },
  actionSheetCancelText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    fontWeight: '600',
  },
  aiInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
  },
});
