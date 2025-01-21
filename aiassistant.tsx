'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, X, Plus, Minimize, Maximize } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GoogleGenerativeAI } from '@google/generative-ai'
import { useUser } from "@clerk/nextjs";
import { Redis } from '@upstash/redis';

interface Part {
  text: string;
}

interface StoredMessage {
  role: 'user' | 'model';
  content: string;
}

type StoredHistory = StoredMessage[];

interface ChatMessage {
  role: 'user' | 'model';
  parts: Part[];
}

type ChatHistory = ChatMessage[];

interface Message {
  text: string
  isUser: boolean
  initiateCall?: boolean
}

interface ServiceRedirect {
  service: string;
  path: string;
  description: string;
  icon: string;
}

// Initialize Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
})

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "AIzaSyCPAXJvnOMK23-fvhA1XkaeBaZli9qqhgk")
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })

const systemPrompt = `You are the central AI assistant for OmniHealth, an integrated healthcare platform with multiple specialized AI services. Your role is to understand user needs and guide them to the most appropriate service while providing helpful information.

IMPORTANT GUIDELINES:
1. DO NOT mention or reference links explicitly. Never say things like "click here", "access it through this link", or "[Insert link to X here]"
2. Simply mention the service name naturally in your response - the interface will automatically make it clickable
3. Only mention each service name once in a section, preferably in the header or first mention
4. Keep responses concise and focused

Available Services:
1. Nutritional Analyzer: For diet analysis, nutritional information, and meal planning
2. Symptom Analyzer: For analyzing health symptoms and suggesting potential conditions
3. MedInfo: For medication information, drug interactions, and general medical knowledge
4. Diet Planner: For personalized meal plans and dietary recommendations
5. Mental Health Assistant: For mental wellness support and resources
6. Medical Prediction Tools: For AI-powered disease prediction (heart disease, brain tumors, Alzheimer's, pneumonia, diabetes, lung cancer)
7. Exercise Coach: For personalized workout plans and fitness recommendations

Key Responsibilities:
1. Understand user queries and identify which service would be most helpful
2. Provide clear explanations of how each service can help
3. Answer general questions about OmniHealth's features
4. Maintain a supportive and professional tone
5. Remind users that our services are for informational purposes and not a substitute for professional medical advice

When describing services:
- Introduce the service with a clear header (e.g., "# Nutritional Analyzer Overview")
- Explain its key features and benefits
- DO NOT mention clicking, links, or accessing the service - just mention the service name
- Keep descriptions focused and avoid repetition

Use Markdown formatting in your responses:
- Use # for main headers
- Use ## for subheaders
- Use ** for bold text
- Use * for italic text
- Use \` for inline code

Remember to:
1. Always be helpful and professional
2. Keep responses concise and focused
3. Avoid repetitive mentions of services
4. Explain features clearly without referencing UI elements or links`

const serviceRoutes: ServiceRedirect[] = [
  {
    service: 'Nutritional Analyzer',
    path: '/nutrition-analyzer',
    description: 'Analyze your diet and get detailed nutritional insights',
    icon: '🍎'
  },
  {
    service: 'Symptom Analyzer',
    path: '/symptom-analyzer',
    description: 'Analyze your symptoms and get potential condition insights',
    icon: '🏥'
  },
  {
    service: 'MedInfo',
    path: '/medinfo',
    description: 'Get detailed information about medications and treatments',
    icon: '💊'
  },
  {
    service: 'Diet Planner',
    path: '/diet-planner',
    description: 'Get personalized meal plans and dietary recommendations',
    icon: '📋'
  },
  {
    service: 'Mental Health Assistant',
    path: '/mental-health-assistant',
    description: 'Access mental wellness resources and support',
    icon: '🧠'
  },
  {
    service: 'Exercise Coach',
    path: '/exercise-coach',
    description: 'Get personalized workout plans and fitness recommendations',
    icon: '💪'
  }
];

