/**
 * Mock AI Service for Bot Editor
 * Phase 3: AI Chat Implementation
 *
 * This service simulates AI responses for bot building.
 * In production, replace with actual AI API calls.
 */

import type { Node } from '@/lib/bot-editor/types/bot.types'
import type { AIResponse, QuickPrompt } from '@/components/bot-editor/chat/types'

// Helper to generate unique IDs
const generateId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

// Helper to calculate node positions
let yOffset = 0
const getNextPosition = () => {
  const pos = { x: 100, y: yOffset }
  yOffset += 150
  return pos
}

// Reset y-offset for new flows
const resetPositions = () => {
  yOffset = 0
}

/**
 * Analyzes user prompt and generates appropriate bot nodes
 */
function analyzePrompt(prompt: string): AIResponse {
  resetPositions()
  const lowerPrompt = prompt.toLowerCase()

  // Welcome message / Greeting patterns
  if (lowerPrompt.match(/welcome|greeting|hello|start|new user|greet/)) {
    return {
      message: "I've created a welcome flow for new users! The bot will send a greeting message when someone starts the conversation.",
      nodes: [
        {
          id: generateId('msg'),
          type: 'message',
          position: getNextPosition(),
          data: {
            __label: 'Welcome Message',
            __description: 'Hello! Welcome to our bot!',
            text: 'Hello! Welcome to our bot! How can I help you today?'
          }
        }
      ],
      suggestions: [
        'Add a menu with options',
        'Ask for user name',
        'Send an introduction image'
      ]
    }
  }

  // Menu / Options patterns
  if (lowerPrompt.match(/menu|options|buttons|choice|select/)) {
    return {
      message: "I've created an interactive menu with options. Users can select from predefined choices.",
      nodes: [
        {
          id: generateId('msg'),
          type: 'message',
          position: getNextPosition(),
          data: {
            _label: 'Menu Message',
            _description: 'Please select an option:',
            text: 'Please select an option:',
            buttons: ['Products', 'Support', 'About', 'Contact']
          }
        },
        {
          id: generateId('input'),
          type: 'input',
          position: getNextPosition(),
          data: {
            _label: 'Wait for Selection',
            _description: 'Capture user choice',
            variable: 'menu_choice'
          }
        },
        {
          id: generateId('cond'),
          type: 'condition',
          position: getNextPosition(),
          data: {
            _label: 'Route Selection',
            _description: 'Branch based on choice',
            condition: 'menu_choice == "Products"',
            trueLabel: 'Show Products',
            falseLabel: 'Other Options'
          }
        }
      ],
      suggestions: [
        'Add more menu options',
        'Create sub-menus',
        'Add a back button'
      ]
    }
  }

  // Keyword / Responder patterns
  if (lowerPrompt.match(/keyword|respond|reply|trigger|command|\/start/)) {
    return {
      message: "I've set up a keyword responder that triggers when users send specific messages or commands.",
      nodes: [
        {
          id: generateId('cond'),
          type: 'condition',
          position: getNextPosition(),
          data: {
            _label: 'Keyword Check',
            _description: 'Check for specific keyword',
            condition: 'message.text contains "help"',
            trueLabel: 'Send Help',
            falseLabel: 'Continue'
          }
        },
        {
          id: generateId('msg'),
          type: 'message',
          position: { x: 400, y: 0 },
          data: {
            _label: 'Help Response',
            _description: 'Send help information',
            text: 'Here are the available commands:\n/help - Show this message\n/start - Begin the flow\n/settings - Configure options'
          }
        }
      ],
      suggestions: [
        'Add more keywords',
        'Case-insensitive matching',
        'Multiple keyword responses'
      ]
    }
  }

  // Condition / Branch patterns
  if (lowerPrompt.match(/condition|branch|if|else|check|verify/)) {
    return {
      message: "I've created a conditional branch that checks user data or input and routes the conversation accordingly.",
      nodes: [
        {
          id: generateId('cond'),
          type: 'condition',
          position: getNextPosition(),
          data: {
            _label: 'User Check',
            _description: 'Check if user is registered',
            condition: 'user.is_registered == true',
            trueLabel: 'Registered User',
            falseLabel: 'New User Flow'
          }
        },
        {
          id: generateId('msg1'),
          type: 'message',
          position: { x: 400, y: 0 },
          data: {
            _label: 'Welcome Back',
            _description: 'Message for returning users',
            text: 'Welcome back! What would you like to do today?'
          }
        },
        {
          id: generateId('msg2'),
          type: 'message',
          position: { x: 400, y: 150 },
          data: {
            _label: 'Registration Prompt',
            _description: 'Ask new user to register',
            text: 'Welcome! Please register to continue.'
          }
        }
      ],
      suggestions: [
        'Add more conditions',
        'Check subscription status',
        'Validate user input'
      ]
    }
  }

  // Action / Variable patterns
  if (lowerPrompt.match(/variable|save|store|action|set|data/)) {
    return {
      message: "I've created nodes to store user data and perform actions based on the information collected.",
      nodes: [
        {
          id: generateId('input'),
          type: 'input',
          position: getNextPosition(),
          data: {
            _label: 'Request Name',
            _description: 'Ask for user name',
            variable: 'user_name',
            prompt: 'What is your name?'
          }
        },
        {
          id: generateId('action'),
          type: 'action',
          position: getNextPosition(),
          data: {
            _label: 'Save Name',
            _description: 'Store user name in database',
            action: 'set_variable',
            variable: 'user.name',
            value: '{user_name}'
          }
        },
        {
          id: generateId('msg'),
          type: 'message',
          position: getNextPosition(),
          data: {
            _label: 'Confirmation',
            _description: 'Confirm data saved',
            text: 'Nice to meet you, {user.name}!'
          }
        }
      ],
      suggestions: [
        'Add email collection',
        'Save to external database',
        'Validate input format'
      ]
    }
  }

  // HTTP / API patterns
  if (lowerPrompt.match(/webhook|api|external|fetch|http|request|integration/)) {
    return {
      message: "I've created an HTTP node that calls an external API and uses the response in your bot flow.",
      nodes: [
        {
          id: generateId('http'),
          type: 'http',
          position: getNextPosition(),
          data: {
            _label: 'Fetch Weather',
            _description: 'Call weather API',
            url: 'https://api.example.com/weather',
            method: 'GET',
            headers: [{ key: 'Authorization', value: 'Bearer YOUR_API_KEY' }],
            saveToVariable: 'weather_data'
          }
        },
        {
          id: generateId('cond'),
          type: 'condition',
          position: getNextPosition(),
          data: {
            _label: 'Check Response',
            _description: 'Verify API response',
            condition: 'weather_data.success == true',
            trueLabel: 'Show Weather',
            falseLabel: 'Show Error'
          }
        },
        {
          id: generateId('msg'),
          type: 'message',
          position: { x: 400, y: 150 },
          data: {
            _label: 'Weather Result',
            _description: 'Display weather info',
            text: 'The current temperature is {weather_data.temp}°C'
          }
        }
      ],
      suggestions: [
        'Add error handling',
        'Cache API responses',
        'Add retry logic'
      ]
    }
  }

  // Survey / Form patterns
  if (lowerPrompt.match(/survey|form|questions|ask|collect|feedback/)) {
    return {
      message: "I've created a survey flow that collects multiple pieces of information from the user.",
      nodes: [
        {
          id: generateId('input1'),
          type: 'input',
          position: getNextPosition(),
          data: {
            _label: 'Question 1',
            _description: 'Ask first question',
            variable: 'q1_answer',
            prompt: 'What is your favorite color?'
          }
        },
        {
          id: generateId('input2'),
          type: 'input',
          position: getNextPosition(),
          data: {
            _label: 'Question 2',
            _description: 'Ask second question',
            variable: 'q2_answer',
            prompt: 'How did you hear about us?'
          }
        },
        {
          id: generateId('input3'),
          type: 'input',
          position: getNextPosition(),
          data: {
            _label: 'Question 3',
            _description: 'Ask for feedback',
            variable: 'feedback',
            prompt: 'Any additional feedback?'
          }
        },
        {
          id: generateId('action'),
          type: 'action',
          position: getNextPosition(),
          data: {
            _label: 'Save Survey',
            _description: 'Store all responses',
            action: 'save_survey',
            data: {
              q1: '{q1_answer}',
              q2: '{q2_answer}',
              feedback: '{feedback}'
            }
          }
        },
        {
          id: generateId('msg'),
          type: 'message',
          position: getNextPosition(),
          data: {
            _label: 'Thank You',
            _description: 'Survey completion message',
            text: 'Thank you for your feedback! We appreciate your time.'
          }
        }
      ],
      suggestions: [
        'Add conditional questions',
        'Include rating scale',
        'Send confirmation email'
      ]
    }
  }

  // Default fallback response
  return {
    message: `I understand you want to build something related to "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}". Let me create a basic flow structure that you can customize.\n\nTo get more specific results, try describing:\n• "Create a welcome message for new users"\n• "Add a menu with 3 options"\n• "Set up a keyword responder"\n• "Create a survey form"`,
    nodes: [
      {
        id: generateId('msg'),
        type: 'message',
        position: getNextPosition(),
        data: {
          _label: 'New Message',
          _description: 'Custom message node',
          text: 'Your message here...'
        }
      }
    ],
    suggestions: [
      'Try being more specific about what you want',
      'Mention specific features like menus, conditions, or HTTP requests',
      'Describe the flow step by step'
    ]
  }
}

/**
 * Simulates AI response with a delay
 */
export async function mockAIResponse(prompt: string): Promise<AIResponse> {
  // Simulate network delay (1-2 seconds)
  const delay = 1000 + Math.random() * 1000

  await new Promise(resolve => setTimeout(resolve, delay))

  return analyzePrompt(prompt)
}

/**
 * Quick prompts for user convenience
 */
export const QUICK_PROMPTS: QuickPrompt[] = [
  { id: '1', label: 'Create welcome message', prompt: 'Create a welcome message for new users', icon: '👋' },
  { id: '2', label: 'Add menu with options', prompt: 'Add a simple menu with 3 options', icon: '📋' },
  { id: '3', label: 'Keyword responder', prompt: 'Set up a keyword responder', icon: '🔑' },
  { id: '4', label: 'Survey form', prompt: 'Create a survey form with 3 questions', icon: '📝' },
  { id: '5', label: 'Conditional flow', prompt: 'Add a condition to check if user is registered', icon: '🔀' },
  { id: '6', label: 'HTTP integration', prompt: 'Add an HTTP node to fetch external data', icon: '🔗' },
]
