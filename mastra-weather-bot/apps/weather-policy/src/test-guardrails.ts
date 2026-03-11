/**
 * Test script for weather guardrails.
 *
 * Prerequisites:
 *   - Environment variables must be set (OpenAI/model keys, etc.).
 *
 * Run with:
 *   npm run test:guardrails
 */

import { TripWire } from '@mastra/core/agent';
import { mastra } from './mastra/index';

async function testInputGuardrail() {
  console.log('=== Test: Input Guardrail ===');
  console.log('Sending non-weather message: "¿Cuál es la capital de Francia?"');

  const agent = mastra.getAgent('weatherPolicyAgent');

  try {
    const result = await agent.generate('¿Cuál es la capital de Francia?');
    console.log('FAIL: Message should have been blocked');
    console.log('Response:', result.text);
  } catch (error) {
    if (error instanceof TripWire) {
      console.log('PASS: Input guardrail blocked the message');
      console.log('Reason:', error.message);
    } else {
      console.log('FAIL: Unexpected error:', error);
    }
  }
}

async function testValidWeatherMessage() {
  console.log('\n=== Test: Valid Weather Message ===');
  console.log('Sending: "¿Qué me pongo para salir hoy en Valladolid?"');

  const agent = mastra.getAgent('weatherPolicyAgent');

  try {
    const result = await agent.generate('¿Qué me pongo para salir hoy en Valladolid?');
    console.log('PASS: Weather message accepted');
    console.log('Response:', result.text?.substring(0, 300) + '...');
  } catch (error) {
    if (error instanceof TripWire) {
      console.log('INFO: TripWire from output guardrail (retry triggered):', error.message);
    } else {
      console.log('ERROR:', error);
    }
  }
}

testInputGuardrail()
  .then(() => testValidWeatherMessage())
  .catch(console.error);
