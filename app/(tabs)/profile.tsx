import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform, Image, SafeAreaView } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  if (!isSignedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.signInContainer}>
          <Ionicons name="person-circle-outline" size={80} color={colors.text} style={styles.icon} />
          <Text style={[styles.title, { color: colors.text }]}>Sign In Required</Text>
          <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>
            Please sign in to view your profile
          </Text>
          <TouchableOpacity 
            style={[styles.signInButton, { backgroundColor: colors.tint }]}
            onPress={() => router.push('/')}
          >
            <Text style={styles.signInText}>Go to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => {}}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileSection}>
          <Image 
            source={{ uri: user?.imageUrl || 'https://randomuser.me/api/portraits/lego/1.jpg' }}
            style={styles.avatar}
          />
          <Text style={[styles.name, { color: colors.text }]}>
            {user?.fullName || 'User'}
          </Text>
          <Text style={[styles.email, { color: colors.tabIconDefault }]}>
            {user?.primaryEmailAddress?.emailAddress || 'No email provided'}
          </Text>
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="person-outline" size={24} color={colors.text} />
            <Text style={[styles.menuText, { color: colors.text }]}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={24} color={colors.tabIconDefault} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
            <Text style={[styles.menuText, { color: colors.text }]}>Notifications</Text>
            <Ionicons name="chevron-forward" size={24} color={colors.tabIconDefault} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.text} />
            <Text style={[styles.menuText, { color: colors.text }]}>Privacy</Text>
            <Ionicons name="chevron-forward" size={24} color={colors.tabIconDefault} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, styles.signOutButton]}
            onPress={() => signOut()}
          >
            <Ionicons name="log-out-outline" size={24} color="#ef4444" />
            <Text style={[styles.menuText, { color: '#ef4444' }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 34,
    fontWeight: Platform.OS === 'ios' ? '800' : 'bold',
  },
  settingsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    opacity: 0.8,
  },
  menuSection: {
    borderRadius: 16,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginLeft: 12,
  },
  signOutButton: {
    borderBottomWidth: 0,
  },
  signInContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  icon: {
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.8,
  },
  signInButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
  },
  signInText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 