#!/usr/bin/env node

/**
 * Test API server endpoints
 */

console.log('🧪 Testing API Server\n');

const BASE_URL = 'http://localhost:3001';

async function testEndpoint(name, url) {
  try {
    const response = await fetch(url);
    const data = await response.json();

    console.log(`✓ ${name}`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Data:`, JSON.stringify(data, null, 2).slice(0, 200) + '...\n');

    return data;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error.message}\n`);
    return null;
  }
}

async function testSSE() {
  console.log('Testing SSE stream...');
  console.log('(Connect and wait for events for 10 seconds)\n');

  const response = await fetch(`${BASE_URL}/api/events/stream`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  const timeout = setTimeout(() => {
    console.log('✓ SSE test complete\n');
    reader.cancel();
  }, 10000);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    console.log('  SSE event:', chunk.trim());
  }

  clearTimeout(timeout);
}

async function main() {
  // Test REST endpoints
  const sessions = await testEndpoint('GET /api/sessions', `${BASE_URL}/api/sessions`);

  if (sessions && sessions.sessions && sessions.sessions.length > 0) {
    const sessionId = sessions.sessions[0].id;

    await testEndpoint(
      `GET /api/sessions/${sessionId}`,
      `${BASE_URL}/api/sessions/${sessionId}`
    );

    await testEndpoint(
      `GET /api/sessions/${sessionId}/events`,
      `${BASE_URL}/api/sessions/${sessionId}/events?limit=10`
    );

    await testEndpoint(
      `GET /api/sessions/${sessionId}/file-activity`,
      `${BASE_URL}/api/sessions/${sessionId}/file-activity`
    );

    await testEndpoint(
      `GET /api/sessions/${sessionId}/command-stats`,
      `${BASE_URL}/api/sessions/${sessionId}/command-stats`
    );

    await testEndpoint(
      `GET /api/sessions/${sessionId}/file-tree`,
      `${BASE_URL}/api/sessions/${sessionId}/file-tree`
    );
  }

  // Test SSE
  await testSSE();

  console.log('✓ All API tests complete\n');
}

main();
