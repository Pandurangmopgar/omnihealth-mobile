import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { Redis } from '@upstash/redis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  NotificationTriggerInput, 
  DailyTriggerInput,
  AndroidNotificationPriority,
  SchedulableTriggerInputTypes
} from 'expo-notifications';

// Initialize Redis client
const redis = new Redis({
  url: process.env.EXPO_PUBLIC_UPSTASH_REDIS_REST_URL!,
  token: process.env.EXPO_PUBLIC_UPSTASH_REDIS_REST_TOKEN!,
});

// Initialize Gemini
// const model = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY!).getGenerativeModel({ model: 'gemini-pro' });
// Initialize clients
const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GOOGLE_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
// Configure notifications for iOS
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface NotificationToken {
  token: string;
  platform: 'ios' | 'android';
  lastUpdated: string;
}

interface NotificationSetting {
  userId: string;
  mealType: string;
  time: { hour: number; minute: number };
  isActive: boolean;
  lastNotified: string;
}

interface RedisHashData {
  [key: string]: string;
}

const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_NOTIFICATIONS_PER_WINDOW = 10;

export async function registerForPushNotifications(userId: string) {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      throw new Error('Permission not granted for notifications');
    }

    const expoPushToken = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PROJECT_ID!,
    });

    // Store token in Redis
    const tokenData: NotificationToken = {
      token: expoPushToken.data,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      lastUpdated: new Date().toISOString(),
    };

    const hashData: RedisHashData = {
      token: JSON.stringify(tokenData)
    };
    await redis.hset(`user:${userId}:notifications`, hashData);

    // Configure for iOS
    if (Platform.OS === 'ios') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return expoPushToken.data;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    throw error;
  }
}

