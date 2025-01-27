import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { Redis } from '@upstash/redis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import moment from 'moment-timezone';
import { createClient } from '@supabase/supabase-js';
import { 
  NotificationTriggerInput,
  TimeIntervalTriggerInput,
  DailyTriggerInput,
  AndroidNotificationPriority,
  SchedulableTriggerInputTypes
} from 'expo-notifications';

// Initialize Redis client
const redis = new Redis({
  url: process.env.EXPO_PUBLIC_UPSTASH_REDIS_REST_URL!,
  token: process.env.EXPO_PUBLIC_UPSTASH_REDIS_REST_TOKEN!,
});

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

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

interface NotificationHistory {
  id: string;
  userId: string;
  type: 'meal_reminder' | 'progress_check';
  content: {
    title: string;
    body: string;
  };
  metadata: {
    timeContext: string;
    mealContext?: string;
    localTime: string;
    timezone: string;
    location?: string;
  };
  sentAt: string;
}

interface ReminderSettings {
  meal: string;
  time: { hour: number; minute: number };
}

const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_NOTIFICATIONS_PER_WINDOW = 10;

// Define default reminder times
const DEFAULT_REMINDERS: ReminderSettings[] = [
  { meal: 'breakfast', time: { hour: 8, minute: 0 } },
  { meal: 'lunch', time: { hour: 13, minute: 0 } },
  { meal: 'dinner', time: { hour: 19, minute: 0 } }
];

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

async function getUserTimezone(userId: string): Promise<string> {
  try {
    // Get user's location from Supabase
    const { data: userData, error } = await supabase
      .from('users')
      .select('location')
      .eq('id', userId)
      .single();

    if (error || !userData?.location) {
      console.log('Error fetching user location or location not found:', error);
      return 'Asia/Kolkata'; // Default to Indian timezone
    }

    // Use AI to determine timezone from location
    const prompt = `Given the location "${userData.location}", determine the most likely timezone for this location. 
    Return ONLY the IANA timezone identifier (e.g., "Asia/Kolkata", "America/New_York", etc.) without any additional text or explanation.`;

    const result = await model.generateContent(prompt);
    const timezone = result.response.text().trim();

    // Validate if the timezone is valid
    if (moment.tz.zone(timezone)) {
      return timezone;
    } else {
      console.log('Invalid timezone returned by AI:', timezone);
      return 'Asia/Kolkata';
    }
  } catch (error) {
    console.error('Error determining timezone:', error);
    return 'Asia/Kolkata';
  }
}

async function generateNotificationContent(userId: string, mealType: string, progress: any) {
  // Get timezone based on user's location
  const userTimezone = await getUserTimezone(userId);
  const now = moment().tz(userTimezone);
  const hour = now.hour();
  
  let timeContext = '';
  let mealContext = '';

  // Get user's location for more contextual messages
  const { data: userData } = await supabase
    .from('medipredict_users')  // Using the correct table name
    .select('location')
    .eq('id', userId)
    .single();

  const userLocation = userData?.location || 'your location';

  // More precise time context based on local time
  if (hour >= 4 && hour < 12) {
    timeContext = 'morning';
    if (hour < 7) {
      mealContext = 'early breakfast';
    } else if (hour < 10) {
      mealContext = 'breakfast';
    } else {
      mealContext = 'mid-morning snack';
    }
  } else if (hour >= 12 && hour < 16) {
    timeContext = 'afternoon';
    if (hour < 14) {
      mealContext = 'lunch';
    } else {
      mealContext = 'afternoon snack';
    }
  } else if (hour >= 16 && hour < 22) {
    timeContext = 'evening';
    if (hour < 17) {
      mealContext = 'evening snack';
    } else if (hour < 20) {
      mealContext = 'dinner';
    } else {
      mealContext = 'light dinner';
    }
  } else {
    timeContext = 'night';
    mealContext = 'late night';
  }

  // Store last notification context to prevent repetition
  const lastContextKey = `user:${userId}:last_notification_context`;
  await redis.del(lastContextKey); // Clear any existing wrong type
  await redis.set(lastContextKey, `${timeContext}-${mealContext}`, { ex: 3600 }); // Expire in 1 hour

  // Check rate limiting
  const rateKey = `user:${userId}:notification_rate`;
  await redis.del(rateKey); // Clear any existing wrong type
  const currentCount = await redis.get(rateKey) || '0';
  const count = parseInt(currentCount);
  
  if (count >= MAX_NOTIFICATIONS_PER_WINDOW) {
    console.log(`Rate limit exceeded for user ${userId}`);
    return null;
  }

  // Increment rate limit counter
  await redis.incr(rateKey);
  await redis.expire(rateKey, RATE_LIMIT_WINDOW / 1000);

  try {
    const prompt = `Generate a friendly, motivational nutrition notification for a user. Use this context:
    - User's location: ${userLocation}
    - Time of day: ${timeContext}
    - Local time: ${now.format('HH:mm')}
    - Actual meal context: ${mealContext}
    - Requested meal type: ${mealType}
    - Current progress: ${JSON.stringify(progress)}
    
    The message should be:
    1. Personal and encouraging
    2. Time-appropriate for their local time
    3. Reference their current progress if available
    4. Include a specific tip or suggestion related to the time of day and local food culture
    5. Keep it under 100 characters
    
    Format: Return only the notification text, no quotes or formatting.`;

    const result = await model.generateContent(prompt);
    const notificationBody = result.response.text();
    
    // Store notification history
    const notificationId = `${userId}-${Date.now()}`;
    await storeNotificationHistory({
      id: notificationId,
      userId,
      type: mealType === 'progress_check' ? 'progress_check' : 'meal_reminder',
      content: {
        title: mealType === 'progress_check' ? 'Nutrition Progress Update' : 'Meal Time Reminder',
        body: notificationBody
      },
      metadata: {
        timeContext,
        mealContext,
        localTime: now.format('HH:mm'),
        timezone: userTimezone,
        location: userLocation
      },
      sentAt: new Date().toISOString()
    });

    return notificationBody;
  } catch (error) {
    console.error('Error generating notification content:', error);
    const defaultMessage = getDefaultMessage(timeContext, mealType, now);
    return defaultMessage;
  }
}

