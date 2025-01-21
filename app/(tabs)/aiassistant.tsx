import React, { useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

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
}

const INITIAL_PROMPT = `You are an AI health assistant specializing in nutrition, exercise, and diet planning. 
Keep your responses concise, clear, and mobile-friendly.
Focus on providing actionable advice and recommendations.
Always maintain a professional yet friendly tone.
If you're unsure about something, acknowledge it and suggest consulting a healthcare professional.`;

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const chatRef = useRef<any>(null);

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
  }, [initChat]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || !chatRef.current) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      if (!API_KEY) {
        throw new Error('API key is not configured');
      }

      // Send message using chat session
      const result = await chatRef.current.sendMessage([{ text: input.trim() }] as Part[]);
      const response = await result.response;
      const text = response.text();

      // Update messages with properly typed response
      const assistantMessage: Message = {
        role: 'assistant',
        content: text
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.content}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message, index) => (
            <View
              key={index}
              style={[
                styles.messageWrapper,
                message.role === 'user' ? styles.userMessage : styles.assistantMessage,
              ]}
            >
              {message.role === 'assistant' && (
                <View style={styles.assistantIcon}>
                  <Ionicons name="medical" size={16} color="#fff" />
                </View>
              )}
              <View style={[
                styles.messageContent,
                message.role === 'user' ? styles.userMessageContent : styles.assistantMessageContent
              ]}>
                <Text style={[
                  styles.messageText,
                  message.role === 'user' ? styles.userMessageText : styles.assistantMessageText,
                ]}>
                  {message.content}
                </Text>
              </View>
            </View>
          ))}
          {isLoading && (
            <View style={[styles.messageWrapper, styles.assistantMessage]}>
              <View style={styles.assistantIcon}>
                <Ionicons name="medical" size={16} color="#fff" />
              </View>
              <View style={[styles.messageContent, styles.loadingContent]}>
                <ActivityIndicator color="#4C6EF5" />
              </View>
            </View>
          )}
        </ScrollView>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          style={styles.inputContainer}
        >
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask me anything about health..."
              placeholderTextColor="#6B7280"
              multiline={false}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <Ionicons
                name="send"
                size={20}
                color={input.trim() ? '#fff' : '#6B7280'}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  content: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 50 : 20,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 16,
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
    backgroundColor: '#4C6EF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  messageContent: {
    borderRadius: 16,
    padding: 12,
    flex: 1,
  },
  userMessageContent: {
    backgroundColor: '#4C6EF5',
  },
  assistantMessageContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  loadingContent: {
    padding: 16,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#fff',
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  inputContainer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#0B1120',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
    paddingHorizontal: 12,
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
    borderRadius: 20,
    backgroundColor: '#4C6EF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});
