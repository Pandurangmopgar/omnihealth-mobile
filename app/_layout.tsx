import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { View, Text } from "react-native";

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "";

// Cache the Clerk token
const tokenCache = {
  async getToken(key: string) {
    try {
      return SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

// This function will check if the user is authenticated on every navigation
function InitialLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    // Only run the navigation logic once
    if (!initialized) {
      setInitialized(true);
      const inTabsGroup = segments[0] === "(tabs)";

      if (isSignedIn && !inTabsGroup) {
        // Redirect to the home page if they're signed in and not in the (tabs) group
        router.replace("/(tabs)");
      } else if (!isSignedIn && inTabsGroup) {
        // Redirect away from protected pages if they're not signed in
        router.replace("/");
      }
    }
  }, [isSignedIn, segments, isLoaded, initialized, router]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <ClerkProvider 
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <SafeAreaProvider>
        <InitialLayout />
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
