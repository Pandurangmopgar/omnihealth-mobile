declare module 'expo-status-bar' {
  export interface StatusBarProps {
    style?: 'auto' | 'inverted' | 'light' | 'dark';
    animated?: boolean;
  }
  export const StatusBar: React.FC<StatusBarProps>;
}

declare module 'expo-linear-gradient' {
  import { ViewProps } from 'react-native';
  export interface LinearGradientProps extends ViewProps {
    colors: string[];
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    locations?: number[];
  }
  export const LinearGradient: React.FC<LinearGradientProps>;
}

declare module 'expo-blur' {
  import { ViewProps } from 'react-native';
  export interface BlurViewProps extends ViewProps {
    intensity?: number;
    tint?: 'light' | 'dark' | 'default';
  }
  export const BlurView: React.FC<BlurViewProps>;
}

declare module 'react-native-reanimated-carousel' {
  import { ViewProps } from 'react-native';
  export interface CarouselProps<T> extends ViewProps {
    data: T[];
    renderItem: ({ item }: { item: T }) => React.ReactElement;
    width: number;
    height: number;
    loop?: boolean;
  }
  export default function Carousel<T>(props: CarouselProps<T>): React.ReactElement;
} 