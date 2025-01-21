import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  ViewProps,
  Pressable,
  PressableProps,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

interface CardProps extends ViewProps {
  style?: ViewStyle;
  onPress?: PressableProps['onPress'];
  gradient?: boolean;
  variant?: 'default' | 'elevated' | 'outlined';
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Card({ 
  children, 
  style, 
  onPress, 
  gradient = false, 
  variant = 'default',
  ...props 
}: CardProps) {
  const getVariantStyle = () => {
    switch (variant) {
      case 'elevated':
        return styles.elevated;
      case 'outlined':
        return styles.outlined;
      default:
        return styles.default;
    }
  };

  const content = (
    <View
      style={[
        styles.card,
        getVariantStyle(),
        style,
      ]}
      {...props}
    >
      {gradient ? (
        <LinearGradient
          colors={['rgba(59, 130, 246, 0.15)', 'rgba(14, 165, 233, 0.15)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.gradient]}
        />
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        style={({ pressed }: { pressed: boolean }) => [
          styles.pressable,
          {
            transform: [
              { scale: pressed ? 0.98 : 1 },
            ],
          },
        ]}
      >
        {content}
      </AnimatedPressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  default: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  elevated: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  gradient: {
    borderRadius: 20,
  },
  content: {
    padding: 16,
  },
  pressable: {
    transform: [{ scale: 1 }],
  },
});