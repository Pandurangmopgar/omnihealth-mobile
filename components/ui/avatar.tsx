import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  ViewStyle,
  ImageSourcePropType,
  Text,
} from 'react-native';

interface AvatarProps {
  source?: ImageSourcePropType;
  size?: number;
  fallback?: string;
  style?: ViewStyle;
}

export function Avatar({ source, size = 40, fallback, style }: AvatarProps) {
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const imageStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const fallbackStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    fontSize: size * 0.4,
  };

  if (!source && !fallback) {
    return null;
  }

  return (
    <View style={[styles.container, containerStyle, style]}>
      {source ? (
        <Image
          source={source}
          style={[styles.image, imageStyle]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.fallback, fallbackStyle]}>
          <Text style={[styles.fallbackText, { fontSize: size * 0.4 }]}>
            {fallback?.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  image: {
    flex: 1,
  },
  fallback: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
}); 