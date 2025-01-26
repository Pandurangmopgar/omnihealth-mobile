import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Modal } from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

interface NutritionAnalyzerOnboardingProps {
  visible: boolean;
  onClose: () => void;
}

const AnimatedStep = ({ delay, children }: { delay: number; children: React.ReactNode }) => (
  <MotiView
    from={{ opacity: 0, translateY: 20 }}
    animate={{ opacity: 1, translateY: 0 }}
    transition={{ delay, type: 'timing', duration: 1000 }}
  >
    {children}
  </MotiView>
);

export const NutritionAnalyzerOnboarding: React.FC<NutritionAnalyzerOnboardingProps> = ({
  visible,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = [
    {
      title: 'Scan Your Food',
      description: 'Take a photo or describe your meal to get instant nutritional analysis',
      icon: 'camera',
    },
    {
      title: 'Track Progress',
      description: 'Monitor your daily nutrition goals with beautiful visualizations',
      icon: 'bar-chart',
    },
    {
      title: 'Smart Recommendations',
      description: 'Get personalized meal suggestions and timing recommendations',
      icon: 'nutrition',
    },
    {
      title: 'Health Insights',
      description: 'Understand the health impact of your food choices',
      icon: 'fitness',
    },
  ];

  const renderAnimatedFood = () => (
    <MotiView
      style={styles.animationContainer}
      from={{
        scale: 0.8,
        translateY: 0,
      }}
      animate={{
        scale: 1,
        translateY: [-20, 0],
      }}
      transition={{
        type: 'timing',
        duration: 2000,
        loop: true,
      }}
    >
      <Ionicons
        name={steps[currentStep].icon}
        size={100}
        color="#4F46E5"
      />
    </MotiView>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={styles.container}>
        <Animated.View
          entering={FadeInDown}
          exiting={FadeOutDown}
          style={styles.content}
        >
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>

          {renderAnimatedFood()}

          <AnimatedStep delay={500}>
            <Text style={styles.title}>{steps[currentStep].title}</Text>
          </AnimatedStep>

          <AnimatedStep delay={1000}>
            <Text style={styles.description}>{steps[currentStep].description}</Text>
          </AnimatedStep>

          <View style={styles.dotsContainer}>
            {steps.map((_, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setCurrentStep(index)}
                style={[
                  styles.dot,
                  currentStep === index && styles.activeDot,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              if (currentStep < steps.length - 1) {
                setCurrentStep(currentStep + 1);
              } else {
                onClose();
              }
            }}
          >
            <Text style={styles.buttonText}>
              {currentStep < steps.length - 1 ? 'Next' : 'Get Started'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  content: {
    width: width * 0.9,
    backgroundColor: '#1F2937',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 1,
  },
  animationContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4B5563',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#4F46E5',
    width: 20,
  },
  button: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
    width: '80%',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
