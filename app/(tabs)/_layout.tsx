import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function TabLayout() {
  const { isSignedIn } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0B1120',
          height: Platform.OS === 'ios' ? 85 : 65,
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: 'transparent',
          paddingBottom: Platform.OS === 'ios' ? 20 : 0,
          paddingTop: 10,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          borderWidth: 0,
        },
        tabBarBackground: () => (
          <LinearGradient
            colors={['#0B1120', '#1A237E']}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: '100%',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
            }}
          />
        ),
        tabBarActiveTintColor: '#4C6EF5',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: Platform.OS === 'ios' ? 0 : 10,
        },
        tabBarIconStyle: {
          marginTop: 5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "home" : "home-outline"}
              size={24}
              color={color}
              style={{
                transform: [{ scale: focused ? 1.1 : 1 }],
              }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="aiassistant"
        options={{
          title: 'Assistant',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "chatbubble" : "chatbubble-outline"}
              size={24}
              color={color}
              style={{
                transform: [{ scale: focused ? 1.1 : 1 }],
              }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "person" : "person-outline"}
              size={24}
              color={color}
              style={{
                transform: [{ scale: focused ? 1.1 : 1 }],
              }}
            />
          ),
        }}
      />
    </Tabs>
  );
}
