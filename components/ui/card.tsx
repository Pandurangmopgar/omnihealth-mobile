import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  ViewProps,
  Pressable,
  PressableProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface CardProps extends ViewProps {
  style?: ViewStyle;
  onPress?: PressableProps['onPress'];
  gradient?: boolean;
}

export function Card({ children, style, onPress, gradient = false, ...props }: CardProps) {
  const CardContainer = onPress ? Pressable : View;

  const content = (
    <View
      style={[
        styles.card,
        style,
      ]}
      {...props}
    >
      {gradient ? (
        <LinearGradient
          colors={['rgba(59, 130, 246, 0.1)', 'rgba(14, 165, 233, 0.1)']}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );

  if (onPress) {
    return (
      <CardContainer
        onPress={onPress}
        style={({ pressed }: { pressed: boolean }) => [
          styles.pressable,
          pressed && styles.pressed,
        ]}
      >
        {content}
      </CardContainer>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
  },
  content: {
    padding: 16,
  },
  pressable: {
    transform: [{ scale: 1 }],
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
}); 