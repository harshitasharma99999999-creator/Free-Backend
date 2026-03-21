#!/usr/bin/env node

/**
 * Example: Using EIOR with OpenClaw
 * 
 * This example demonstrates how to configure and use EIOR models
 * with OpenClaw for various AI tasks including chat, coding, and image generation.
 */

import { OpenAI } from 'openai';

// Configure OpenAI client to use EIOR endpoint
const eior = new OpenAI({
  baseURL: 'https://your-eior-domain.com/eior/v1',
  apiKey: process.env.EIOR_API_KEY || 'fk_your_api_key_here',
});

async function chatExample() {
  console.log('🤖 EIOR Chat Example');
  console.log('===================\n');

  try {
    const completion = await eior.chat.completions.create({
      model: 'eior-v1',
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant powered by EIOR.' },
        { role: 'user', content: 'Explain quantum computing in simple terms.' }
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    console.log('Response:', completion.choices[0].message.content);
    console.log(`\nTokens used: ${completion.usage.total_tokens}`);
  } catch (error) {
    console.error('Chat error:', error.message);
  }
}

async function streamingChatExample() {
  console.log('\n🌊 EIOR Streaming Chat Example');
  console.log('==============================\n');

  try {
    const stream = await eior.chat.completions.create({
      model: 'eior-advanced',
      messages: [
        { role: 'user', content: 'Write a short poem about artificial intelligence.' }
      ],
      stream: true,
      max_tokens: 150,
    });

    console.log('Streaming response:');
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        process.stdout.write(content);
      }
    }
    console.log('\n');
  } catch (error) {
    console.error('Streaming error:', error.message);
  }
}

async function codingAssistantExample() {
  console.log('\n💻 EIOR Coding Assistant Example');
  console.log('=================================\n');

  try {
    const completion = await eior.chat.completions.create({
      model: 'eior-advanced',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert programming assistant. Provide clean, well-commented code.' 
        },
        { 
          role: 'user', 
          content: 'Write a Python function to calculate the Fibonacci sequence up to n terms.' 
        }
      ],
      max_tokens: 300,
      temperature: 0.3, // Lower temperature for more consistent code
    });

    console.log('Generated code:');
    console.log(completion.choices[0].message.content);
  } catch (error) {
    console.error('Coding assistant error:', error.message);
  }
}

async function imageGenerationExample() {
  console.log('\n🎨 EIOR Image Generation Example');
  console.log('=================================\n');

  try {
    const image = await eior.images.generate({
      model: 'eior-image-gen',
      prompt: 'A futuristic AI robot working alongside humans in a modern office',
      n: 1,
      size: '1024x1024',
      response_format: 'url',
    });

    console.log('Generated image URL:', image.data[0].url);
    console.log('You can view this image in your browser or download it.');
  } catch (error) {
    console.error('Image generation error:', error.message);
  }
}

async function listModelsExample() {
  console.log('\n📋 Available EIOR Models');
  console.log('=========================\n');

  try {
    const models = await eior.models.list();
    
    console.log('Available models:');
    models.data.forEach(model => {
      console.log(`- ${model.id} (owned by ${model.owned_by})`);
    });
  } catch (error) {
    console.error('Models list error:', error.message);
  }
}

async function functionCallingExample() {
  console.log('\n🔧 EIOR Function Calling Example');
  console.log('==================================\n');

  try {
    const completion = await eior.chat.completions.create({
      model: 'eior-advanced',
      messages: [
        { role: 'user', content: 'What\'s the weather like in San Francisco?' }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get the current weather in a given location',
            parameters: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'The city and state, e.g. San Francisco, CA',
                },
                unit: {
                  type: 'string',
                  enum: ['celsius', 'fahrenheit'],
                  description: 'The temperature unit to use',
                },
              },
              required: ['location'],
            },
          },
        },
      ],
      tool_choice: 'auto',
    });

    const message = completion.choices[0].message;
    
    if (message.tool_calls?.length) {
      const tc = message.tool_calls[0];
      console.log('Tool called:', tc.function.name);
      console.log('Arguments:', tc.function.arguments);
    } else {
      console.log('Response:', message.content);
    }
  } catch (error) {
    console.error('Function calling error:', error.message);
  }
}

// OpenClaw Configuration Examples
function showOpenClawConfig() {
  console.log('\n⚙️  OpenClaw Configuration Examples');
  console.log('====================================\n');

  console.log('1. Environment Variables:');
  console.log('export EIOR_BASE_URL="https://your-eior-domain.com/eior/v1"');
  console.log('export EIOR_API_KEY="fk_your_api_key_here"');
  console.log('');

  console.log('2. OpenClaw JSON Config (~/.openclaw/openclaw.json):');
  console.log(JSON.stringify({
    models: {
      providers: {
        eior: {
          baseUrl: '${EIOR_BASE_URL}',
          apiKey: '${EIOR_API_KEY}',
          api: 'openai-completions',
          models: [
            { id: 'eior-v1', name: 'EIOR v1' },
            { id: 'eior-advanced', name: 'EIOR Advanced' },
            { id: 'eior-coder', name: 'EIOR Coder' },
            { id: 'eior-image-gen', name: 'EIOR Image Gen' },
          ]
        }
      }
    },
    agents: {
      defaults: {
        model: {
          primary: 'eior/eior-v1'
        }
      }
    }
  }, null, 2));
  console.log('');

  console.log('3. CLI Commands:');
  console.log('openclaw config set models.providers.eior.baseUrl "https://your-eior-domain.com/eior/v1"');
  console.log('openclaw config set models.providers.eior.apiKey "${EIOR_API_KEY}"');
  console.log('openclaw config set models.providers.eior.api "openai-completions"');
  console.log('openclaw config set agents.defaults.model.primary "eior/eior-v1"');
}

// Main execution
async function main() {
  console.log('🚀 EIOR + OpenClaw Integration Examples');
  console.log('========================================\n');

  // Check if API key is provided
  if (!process.env.EIOR_API_KEY || process.env.EIOR_API_KEY === 'fk_your_api_key_here') {
    console.log('⚠️  Please set your EIOR_API_KEY environment variable to run live examples.');
    console.log('   export EIOR_API_KEY="fk_your_actual_api_key_here"');
    console.log('\nShowing configuration examples instead...\n');
    showOpenClawConfig();
    return;
  }

  // Run all examples
  await listModelsExample();
  await chatExample();
  await streamingChatExample();
  await codingAssistantExample();
  await imageGenerationExample();
  await functionCallingExample();
  
  showOpenClawConfig();

  console.log('\n✅ All examples completed!');
  console.log('\n🔗 Next Steps:');
  console.log('1. Install OpenClaw: npm install -g openclaw');
  console.log('2. Configure EIOR as shown above');
  console.log('3. Start chatting: openclaw chat "Hello EIOR!"');
}

// Run examples if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { 
  chatExample, 
  streamingChatExample, 
  codingAssistantExample, 
  imageGenerationExample, 
  listModelsExample, 
  functionCallingExample 
};
