// This file is a fallback for using MaterialIcons on Android and web.

import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleProp, ViewStyle } from 'react-native';

export interface IconSymbolProps {
  name: string;
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}

const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  'house.fill': 'home',
  'house': 'home-outline',
  'person.fill': 'person',
  'person': 'person-outline',
  'chevron.right': 'chevron-forward',
  'chevron-forward': 'chevron-forward-outline',
  'paperplane.fill': 'paper-plane',
  'paperplane': 'paper-plane-outline',
  'chart.bar.fill': 'bar-chart',
  'chart.bar': 'bar-chart-outline',
  'heart.fill': 'heart',
  'heart': 'heart-outline',
  'star.fill': 'star',
  'star': 'star-outline',
  'gear': 'settings-outline',
  'gear.fill': 'settings',
  'bell': 'notifications-outline',
  'bell.fill': 'notifications',
  'calendar': 'calendar-outline',
  'calendar.fill': 'calendar',
  'list.bullet': 'list-outline',
  'list.bullet.fill': 'list',
};

export function IconSymbol({ name, size, color, style }: IconSymbolProps) {
  const getIconName = (baseName: string): keyof typeof Ionicons.glyphMap => {
    return iconMap[baseName] || 'help-circle-outline';
  };

  return (
    <Ionicons 
      name={getIconName(name)} 
      size={size} 
      color={color}
      style={style}
    />
  );
}