async function storeNotificationHistory(notification: NotificationHistory): Promise<void> {
  try {
    const timestamp = new Date(notification.sentAt).getTime();
    const notificationKey = `notification:${notification.id}`;
    
    // First delete any existing keys to avoid WRONGTYPE errors
    await redis.del(notificationKey);
    
    // Store full notification data as hash
    await redis.hmset(notificationKey, {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      sentAt: notification.sentAt,
      metadata: JSON.stringify(notification.metadata),
      content: JSON.stringify(notification.content)
    });
    
    // Add to user's notification list (sorted set)
    const notificationsKey = `user:${notification.userId}:notifications`;
    await redis.zadd(notificationsKey, {
      score: timestamp,
      member: notificationKey
    });
    
    // Keep only last 100 notifications per user
    const count = await redis.zcard(notificationsKey);
    if (count > 100) {
      // Get oldest notifications to remove
      const oldNotifications = await redis.zrange(notificationsKey, 0, count - 101);
      if (oldNotifications && oldNotifications.length > 0) {
        // Remove from sorted set
        await redis.zrem(notificationsKey, oldNotifications);
        // Remove notification data
        await Promise.all(
          (oldNotifications as string[]).map(key => redis.del(key))
        );
      }
    }

    // Store daily notification count for rate limiting analysis
    const today = new Date().toISOString().split('T')[0];
    const statsKey = `user:${notification.userId}:notification_stats:${today}`;
    
    // Initialize or update stats
    await redis.del(statsKey); // Clear any existing wrong type
    await redis.hmset(statsKey, {
      count: '0',
      [`type:${notification.type}`]: '0'
    });
    
    // Increment counters
    await redis.hincrby(statsKey, 'count', 1);
    await redis.hincrby(statsKey, `type:${notification.type}`, 1);
    
    // Set expiry for stats (7 days)
    await redis.expire(statsKey, 7 * 24 * 60 * 60);

  } catch (error) {
    console.error('Error storing notification history:', error);
    // Don't throw the error as this is not critical for notification delivery
  }
}

async function scheduleProgressNotifications(userId: string) {
  try {
    console.log('Scheduling progress notification for user:', userId);
    
    const trigger: TimeIntervalTriggerInput = {
      seconds: 3600, // Check every hour
      repeats: true,
      type: SchedulableTriggerInputTypes.TIME_INTERVAL
    };

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Nutrition Progress Update',
        body: 'Time to check your nutrition progress!',
        data: { type: 'progress_check', userId },
        priority: AndroidNotificationPriority.DEFAULT,
      },
      trigger,
    });

    console.log('Progress notification scheduled with identifier:', identifier);
    
    // Store scheduled notification info in Redis for tracking
    await redis.hset(`user:${userId}:scheduled_notifications`, {
      progress_check: JSON.stringify({
        identifier,
        scheduledAt: new Date().toISOString(),
        type: 'progress_check'
      })
    });

  } catch (error) {
    console.error('Error scheduling progress notification:', error);
  }
}