async function generateNotificationContent(userId: string, mealType: string, progress: any) {
  const hour = new Date().getHours();
  let timeContext = '';
  let mealContext = '';

  // More precise time context
  if (hour >= 5 && hour < 12) {
    timeContext = 'morning';
    mealContext = hour < 7 ? 'early breakfast' : 'breakfast';
  } else if (hour >= 12 && hour < 17) {
    timeContext = 'afternoon';
    mealContext = hour < 14 ? 'lunch' : 'afternoon snack';
  } else if (hour >= 17 && hour < 22) {
    timeContext = 'evening';
    mealContext = hour < 20 ? 'dinner' : 'evening snack';
  } else {
    timeContext = 'night';
    mealContext = 'late night';
  }

  // Check rate limiting
  const rateKey = `user:${userId}:notification_rate`;
  const currentCount = await redis.get(rateKey) as string;
  const count = currentCount ? parseInt(currentCount) : 0;
  
  if (count >= MAX_NOTIFICATIONS_PER_WINDOW) {
    console.log(`Rate limit exceeded for user ${userId}`);
    return null;
  }

  // Increment rate limit counter
  await redis.incr(rateKey);
  if (count === 0) {
    await redis.expire(rateKey, RATE_LIMIT_WINDOW / 1000); // Convert ms to seconds
  }

  const prompt = `Generate a friendly, motivational nutrition notification for a user. Use this context:
  - Time of day: ${timeContext}
  - Actual meal context: ${mealContext}
  - Requested meal type: ${mealType}
  - Current progress: ${JSON.stringify(progress)}
  
  The message should be:
  1. Personal and encouraging
  2. Time-appropriate (don't say good morning in the evening)
  3. Reference their current progress if available
  4. Include a specific tip or suggestion related to the time of day
  5. Keep it under 100 characters
  
  Format: Return only the notification text, no quotes or formatting.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error generating notification content:', error);
    return getDefaultMessage(timeContext, mealType);
  }
}

function getDefaultMessage(timeContext: string, mealType: string): string {
  const messages = {
    morning: "Rise and shine! Time to plan your healthy breakfast. ",
    afternoon: "Lunchtime! Remember to include colorful veggies in your meal. ",
    evening: "Dinner planning time! Keep it light and nutritious. ",
    night: "Planning tomorrow's meals? Don't forget to stay hydrated! "
  };
  return messages[timeContext as keyof typeof messages] || messages.morning;
}

export async function scheduleNutritionReminders(userId: string) {
  try {
    // Cancel existing reminders
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Get user's notification settings from Redis
    const settings = await redis.hget(`user:${userId}:notifications`, 'settings') as string | null;
    const reminders: NotificationSetting[] = settings ? JSON.parse(settings) : getDefaultReminders();

    // Schedule new reminders
    for (const reminder of reminders) {
      if (!reminder.isActive) continue;

      const progress = await redis.hget(`user:${userId}:progress`, 'daily') as string | null;
      const notificationContent = await generateNotificationContent(
        userId,
        reminder.mealType,
        progress ? JSON.parse(progress) : null
      );

      if (!notificationContent) {
        continue;
      }

      const trigger: DailyTriggerInput = {
        type: SchedulableTriggerInputTypes.DAILY,
        hour: reminder.time.hour,
        minute: reminder.time.minute,
      };

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: Platform.OS === 'ios' ? 'Nutrition Reminder ' : 'Time to track your nutrition!',
          body: notificationContent,
          data: { type: 'meal_reminder', mealType: reminder.mealType, userId },
          sound: true,
          badge: 1,
          priority: AndroidNotificationPriority.MAX,
        },
        trigger,
      });

      // Update Redis with the scheduled notification
      reminder.lastNotified = new Date().toISOString();
      const reminderKey = `reminder:${reminder.mealType}`;
      await redis.hset(`user:${userId}:notifications`, {
        [reminderKey]: JSON.stringify({ ...reminder, identifier })
      });
    }

    // Schedule progress check notifications
    await scheduleProgressNotifications(userId);

  } catch (error) {
    console.error('Error scheduling reminders:', error);
    throw error;
  }
}

async function scheduleProgressNotifications(userId: string) {
  const checkTimes = [
    { hour: 12, minute: 0 }, // Lunch progress
    { hour: 16, minute: 0 }, // Afternoon check
    { hour: 20, minute: 0 }, // Evening summary
  ];

  for (const time of checkTimes) {
    const progress = await redis.hget(`user:${userId}:progress`, 'daily') as string | null;
    const notificationContent = await generateNotificationContent(
      userId,
      'progress_check',
      progress ? JSON.parse(progress) : null
    );

    if (!notificationContent) {
      continue;
    }

    const trigger: DailyTriggerInput = {
      type: SchedulableTriggerInputTypes.DAILY,
      hour: time.hour,
      minute: time.minute,
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: Platform.OS === 'ios' ? 'Nutrition Progress Update ' : 'Check your nutrition progress!',
        body: notificationContent,
        data: { type: 'progress_check', userId },
        sound: true,
        badge: 1,
        priority: AndroidNotificationPriority.HIGH,
      },
      trigger,
    });
  }
}

function getDefaultReminders(): NotificationSetting[] {
  return [
    { userId: '', mealType: 'breakfast', time: { hour: 8, minute: 0 }, isActive: true, lastNotified: '' },
    { userId: '', mealType: 'morning_snack', time: { hour: 10, minute: 30 }, isActive: true, lastNotified: '' },
    { userId: '', mealType: 'lunch', time: { hour: 13, minute: 0 }, isActive: true, lastNotified: '' },
    { userId: '', mealType: 'afternoon_snack', time: { hour: 16, minute: 0 }, isActive: true, lastNotified: '' },
    { userId: '', mealType: 'dinner', time: { hour: 19, minute: 0 }, isActive: true, lastNotified: '' },
  ];
}

export async function updateNotificationSettings(
  userId: string,
  settings: {
    mealType: string;
    isActive: boolean;
    time?: { hour: number; minute: number };
  }
) {
  try {
    const currentSettings = await redis.hget(`user:${userId}:notifications`, 'settings') as string | null;
    const reminders: NotificationSetting[] = currentSettings ? JSON.parse(currentSettings) : getDefaultReminders();

    // Update the specific reminder
    const reminderIndex = reminders.findIndex((r: NotificationSetting) => r.mealType === settings.mealType);
    if (reminderIndex !== -1) {
      reminders[reminderIndex] = {
        ...reminders[reminderIndex],
        ...settings,
        userId,
        lastNotified: new Date().toISOString(),
      };
    }

    // Save to Redis
    await redis.hset(`user:${userId}:notifications`, {
      settings: JSON.stringify(reminders)
    });

    // Reschedule all notifications
    await scheduleNutritionReminders(userId);
  } catch (error) {
    console.error('Error updating notification settings:', error);
    throw error;
  }
}

export async function sendTestNotification() {
  try {
    const currentTime = new Date();
    const formattedTime = currentTime.toLocaleTimeString();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: Platform.OS === 'ios' ? 'Welcome to OmniHealth! ' : 'Welcome to OmniHealth!',
        body: `App opened at ${formattedTime}. Notifications are working correctly!`,
        data: { type: 'test_notification' },
        sound: true,
        badge: 1,
        priority: AndroidNotificationPriority.MAX,
      },
      trigger: {
        seconds: 1, // Show notification after 1 second
      },
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    throw error;
  }
}

export async function handleNotification(notification: Notifications.Notification) {
  const notificationId = notification.request.identifier;
  
  try {
    // Check if notification was already handled
    const wasHandled = await redis.get(`handled_notification:${notificationId}`);
    if (wasHandled) {
      return;
    }

    // Mark notification as handled
    await redis.set(`handled_notification:${notificationId}`, true, { ex: 24 * 60 * 60 });

    // Check rate limit
    const userId = notification.request.content.data?.userId;
    if (userId) {
      const rateKey = `notification_rate:${userId}`;
      const currentCount = await redis.incr(rateKey);
      
      // Set expiry on first increment
      if (currentCount === 1) {
        await redis.expire(rateKey, RATE_LIMIT_WINDOW / 1000);
      }

      if (currentCount > MAX_NOTIFICATIONS_PER_WINDOW) {
        console.warn(`Rate limit exceeded for user ${userId}`);
        return;
      }
    }

    // Process notification
    const data = notification.request.content.data;
    
    // Prevent infinite loops by checking notification type
    if (data?.type === 'meal_reminder') {
      // Handle meal reminder specific logic
      console.log('Processing meal reminder:', data);
      // Add your reminder-specific logic here
    } else if (data?.type === 'progress_check') {
      // Handle progress check tap
      // Navigation logic will be handled by the app navigation system
    }

  } catch (error) {
    console.error('Error handling notification:', error);
  }
}

// Handle notification responses
Notifications.addNotificationResponseReceivedListener((response) => {
  const data = response.notification.request.content.data;
  
  if (data?.type === 'meal_reminder') {
    // Handle meal reminder tap
    // Navigation logic will be handled by the app navigation system
  } else if (data?.type === 'progress_check') {
    // Handle progress check tap
    // Navigation logic will be handled by the app navigation system
  }
});
