import React from 'react';
import { GestureResponderEvent } from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';

export function HapticTab({
  onPressIn,
  ...rest
}: {
  onPressIn?: (e: GestureResponderEvent) => void;
} & Omit<BottomTabBarButtonProps, 'onPressIn'>) {
  const handlePressIn = (ev: GestureResponderEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPressIn?.(ev);
  };

  return (
    <PlatformPressable
      onPressIn={handlePressIn}
      {...rest}
    />
  );
}