async function scheduleNutritionReminders(userId: string, reminders?: ReminderSettings[]): Promise<void> {
  try {
    console.log('Starting to schedule nutrition reminders for user:', userId);
    
    // Use default reminders if none provided
    const reminderSettings = reminders || DEFAULT_REMINDERS;
    console.log('Current reminders config:', reminderSettings);
    
    // Check permissions first
    const { status } = await Notifications.getPermissionsAsync();
    console.log('Notification permission status:', status);
    
    if (status !== 'granted') {
      console.error('Notification permissions not granted');
      return;
    }

    // Cancel existing notifications first
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Cancelled existing notifications');

    // Store the reminder settings in Redis for future reference
    await redis.hset(`user:${userId}:settings`, {
      reminders: JSON.stringify(reminderSettings),
      lastUpdated: new Date().toISOString()
    });

    for (const reminder of reminderSettings) {
      const { meal, time } = reminder;
      console.log(`Scheduling reminder for ${meal} at ${time.hour}:${time.minute}`);
      
      if (!time || typeof time.hour !== 'number' || typeof time.minute !== 'number') {
        console.error(`Invalid time format for ${meal} reminder:`, time);
        continue;
      }

      const trigger: DailyTriggerInput = {
        hour: time.hour,
        minute: time.minute,
        type: SchedulableTriggerInputTypes.DAILY
      };

      const notificationBody = await generateNotificationContent(userId, meal, null);
      console.log(`Generated notification content for ${meal}:`, notificationBody);

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Meal Time Reminder',
          body: notificationBody,
          data: { type: 'meal_reminder', meal, userId },
          priority: AndroidNotificationPriority.HIGH,
        },
        trigger,
      });

      console.log(`Successfully scheduled ${meal} reminder with identifier:`, identifier);
      
      // Store scheduled notification info
      await redis.hset(`user:${userId}:scheduled_notifications`, {
        [`meal_${meal}`]: JSON.stringify({
          identifier,
          scheduledAt: new Date().toISOString(),
          type: 'meal_reminder',
          meal,
          time
        })
      });
      console.log(`Stored notification info in Redis for ${meal}`);
    }

    // Schedule progress notifications as well
    await scheduleProgressNotifications(userId);
    
    // Verify scheduled notifications
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log('All scheduled notifications after setup:', scheduled);

  } catch (error) {
    console.error('Error scheduling nutrition reminders:', error);
    // Re-throw the error to handle it in the calling function
    throw error;
  }
}

async function getNotificationAnalytics(userId: string, days: number = 7) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Get notifications in date range using zrange with scores
    const notifications = await redis.zrange(
      `user:${userId}:notifications`,
      startDate.getTime().toString(),
      endDate.getTime().toString(),
      { 
        byScore: true,
        rev: true 
      }
    );
    
    // Get notification details
    const notificationDetails = await Promise.all(
      (notifications as string[]).map(key => redis.hgetall(key))
    );
    
    // Get daily stats
    const stats: Record<string, {
      total: number;
      byType: {
        meal_reminder: number;
        progress_check: number;
      };
    }> = {};

    for (let d = 0; d < days; d++) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];
      
      const [dailyCount, mealReminderCount, progressCheckCount] = await Promise.all([
        redis.hget(`user:${userId}:notification_stats`, `count:${dateStr}`) as Promise<string>,
        redis.hget(`user:${userId}:notification_stats`, `type:meal_reminder:${dateStr}`) as Promise<string>,
        redis.hget(`user:${userId}:notification_stats`, `type:progress_check:${dateStr}`) as Promise<string>
      ]);
      
      stats[dateStr] = {
        total: parseInt(dailyCount || '0'),
        byType: {
          meal_reminder: parseInt(mealReminderCount || '0'),
          progress_check: parseInt(progressCheckCount || '0')
        }
      };
    }
    
    return {
      notifications: notificationDetails,
      dailyStats: stats
    };
  } catch (error) {
    console.error('Error getting notification analytics:', error);
    return null;
  }
}

