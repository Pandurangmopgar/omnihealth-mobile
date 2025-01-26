import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import { useServices } from '../../context/ServiceContext';

const { width } = Dimensions.get('window');

// Initialize Gemini AI
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
if (!API_KEY) {
  console.error('Missing EXPO_PUBLIC_GOOGLE_API_KEY in environment variables');
}

// Create the model with specific configuration
const genAI = new GoogleGenerativeAI(API_KEY || '');
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  generationConfig: {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
  }
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
}

const servicesContext = `
OmniHealth provides the following AI-powered health services:


1. 🍎 Nutrition Analyzer
   - Real-time food analysis and tracking
   - Detailed nutritional content analysis
   - Daily and weekly progress monitoring
   - Personalized nutrition insights
   - Multi-channel reporting (SMS, WhatsApp, Email)
   - Smart goal tracking and adjustments
   - Location-aware food recommendations
   - Mobile-friendly food logging
   - Automated progress reports
   - Trend analysis and recommendations

2. 📋 Diet Planner
   - Personalized meal planning
   - Real-time nutrition tracking
   - Daily and weekly progress reports
   - Customized dietary recommendations
   - Integration with Nutrition Analyzer
   - Meal modification suggestions
   - Dietary restriction handling
   - Cultural food preferences
   - Recipe recommendations
   - Shopping list generation

3. 💪 Exercise Coach
   - Personalized workout planning
   - Considers age, fitness level, and medical conditions
   - Equipment-aware exercise recommendations
   - Progress tracking and adjustments
   - Video guidance for exercises
   - AI analysis of workout effectiveness
   - Adapts plans based on progress
   - Integration with nutrition tracking
   - Exercise video recommendations
   - Real-time performance analysis



`;

const INITIAL_PROMPT = `You are OmniHealth's friendly and knowledgeable AI healthcare assistant. Your role is to help users discover and understand our health services.

${servicesContext}

IMPORTANT GUIDELINES:
1. Always reference services using their exact names and emojis
2. When suggesting a service, explain how its features match the user's needs
3. Keep responses concise and mobile-friendly
4. Maintain a supportive and professional tone
5. End responses with an engaging question
6. Use the service information provided above to answer accurately

Remember: Your responses should be based on the accurate service information provided above.`;

export default function AIAssistant() {
  // const { services } = useServices();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const chatRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const [showNewChatButton, setShowNewChatButton] = useState(false);

  useEffect(() => {
    setShowNewChatButton(messages.length > 0);
  }, [messages]);

  const startNewChat = () => {
    setMessages([]);
    setInput('');
    setShowNewChatButton(false);
  };

  // Initialize chat session
  const initChat = useCallback(async () => {
    try {
      if (!chatRef.current) {
        chatRef.current = await model.startChat({
          history: [
            {
              role: 'user',
              parts: [{ text: INITIAL_PROMPT }] as Part[]
            }
          ],
        });
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
    }
  }, []);

  // Initialize chat on component mount
  React.useEffect(() => {
    initChat();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [initChat, fadeAnim]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || !chatRef.current) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      id: Date.now().toString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      if (!API_KEY) {
        throw new Error('API key is not configured');
      }

      // Send message with service context
      const result = await chatRef.current.sendMessage([{
        text: `${servicesContext}

Previous conversation:
${messages.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Current query: ${input.trim()}

Remember to:
1. Use the service information provided above to answer accurately
2. Include relevant emojis when mentioning services
3. Reference specific features from the services
4. Keep responses concise and mobile-friendly
5. End with an engaging question`
      }] as Part[]);
      const response = await result.response;
      const text = response.text();

      // Update messages with properly typed response
      const assistantMessage: Message = {
        role: 'assistant',
        content: text,
        id: (Date.now() + 1).toString(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        id: (Date.now() + 1).toString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.mainContent}>
        <LinearGradient
          colors={['#0B1120', '#1A237E']}
          style={styles.gradient}
        >
          <View style={[styles.header, { marginTop: insets.top }]}>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            {showNewChatButton && (
              <TouchableOpacity onPress={startNewChat} style={styles.newChatButton}>
                <LinearGradient
                  colors={['#4C6EF5', '#3D5AFE']}
                  style={styles.newChatGradient}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.newChatText}>New Chat</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.chatContainer, { marginBottom: 80 }]}>
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={[
                styles.messagesContent,
                { paddingBottom: 100 }
              ]}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.map((message) => (
                <MotiView
                  key={message.id}
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 300 }}
                  style={[
                    styles.messageWrapper,
                    message.role === 'user' ? styles.userMessage : styles.assistantMessage,
                  ]}
                >
                  {message.role === 'assistant' && (
                    <LinearGradient
                      colors={['#4C6EF5', '#3D5AFE']}
                      style={styles.assistantIcon}
                    >
                      <Ionicons name="medical" size={16} color="#fff" />
                    </LinearGradient>
                  )}
                  <MotiView
                    style={[
                      styles.messageContent,
                      message.role === 'user' ? styles.userMessageContent : styles.assistantMessageContent,
                    ]}
                  >
                    <Text style={[
                      styles.messageText,
                      message.role === 'user' ? styles.userMessageText : styles.assistantMessageText,
                    ]}>
                      {message.content}
                    </Text>
                  </MotiView>
                </MotiView>
              ))}
              
              {isLoading && (
                <MotiView
                  from={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={[styles.messageWrapper, styles.assistantMessage]}
                >
                  <LinearGradient
                    colors={['#4C6EF5', '#3D5AFE']}
                    style={styles.assistantIcon}
                  >
                    <Ionicons name="medical" size={16} color="#fff" />
                  </LinearGradient>
                  <View style={[styles.messageContent, styles.loadingContent]}>
                    <ActivityIndicator color="#4C6EF5" />
                  </View>
                </MotiView>
              )}
            </ScrollView>
          </View>

          <View style={[styles.bottomContainer, { height: 80 }]}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
              style={styles.keyboardAvoidingView}
            >
              <View style={styles.inputContainer}>
                <MotiView
                  from={{ opacity: 0, translateY: 20 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 500 }}
                  style={styles.inputWrapper}
                >
                  <TextInput
                    style={styles.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Ask me anything about health..."
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    multiline={false}
                    returnKeyType="send"
                    onSubmitEditing={handleSend}
                  />
                  <TouchableOpacity
                    style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
                    onPress={handleSend}
                    disabled={!input.trim() || isLoading}
                  >
                    <LinearGradient
                      colors={input.trim() ? ['#4C6EF5', '#3D5AFE'] : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.1)']}
                      style={styles.sendButtonGradient}
                    >
                      <Ionicons
                        name="send"
                        size={20}
                        color={input.trim() ? '#fff' : '#6B7280'}
                      />
                    </LinearGradient>
                  </TouchableOpacity>
                </MotiView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  mainContent: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  newChatButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  newChatGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  newChatText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
  chatContainer: {
    flex: 1,
    position: 'relative',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: width * 0.8,
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
  },
  assistantIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  messageContent: {
    borderRadius: 20,
    padding: 12,
    flex: 1,
  },
  userMessageContent: {
    backgroundColor: '#4C6EF5',
    borderBottomRightRadius: 4,
  },
  assistantMessageContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomLeftRadius: 4,
  },
  loadingContent: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(11, 17, 32, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  keyboardAvoidingView: {
    width: '100%',
  },
  inputContainer: {
    padding: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
  },
  sendButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
