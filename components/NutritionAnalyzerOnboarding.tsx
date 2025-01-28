import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Modal, Pressable } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeInDown, 
  FadeOutDown,
  interpolate,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
  withSequence,
  
  withDelay
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface NutritionAnalyzerOnboardingProps {
  visible: boolean;
  onClose: () => void;
}

const AnimatedStep = ({ delay, children, index, currentStep }: { 
  delay: number; 
  children: React.ReactNode;
  index: number;
  currentStep: number;
}) => {
  const isActive = index === currentStep;
  const wasActive = index === currentStep - 1;

  return (
    <MotiView
      from={{ 
        opacity: 0, 
        scale: 0.9,
        translateY: 20 
      }}
      animate={{ 
        opacity: isActive ? 1 : 0,
        scale: isActive ? 1 : 0.9,
        translateY: isActive ? 0 : wasActive ? -20 : 20
      }}
      transition={{ 
        type: 'timing',
        duration: 600,
        delay: isActive ? delay : 0,
      }}
      style={{
        position: 'absolute',
        width: '100%',
        alignItems: 'center'
      }}
    >
      {children}
    </MotiView>
  );
};

const FloatingElement = ({ children, index }: { children: React.ReactNode; index: number }) => {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    translateY.value = withSequence(
      withTiming(10, { duration: 1500 }),
      withTiming(-10, { duration: 1500 }),
    );
    
    scale.value = withSequence(
      withTiming(1.1, { duration: 1500 }),
      withTiming(1, { duration: 1500 }),
    );

    const interval = setInterval(() => {
      translateY.value = withSequence(
        withTiming(10, { duration: 1500 }),
        withTiming(-10, { duration: 1500 }),
      );
      
      scale.value = withSequence(
        withTiming(1.1, { duration: 1500 }),
        withTiming(1, { duration: 1500 }),
      );
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { scale: scale.value }
      ],
    };
  });

  return (
    <Animated.View style={[animatedStyle, { position: 'absolute' }]}>
      {children}
    </Animated.View>
  );
};

export const NutritionAnalyzerOnboarding: React.FC<NutritionAnalyzerOnboardingProps> = ({
  visible,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const progress = useSharedValue(0);

  const steps = [
    {
      title: 'Scan Your Food',
      description: 'Take a photo or describe your meal to get instant nutritional analysis',
      icon: 'camera',
      gradient: ['#4F46E5', '#818CF8'],
    },
    {
      title: 'Track Progress',
      description: 'Monitor your daily nutrition goals with beautiful visualizations',
      icon: 'bar-chart',
      gradient: ['#059669', '#34D399'],
    },
    {
      title: 'Smart Recommendations',
      description: 'Get personalized meal suggestions and timing recommendations',
      icon: 'nutrition',
      gradient: ['#DC2626', '#F87171'],
    },
    {
      title: 'Health Insights',
      description: 'Understand the health impact of your food choices',
      icon: 'fitness',
      gradient: ['#7C3AED', '#A78BFA'],
    },
  ];

  useEffect(() => {
    if (visible) {
      const interval = setInterval(() => {
        setCurrentStep((prev) => (prev + 1) % steps.length);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [visible, steps.length]);

  const handleNext = () => {
    setCurrentStep((prev) => (prev + 1) % steps.length);
  };

  const isLastStep = currentStep === steps.length - 1;

  useEffect(() => {
    progress.value = withSpring(currentStep / (steps.length - 1));
  }, [currentStep]);

  const renderAnimatedIcon = (step: typeof steps[0], index: number) => (
    <MotiView
      key={index}
      style={[styles.iconContainer]}
      from={{
        opacity: 0,
        scale: 0.5,
      }}
      animate={{
        opacity: currentStep === index ? 1 : 0,
        scale: currentStep === index ? 1 : 0.5,
      }}
      transition={{
        type: 'spring',
        damping: 15,
        stiffness: 150,
      }}
    >
      <LinearGradient
        colors={step.gradient}
        style={styles.iconGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <FloatingElement index={index}>
          <Ionicons
            name={step.icon}
            size={80}
            color="#fff"
          />
        </FloatingElement>
      </LinearGradient>
    </MotiView>
  );

  const progressBarWidth = useAnimatedStyle(() => ({
    width: withSpring(interpolate(progress.value, [0, 1], [20, width * 0.8])),
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={styles.container}>
        <Animated.View
          entering={FadeInDown.springify()}
          exiting={FadeOutDown.springify()}
          style={styles.content}
        >
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={onClose}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <View style={styles.closeButtonCircle}>
              <Ionicons name="close" size={24} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={styles.animationContainer}>
            {steps.map((step, index) => renderAnimatedIcon(step, index))}
          </View>

          <View style={styles.contentContainer}>
            {steps.map((step, index) => (
              <AnimatedStep 
                key={index} 
                delay={300} 
                index={index}
                currentStep={currentStep}
              >
                <Text style={styles.title}>{step.title}</Text>
                <Text style={styles.description}>{step.description}</Text>
              </AnimatedStep>
            ))}
          </View>

          <View style={styles.progressContainer}>
            <Animated.View style={[styles.progressBar, progressBarWidth]} />
          </View>

          <View style={styles.buttonContainer}>
            {!isLastStep ? (
              <TouchableOpacity 
                style={[styles.button, styles.nextButton]}
                onPress={handleNext}
              >
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Next</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.buttonIcon} />
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.button, styles.getStartedButton]}
                onPress={onClose}
              >
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Get Started</Text>
                  <Ionicons name="checkmark" size={20} color="#fff" style={styles.buttonIcon} />
                </View>
              </TouchableOpacity>
            )}
          </View>
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
    height: height * 0.7,
    backgroundColor: '#1F2937',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 1,
  },
  closeButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animationContainer: {
    height: height * 0.25,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  iconContainer: {
    position: 'absolute',
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 20,
  },
  description: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  progressContainer: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginBottom: 30,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 2,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    width: '80%',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  nextButton: {
    backgroundColor: '#4F46E5',
  },
  getStartedButton: {
    backgroundColor: '#059669',
  },
});
