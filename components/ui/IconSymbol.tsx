// This file is a fallback for using MaterialIcons on Android and web.

import React from 'react';
import { Ionicons } from '@expo/vector-icons';

interface IconSymbolProps {
  name: string;
  size: number;
  color: string;
}

export function IconSymbol({ name, size, color }: IconSymbolProps) {
  const getIconName = (baseName: string): keyof typeof Ionicons.glyphMap => {
    // Convert SF Symbols naming to Ionicons naming
    switch (baseName) {
      case 'house.fill':
        return 'home-outline';
      case 'paperplane.fill':
        return 'paper-plane-outline';
      default:
        return 'help-circle-outline';
    }
  };

  return <Ionicons name={getIconName(name)} size={size} color={color} />;
}
