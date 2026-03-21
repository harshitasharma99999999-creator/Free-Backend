#!/usr/bin/env node

/**
 * Test script for EIOR OpenAI-compatible API endpoints
 * 
 * This script tests the integration endpoints to ensure they work
 * correctly with OpenClaw and other OpenAI-compatible clients.
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.EIOR_BASE_URL || 'http://localhost:4000/eior/v1';
const API_KEY = process.env.EIOR_API_KEY || 'fk_test_key_12345678901234567890123456';

console.log('🧪 Testing EIOR OpenAI-compatible API endpoints...\n');

async function testEndpoint(name, url, options = {}) {
  console.log(`Testing ${name}...`);
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${name} - Success`);
      if (options.verbose) {
        console.log(JSON.stringify(data, null, 2));
      }
    } else {
      console.log(`❌ ${name} - Failed (${response.status})`);
      console.log(JSON.stringify(data, null, 2));
    }
    
    console.log('');
    return { success: response.ok, data };
  } catch (error) {
    console.log(`❌ ${name} - Error: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  // Test 0: List models (no auth required)
  console.log('Testing GET /models (no auth)...');
  try {
    const response = await fetch(`${BASE_URL}/models`);
    const data = await response.json();

    if (response.ok) {
      console.log('✅ GET /models (no auth) - Success');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ GET /models (no auth) - Failed (${response.status})`);
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log(`❌ GET /models (no auth) - Error: ${error.message}`);
  }
  console.log('');

  // Test 1: List models
  await testEndpoint(
    'GET /models',
    `${BASE_URL}/models`,
    { method: 'GET', verbose: true }
  );

  // Test 2: Get specific model
  await testEndpoint(
    'GET /models/eior-v1',
    `${BASE_URL}/models/eior-v1`,
    { method: 'GET' }
  );

  // Test 3: Chat completion (non-streaming)
  await testEndpoint(
    'POST /chat/completions (non-streaming)',
    `${BASE_URL}/chat/completions`,
    {
      method: 'POST',
      body: JSON.stringify({
        model: 'eior-v1',
        messages: [
          { role: 'user', content: 'Hello, EIOR! This is a test message.' }
        ],
        max_tokens: 100,
        temperature: 0.7
      })
    }
  );

  // Test 4: Chat completion (streaming)
  console.log('Testing POST /chat/completions (streaming)...');
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'eior-v1',
        messages: [
          { role: 'user', content: 'Count from 1 to 5.' }
        ],
        stream: true,
        max_tokens: 50
      })
    });

    if (response.ok) {
      console.log('✅ Streaming chat completion - Success');
      console.log('📡 Streaming response chunks:');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let chunks = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              console.log('   [DONE]');
            } else {
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                if (content) {
                  process.stdout.write(content);
                  chunks++;
                }
              } catch (e) {
                // Ignore parsing errors for partial chunks
              }
            }
          }
        }
      }
      
      console.log(`\n   Received ${chunks} content chunks`);
    } else {
      console.log(`❌ Streaming chat completion - Failed (${response.status})`);
    }
  } catch (error) {
    console.log(`❌ Streaming chat completion - Error: ${error.message}`);
  }
  console.log('');

  // Test 5: Image generation
  await testEndpoint(
    'POST /images/generations',
    `${BASE_URL}/images/generations`,
    {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'A beautiful sunset over mountains',
        model: 'eior-image-gen',
        n: 1,
        size: '1024x1024',
        response_format: 'url'
      })
    }
  );

  // Test 6: Embeddings
  await testEndpoint(
    'POST /embeddings',
    `${BASE_URL}/embeddings`,
    {
      method: 'POST',
      body: JSON.stringify({
        model: 'eior-embeddings',
        input: 'This is a test sentence for embeddings.'
      })
    }
  );

  // Test 7: Error handling - Invalid API key
  console.log('Testing error handling (invalid API key)...');
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer invalid_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'eior-v1',
        messages: [{ role: 'user', content: 'Hello!' }],
        max_tokens: 10,
      }),
    });

    const data = await response.json();
    
    if (response.status === 401) {
      console.log('✅ Error handling - Correctly rejected invalid API key');
    } else {
      console.log(`❌ Error handling - Unexpected status: ${response.status}`);
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log(`❌ Error handling test failed: ${error.message}`);
  }
  console.log('');

  console.log('🎉 EIOR OpenAI-compatible API testing complete!');
  console.log('\n📋 Integration Summary:');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   API Key: ${API_KEY.slice(0, 10)}...`);
  console.log('   Available models: eior-v1, eior-advanced, eior-image-gen');
  console.log('\n🔗 To use with OpenClaw:');
  console.log(`   export OPENCLAW_BASE_URL="${BASE_URL}"`);
  console.log(`   export OPENCLAW_API_KEY="${API_KEY}"`);
  console.log('   export OPENCLAW_MODEL="eior-v1"');
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests, testEndpoint };