async function checkNotificationStatus(userId: string): Promise<{
  scheduledNotifications: any[];
  permissions: any;
  lastDelivered: any[];
}> {
  try {
    // Check notification permissions
    const permissions = await Notifications.getPermissionsAsync();
    console.log('Notification permissions:', permissions);

    // Get scheduled notifications
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log('Currently scheduled notifications:', scheduled);

    // Get stored notification info from Redis
    const storedNotifications = await redis.hgetall(`user:${userId}:scheduled_notifications`);
    console.log('Stored notification info:', storedNotifications);

    // Get recent notification history
    const recentNotifications = await redis.zrange(
      `user:${userId}:notifications`,
      -5,
      -1,
      { rev: true }
    );

    const notificationDetails = await Promise.all(
      (recentNotifications as string[]).map(key => redis.hgetall(key))
    );

    return {
      scheduledNotifications: scheduled,
      permissions,
      lastDelivered: notificationDetails
    };
  } catch (error) {
    console.error('Error checking notification status:', error);
    return {
      scheduledNotifications: [],
      permissions: null,
      lastDelivered: []
    };
  }
}

async function debugNotifications(userId: string): Promise<{
  status: string;
  details: any;
}> {
  try {
    // 1. Check notification permissions
    const { status: permissionStatus } = await Notifications.getPermissionsAsync();
    console.log('Permission status:', permissionStatus);
    
    if (permissionStatus !== 'granted') {
      return {
        status: 'error',
        details: {
          error: 'Notification permissions not granted',
          permissionStatus
        }
      };
    }

    // 2. Check if notifications are enabled
    const settings = await Notifications.getDevicePushTokenAsync();
    console.log('Push token:', settings);

    // 3. Get all scheduled notifications
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log('Scheduled notifications:', scheduled);

    // 4. Get notification history from Redis
    const recentNotifications = await redis.zrange(
      `user:${userId}:notifications`,
      -5,
      -1,
      { rev: true }
    );
    
    const notificationHistory = await Promise.all(
      (recentNotifications as string[]).map(key => redis.hgetall(key))
    );
    console.log('Recent notification history:', notificationHistory);

    // 5. Send a test notification
    const testId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Debug Test Notification',
        body: `This is a test notification sent at ${new Date().toLocaleTimeString()}`,
        data: { type: 'debug_test', userId },
      },
      trigger: {
        seconds: 5,
        type: SchedulableTriggerInputTypes.TIME_INTERVAL
      },
    });
    console.log('Test notification scheduled with ID:', testId);

    return {
      status: 'success',
      details: {
        permissionStatus,
        pushToken: settings,
        scheduledNotifications: scheduled,
        recentHistory: notificationHistory,
        testNotificationId: testId
      }
    };

  } catch (error) {
    console.error('Error in debug notifications:', error);
    return {
      status: 'error',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    };
  }
}

export {
  scheduleNutritionReminders,
  scheduleProgressNotifications,
  getNotificationAnalytics,
  checkNotificationStatus,
  debugNotifications,
  storeNotificationHistory
};

function getDefaultMessage(timeContext: string, mealType: string, now: moment.Moment): string {
  const messages = {
    morning: [
      "Rise and shine! Time to plan your healthy breakfast. ",
      "Good morning! Start your day with a nutritious meal. ",
      "Morning energy boost! How about a healthy breakfast? "
    ],
    afternoon: [
      "Lunchtime! Remember to include colorful veggies in your meal. ",
      "Midday fuel! Keep your energy high with a balanced lunch. ",
      "Time for a nutritious lunch break! "
    ],
    evening: [
      "Dinner planning time! Keep it light and nutritious. ",
      "Evening wellness! Choose a balanced dinner. ",
      "Time for a healthy dinner to wind down your day. "
    ],
    night: [
      "Planning tomorrow's meals? Don't forget to stay hydrated! ",
      "Sweet dreams ahead! Consider a light snack if needed. ",
      "Winding down? Remember, good nutrition means good sleep! "
    ]
  };
  
  // Get array for current timeContext, fallback to morning if invalid
  const timeMessages = messages[timeContext as keyof typeof messages] || messages.morning;
  
  // Use current minute to select a message, ensuring variety
  const messageIndex = Math.floor(now.minute() / 20) % timeMessages.length;
  return timeMessages[messageIndex];
}

async function handleNotification(notification: Notifications.Notification) {
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