const formatResponse = (response: string): string => {
  const lines = response.split('\n');
  return lines.map((line, index) => {
    // Enhanced header formatting with gradients and icons for headers
    if (line.startsWith("## ")) {
      // Check if this header contains a service name
      const headerText = line.substring(3);
      const service = serviceRoutes.find(s => headerText.includes(s.service));
      if (service) {
        return `<h2 class="text-xl font-semibold mt-4 mb-2 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
          ${service.icon} ${headerText}
        </h2>`;
      }
      return `<h2 class="text-xl font-semibold mt-4 mb-2 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">${headerText}</h2>`;
    }
    if (line.startsWith("# ")) {
      
      // Check if this header contains a service name
      const headerText = line.substring(2);
      const service = serviceRoutes.find(s => headerText.includes(s.service));
      if (service) {
        return `<h1 class="text-2xl font-bold mt-6 mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          ${service.icon} ${headerText}
        </h1>`;
      }
      return `<h1 class="text-2xl font-bold mt-6 mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">${headerText}</h1>`;
    }
    
    let processedLine = line;
    
    // Make service names clickable without icons for regular text
    serviceRoutes.forEach(({ service, path }) => {
      const regex = new RegExp(`\\b${service}\\b`, 'i');
      if (regex.test(processedLine)) {
        processedLine = processedLine.replace(regex, `
          <a href="${path}" class="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 px-2 py-1 rounded-md transition-all duration-300 cursor-pointer">
            ${service}
          </a>
        `);
      }
    });

    // Enhanced formatting for special elements
    processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-blue-300">$1</strong>');
    processedLine = processedLine.replace(/\*(.*?)\*/g, '<em class="text-purple-300">$1</em>');
    processedLine = processedLine.replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-gray-700/50 text-blue-300 font-mono text-sm">$1</code>');
    
    // Add dividers for better section separation
    if (processedLine.match(/^---+$/)) {
      return '<hr class="my-4 border-t border-blue-800/50" />';
    }

    // Format links with custom styling
    processedLine = processedLine.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g, 
      '<a href="$2" class="text-blue-400 hover:text-blue-300 underline transition-colors duration-200 cursor-pointer">$1</a>'
    );

    return processedLine + (index < lines.length - 1 ? '<br>' : '');
  }).join('');
};

const checkCallIntent = async (response: string): Promise<string> => {
  // Check if response indicates user interest
  const interestIndicators = [
    'interested',
    'tell me more',
    'want to know more',
    'how can I start',
    'sign up',
    'get started'
  ];
  
  const shouldInitiateCall = interestIndicators.some(indicator => 
    response.toLowerCase().includes(indicator.toLowerCase())
  );

  if (shouldInitiateCall) {
    return response + "\n\nWould you like to receive a call with more detailed information about our services?";
  }

  return response;
};

interface MobileAIChatProps {
  messages: ChatHistory;
  input: string;
  isLoading: boolean;
  handleSend: () => void;
  handleKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  setInput: (value: string) => void;
  isOpen: boolean;
  toggleChat: () => void;
  clearChat: () => void;
  showCallPrompt: boolean;
  setShowCallPrompt: (show: boolean) => void;
  initiateCall: () => void;
}

const AILogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Modern device detection hook
const useIsMobileDevice = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mediaQuery = window.matchMedia('(max-width: 768px)');
      setIsMobile(mediaQuery.matches);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

