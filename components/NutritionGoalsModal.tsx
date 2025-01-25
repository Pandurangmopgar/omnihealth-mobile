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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
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
                />
              </View>
            </View>

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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  inputContainer: {
    flex: 1,
    gap: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  saveButton: {
    marginTop: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
