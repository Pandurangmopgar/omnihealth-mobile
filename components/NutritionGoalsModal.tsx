import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NutritionGoals, NutritionGoalInput } from '../services/nutritionGoals';

interface NutritionGoalsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (goals: NutritionGoalInput) => Promise<void>;
  initialGoals?: NutritionGoals;
}

export const NutritionGoalsModal: React.FC<NutritionGoalsModalProps> = ({
  visible,
  onClose,
  onSave,
  initialGoals,
}) => {
  const [goals, setGoals] = useState<NutritionGoalInput>({
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialGoals) {
      setGoals({
        calories: initialGoals.daily_calories.toString(),
        protein: initialGoals.daily_protein.toString(),
        carbs: initialGoals.daily_carbs.toString(),
        fat: initialGoals.daily_fat.toString(),
      });
    }
  }, [initialGoals]);

  const validateInput = (): boolean => {
    const fields = [
      { name: 'Calories', value: goals.calories },
      { name: 'Protein', value: goals.protein },
      { name: 'Carbs', value: goals.carbs },
      { name: 'Fat', value: goals.fat },
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

  const handleSave = async () => {
    if (!validateInput()) return;

    setIsLoading(true);
    try {
      await onSave(goals);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to save nutrition goals. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        >
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#0B1120', '#1A237E']}
              style={styles.gradientContainer}
            >
              <View style={styles.header}>
                <Text style={styles.title}>Set Nutrition Goals</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.inputContainer}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Daily Calories</Text>
                    <TextInput
                      style={styles.input}
                      value={goals.calories}
                      onChangeText={(text) => setGoals({ ...goals, calories: text })}
                      keyboardType="numeric"
                      placeholder="Enter calories"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Daily Protein (g)</Text>
                    <TextInput
                      style={styles.input}
                      value={goals.protein}
                      onChangeText={(text) => setGoals({ ...goals, protein: text })}
                      keyboardType="numeric"
                      placeholder="Enter protein"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Daily Carbs (g)</Text>
                    <TextInput
                      style={styles.input}
                      value={goals.carbs}
                      onChangeText={(text) => setGoals({ ...goals, carbs: text })}
                      keyboardType="numeric"
                      placeholder="Enter carbs"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Daily Fat (g)</Text>
                    <TextInput
                      style={styles.input}
                      value={goals.fat}
                      onChangeText={(text) => setGoals({ ...goals, fat: text })}
                      keyboardType="numeric"
                      placeholder="Enter fat"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  </View>
                </View>
              </ScrollView>

              <TouchableOpacity
                style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={['#4C6EF5', '#3D5AFE']}
                  style={styles.saveButtonGradient}
                >
                  <Text style={styles.saveButtonText}>
                    {isLoading ? 'Saving...' : 'Save Goals'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0B1120',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
  },
  gradientContainer: {
    flex: 1,
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
    marginBottom: 20,
  },
  inputContainer: {
    flex: 1,
    gap: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  saveButton: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonGradient: {
    padding: 15,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