// Mobile-optimized component
const MobileAIChat: React.FC<MobileAIChatProps> = ({
  messages,
  input,
  isLoading,
  handleSend,
  handleKeyPress,
  setInput,
  isOpen,
  toggleChat,
  clearChat,
  showCallPrompt,
  setShowCallPrompt,
  initiateCall
}) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle touch events for better mobile interaction
  useEffect(() => {
    const button = sendButtonRef.current;
    if (!button) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      button.style.transform = 'scale(0.95)';
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      button.style.transform = 'scale(1)';
      handleSend();
    };

    button.addEventListener('touchstart', handleTouchStart);
    button.addEventListener('touchend', handleTouchEnd);

    return () => {
      button.removeEventListener('touchstart', handleTouchStart);
      button.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleSend]);

  return (
    <div className="fixed inset-0 z-50">
      <div 
        className={`fixed inset-0 bg-black/50 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`} 
        onClick={toggleChat}
      />
      
      <div className={`fixed inset-x-0 bottom-0 transform transition-transform duration-300 ease-out ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-t-2xl border-t border-blue-700 shadow-2xl h-[85vh] flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-blue-700 bg-gradient-to-r from-blue-800 to-purple-800 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <AILogo />
              </div>
              <span className="text-lg font-semibold text-white">OmniHealth Assistant</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={(e) => { e.stopPropagation(); clearChat(); }}
                variant="ghost"
                size="sm"
                className="text-gray-300 hover:text-white rounded-full"
              >
                <Plus className="h-5 w-5" />
              </Button>
              <Button
                onClick={toggleChat}
                variant="ghost"
                size="sm"
                className="text-gray-300 hover:text-white rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Chat Messages */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
          >
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <AILogo />
                  </div>
                )}
                <div className={`max-w-[80%] p-4 rounded-2xl shadow-lg ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white ml-12'
                    : 'bg-gradient-to-br from-gray-800 to-gray-900 border border-blue-500/30 text-gray-100'
                }`}>
                  {message.role === 'user' ? (
                    <div className="text-base">{message.parts[0].text}</div>
                  ) : (
                    <div 
                      className="text-base prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: formatResponse(message.parts[0].text) }}
                    />
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-white">You</span>
                  </div>
                )}
              </motion.div>
            ))}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center space-x-2 text-gray-400"
              >
                <div className="flex space-x-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 bg-blue-500 rounded-full"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 1, 0.5]
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2
                      }}
                    />
                  ))}
                </div>
                <span className="text-sm">AI is thinking...</span>
              </motion.div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-gray-700 bg-gray-900/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 py-3 text-base bg-gray-800 border-gray-600 rounded-full"
                disabled={isLoading}
              />
              <Button
                ref={sendButtonRef}
                onClick={handleSend}
                disabled={isLoading}
                className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Chat Button */}
      {!isOpen && (
        <div className="fixed bottom-6 inset-x-4">
          <Button
            onClick={toggleChat}
            className="w-full h-14 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-full shadow-lg flex items-center justify-center gap-2"
          >
            <AILogo />
            <span className="text-base font-medium">Chat with AI Assistant</span>
          </Button>
        </div>
      )}

      {/* Call Prompt Modal */}
      {showCallPrompt && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center p-4 z-[99999]">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl"
          >
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4 text-white">Get a Call from OmniHealth</h3>
              <p className="mb-6 text-gray-300">Would you like to receive a call with more information about our services?</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowCallPrompt(false)}>
                  Cancel
                </Button>
                <Button onClick={initiateCall} className="bg-blue-600 hover:bg-blue-700">
                  Call Me
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export function AIAssistant(): JSX.Element {
  const { user } = useUser();
  const [messages, setMessages] = useState<ChatHistory>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [showIntro, setShowIntro] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showCallPrompt, setShowCallPrompt] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobileDevice();

  // Load chat history on component mount
  useEffect(() => {
    async function loadHistory() {
      if (!user?.id) return;
      
      try {
        const savedHistory = await redis.get<StoredHistory>(`chat:${user.id}`);
        if (savedHistory) {
          setMessages(savedHistory.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.content }]
          })));
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    }

    loadHistory();
  }, [user?.id]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !user?.id) return;
    
    setIsLoading(true);
    const userMessage: ChatMessage = {
      role: 'user',
      parts: [{ text: input.trim() }]
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const chat = model.startChat({
        history: messages,
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      });

      const result = await chat.sendMessage([{
        text: `You are OmniHealth's friendly and knowledgeable AI healthcare assistant. Engage in natural, conversational dialogue while helping users discover and understand our health assistants.

Context: OmniHealth offers several specialized AI health assistants:

1. 🍎 [Nutrition Analyzer](/nutrition-analyzer)
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

2. 📋 [Diet Planner](/diet-planner)
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

3. 💪 [Exercise Coach](/exercise-coach)
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

4. 🏥 [Symptom Analyzer](/symptom-analyzer)
   - Advanced symptom analysis using medical AI
   - Provides potential condition insights
   - Generates structured analysis reports
   - Considers medical history and context
   - Suggests follow-up actions and precautions

5. 💊 [MedInfo](/medinfo)
   - Medication information analysis
   - Scans and analyzes medication images
   - Provides detailed pharmaceutical information
   - Checks drug interactions and safety
   - Maintains medication history
   - Offers usage guidelines and precautions

6. 🧠 [Mental Health Assistant](/mental-health-assistant)
   - Confidential mental wellness support
   - Mood tracking and analysis
   - Stress management techniques
   - Maintains conversation history for continuity
   - Provides structured support sessions
   - Offers crisis resources when needed
   - Integrates with professional mental health guidelines

Previous conversation:
${messages.slice(-3).map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.parts[0].text}`).join('\n')}

Current query: ${input}

Conversation Style:
- Be warm, friendly, and conversational - like a knowledgeable friend
- Use natural language and avoid robotic responses
- Show empathy and understanding
- Keep responses concise but informative
- Ask relevant follow-up questions to better understand needs
- Seamlessly recommend relevant assistants based on the conversation
- When suggesting multiple assistants, explain their synergy naturally

Response Guidelines:
- Place emojis before service names (e.g., "🍎 Nutrition Analyzer")
- Only link to a service on its first mention
- Focus on the three core assistants (Nutrition Analyzer, Diet Planner, Exercise Coach) when relevant
- Avoid mentioning anything about calls or phone conversations in your response text
- End responses with an engaging question that encourages dialogue

Call Recommendation Triggers:
Analyze the conversation flow and suggest a call when:
1. User expresses clear interest in a specific service ("seems the solution for me", "yes", "interested in trying")
2. User asks about next steps or how to get started
3. User shows interest in multiple integrated services
4. User needs detailed setup guidance
5. User has specific questions about service features

When these triggers are met:
- Naturally incorporate a suggestion to speak with a specialist
- Frame it as an opportunity for personalized guidance
- Include "[INITIATE_CALL]" at the end of your response

Example Response with Call Suggestion:
"That's great that you're interested in the 🍎 Nutrition Analyzer! Would you like to speak with one of our specialists who can help you get started and make sure it's perfectly set up for your needs? They can walk you through the first steps and show you how to make the most of all its features."

Remember: The goal is to offer additional support at the right moment, when users show genuine interest and readiness to engage with our services.
Silent Analysis:
Privately analyze if a call would be helpful based on:
- User needs detailed explanation of features
- User wants to understand assistant integration
- User has complex health questions
- User needs help choosing assistants
- User explicitly requests to speak with someone

If a call would be valuable, silently include "[INITIATE_CALL]" at the very end of your response, after your closing question.`
      }]);

      const aiResponse = result.response.text();
      const shouldInitiateCall = aiResponse.includes('[INITIATE_CALL]');
      const cleanResponse = aiResponse.replace('[INITIATE_CALL]', '').trim();

      const aiMessage: ChatMessage = {
        role: 'model',
        parts: [{ text: cleanResponse }]
      };

      setMessages(prev => [...prev, aiMessage]);

      if (shouldInitiateCall) {
        setShowCallPrompt(true);
      }

      // Save to Redis
      try {
        const storedHistory: StoredHistory = messages.map(msg => ({
          role: msg.role,
          content: msg.parts[0].text
        }));
        await redis.set(`chat:${user.id}`, storedHistory, { ex: 3600 });
      } catch (error) {
        console.error('Failed to save chat history:', error);
      }

    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage: ChatMessage = {
        role: 'model',
        parts: [{ text: "I'm sorry, I'm having trouble responding right now. Please try again later." }]
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleChat = () => {
    if (isOpen) {
      setMessages([]);
    }
    setIsOpen(!isOpen);
    if (showIntro) {
      setShowIntro(false);
      localStorage.setItem('hasSeenAIAssistantIntro', 'true');
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    const hasSeenIntro = localStorage.getItem('hasSeenAIAssistantIntro');
    if (hasSeenIntro) {
      setShowIntro(false);
    }
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const initiateCall = async () => {
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      console.log('Initiating call for Clerk user:', user.id);
      const response = await fetch('/api/calling-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clerkUserId: user.id,
          userQuery: messages[messages.length - 2]?.parts[0].text || 'OmniHealth services'
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Call initiation error:', error);
        throw new Error(error.error || 'Failed to initiate call');
      }

      const data = await response.json();
      console.log('Call initiated with SID:', data.callSid);
      
      setMessages(prev => [...prev, {
        role: 'model',
        parts: [{ text: "I've initiated a call to your registered phone number. You should receive it shortly! (Call ID: " + data.callSid + ")" }]
      }]);
      setShowCallPrompt(false);
    } catch (error) {
      console.error('Error initiating call:', error);
      setMessages(prev => [...prev, {
        role: 'model',
        parts: [{ text: error instanceof Error ? error.message : "I'm sorry, there was an error initiating the call. Please try again later." }]
      }]);
    }
  };

  return isMobile ? (
    <MobileAIChat
      messages={messages}
      input={input}
      isLoading={isLoading}
      handleSend={handleSend}
      handleKeyPress={handleKeyPress}
      setInput={setInput}
      isOpen={isOpen}
      toggleChat={toggleChat}
      clearChat={clearChat}
      showCallPrompt={showCallPrompt}
      setShowCallPrompt={setShowCallPrompt}
      initiateCall={initiateCall}
    />
  ) : (
    // Original desktop component remains exactly the same
    <>
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 right-4 bg-gray-800 p-4 rounded-lg shadow-lg z-50 max-w-xs"
          >
            <p className="text-sm text-gray-200">
              Need help? Our AI assistant is here to answer your questions about OmniHealth!
            </p>
            <Button onClick={() => setShowIntro(false)} className="mt-2" variant="outline" size="sm">
              Got it
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-4 right-4 z-50">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={toggleChat}
                className={`rounded-full w-12 h-12 shadow-lg ${
                  isOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                } transition-all duration-300 ease-in-out ${!isOpen && 'animate-pulse'}`}
                aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
              >
                {isOpen ? <X /> : <AILogo />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{isOpen ? "Close AI Assistant" : "Open AI Assistant"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ duration: 0.3 }}
              className={`absolute bottom-16 right-0 ${isExpanded ? 'w-[600px] h-[80vh]' : 'w-96 h-[600px]'}`}
            >
              <Card className="w-full h-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-blue-700 shadow-lg rounded-lg overflow-hidden">
                <CardHeader className="pb-2 flex justify-between items-center border-b border-blue-700 bg-gradient-to-r from-blue-800 to-purple-800">
                  <div className="flex items-center space-x-2">
                    <AILogo />
                    <CardTitle className="text-gray-100">OmniHealth Assistant</CardTitle>
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={clearChat} variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-blue-700 rounded-full">
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button onClick={toggleExpand} variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-blue-700 rounded-full">
                      {isExpanded ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col overflow-hidden bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
                  <div ref={chatRef} className="flex-grow overflow-y-auto space-y-6 p-6">
                    {messages.map((message, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ 
                          duration: 0.4,
                          ease: [0.4, 0, 0.2, 1],
                          delay: index * 0.1 
                        }}
                        className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {message.role !== 'user' && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg flex-shrink-0">
                            <AILogo />
                          </div>
                        )}
                        <div 
                          className={`max-w-[80%] p-4 rounded-lg shadow-md ${
                            message.role === 'user' 
                              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white' 
                              : 'bg-gradient-to-br from-blue-900 to-purple-900 border border-blue-500/30 text-gray-100 backdrop-blur-sm bg-opacity-95'
                          }`}
                        >
                          {message.role === 'user' ? (
                            <div className="text-sm">{message.parts[0].text}</div>
                          ) : (
                            <div 
                              className="text-sm prose prose-invert max-w-none"
                              dangerouslySetInnerHTML={{ 
                                __html: formatResponse(message.parts[0].text) 
                              }} 
                            />
                          )}
                        </div>
                        {message.role === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow-lg flex-shrink-0">
                            <span className="text-xs text-white">You</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center space-x-2 text-gray-400"
                      >
                        <div className="flex space-x-1">
                          <motion.div
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [0.5, 1, 0.5]
                            }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              repeatDelay: 0.2
                            }}
                            className="w-2 h-2 bg-blue-500 rounded-full"
                          />
                          <motion.div
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [0.5, 1, 0.5]
                            }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              repeatDelay: 0.2,
                              delay: 0.2
                            }}
                            className="w-2 h-2 bg-blue-500 rounded-full"
                          />
                          <motion.div
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [0.5, 1, 0.5]
                            }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              repeatDelay: 0.2,
                              delay: 0.4
                            }}
                            className="w-2 h-2 bg-blue-500 rounded-full"
                          />
                        </div>
                        <span className="text-sm">AI is thinking...</span>
                      </motion.div>
                    )}
                  </div>
                  <div className="flex items-center p-4 bg-gray-900 border-t border-gray-700">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type your message..."
                      className="flex-grow mr-2 bg-gray-800 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isLoading}
                    />
                    <Button 
                      onClick={handleSend} 
                      size="icon" 
                      disabled={isLoading} 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-full transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showCallPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999]" style={{ zIndex: 99999 }}>
          <div className="bg-gray-900 p-6 rounded-lg max-w-md w-full border border-gray-700 shadow-xl">
            <h3 className="text-xl font-semibold mb-4 text-white">Get a Call from OmniHealth</h3>
            <p className="mb-6 text-gray-300">Would you like to receive a call with more information about our services?</p>
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowCallPrompt(false)}
                className="bg-transparent hover:bg-gray-800 text-gray-300"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => initiateCall()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Call Me
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}