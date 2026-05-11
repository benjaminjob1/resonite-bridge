#!/usr/bin/env node
/**
 * Resonite Bridge - Pi Side (OpenClaw side)
 * Handles two-way voice + text + visual with Resonite
 * 
 * Usage: PI_HOST=<tailscale-ip> node bridge.js
 */

const { WebSocket } = require('ws');
const http = require('http');

// Config
const PI_HOST = process.env.PI_HOST || 'localhost';
const PI_PORT = process.env.PI_PORT || 8765;
const RESONITE_SERVER_WS = `ws://${PI_HOST}:8765`;
const OPENCLAW_WS = `ws://127.0.0.1:18789`;
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '';

// State
let resoniteWs = null;
let openclawWs = null;
let sessionReady = false;

// Connect to Resonite Server (local side)
function connectToResoniteServer() {
  console.log('🔗 Connecting to Resonite Server...');
  
  resoniteWs = new WebSocket(RESONITE_SERVER_WS);

  resoniteWs.on('open', () => {
    console.log('✅ Connected to Resonite Server');
    resoniteWs.send(JSON.stringify({
      type: 'Hello',
      version: '1.0',
      capabilities: ['voice', 'text', 'visual', 'interactive']
    }));
  });

  resoniteWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleResoniteMessage(msg);
    } catch (e) {
      // Raw audio data
      handleRawAudio(data);
    }
  });

  resoniteWs.on('close', () => {
    console.log('❌ Resonite Server disconnected');
    setTimeout(connectToResoniteServer, 5000);
  });

  resoniteWs.on('error', (err) => {
    console.error('Resonite error:', err.message);
  });
}

// Handle messages from Resonite
function handleResoniteMessage(msg) {
  console.log('[Resonite]', msg.type);
  
  switch (msg.type) {
    case 'Hello':
      console.log('   Resonite connected, capabilities:', msg.capabilities);
      break;
      
    case 'Audio':
      // Raw audio from Resonite (PCM 16-bit 24kHz)
      if (openclawWs && openclawWs.readyState === 1 && sessionReady) {
        // Forward audio to OpenClaw Realtime API
        openclawWs.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: msg.data // base64 encoded
        }));
      }
      break;
      
    case 'Text':
      // Text message from Resonite user
      if (openclawWs && openclawWs.readyState === 1 && sessionReady) {
        openclawWs.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: msg.text }]
          }
        }));
        openclawWs.send(JSON.stringify({ type: 'response.create' }));
      }
      break;
      
    case 'Visual':
      // Visual data (screenshot, world state)
      if (openclawWs && openclawWs.readyState === 1) {
        openclawWs.send(JSON.stringify({
          type: 'visual_input',
          data: msg.data
        }));
      }
      break;
      
    case 'Interactive':
      // World object interaction data
      if (openclawWs && openclawWs.readyState === 1) {
        openclawWs.send(JSON.stringify({
          type: 'interactive_data',
          data: msg.data
        }));
      }
      break;
      
    case 'Ping':
      resoniteWs.send(JSON.stringify({ type: 'Pong' }));
      break;
  }
}

// Handle raw audio data
function handleRawAudio(data) {
  if (openclawWs && openclawWs.readyState === 1 && sessionReady) {
    // Forward raw audio buffer
    const base64 = data.toString('base64');
    openclawWs.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: base64
    }));
  }
}

// Connect to OpenClaw gateway
function connectToOpenClaw() {
  console.log('🔗 Connecting to OpenClaw...');
  
  openclawWs = new WebSocket(OPENCLAW_WS, {
    headers: { 'Authorization': `Bearer ${OPENCLAW_TOKEN}` }
  });

  openclawWs.on('open', () => {
    console.log('✅ Connected to OpenClaw');
    openclawWs.send(JSON.stringify({
      type: 'session.attach',
      sessionId: 'resonite-bridge'
    }));
  });

  openclawWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleOpenClawMessage(msg);
    } catch (e) {
      console.error('OpenClaw parse error:', e);
    }
  });

  openclawWs.on('close', () => {
    console.log('❌ OpenClaw disconnected');
    openclawWs = null;
    sessionReady = false;
    setTimeout(connectToOpenClaw, 5000);
  });

  openclawWs.on('error', (err) => {
    console.error('OpenClaw error:', err.message);
  });
}

// Handle messages from OpenClaw
function handleOpenClawMessage(msg) {
  // Handle audio response from AI
  if (msg.type === 'session.created') {
    sessionReady = true;
    console.log('🎙️ OpenClaw session ready - can receive audio');
  }
  
  if (msg.type === 'response.audio.delta' || msg.type === 'audio_delta') {
    // AI voice response - send to Resonite
    const audio = msg.delta || msg.audio;
    if (resoniteWs && resoniteWs.readyState === 1) {
      resoniteWs.send(JSON.stringify({
        type: 'PlayAudio',
        audio: audio,
        spatial: true
      }));
    }
  }
  
  if (msg.type === 'response.done' || msg.type === 'response_complete') {
    console.log('✅ AI response complete');
  }
  
  if (msg.type === 'conversation.item.input_audio_transcription.completed') {
    console.log('📝 Transcript:', msg.transcript);
  }
  
  if (msg.type === 'error') {
    console.error('OpenClaw error:', msg.message);
  }
}

// Heartbeat
setInterval(() => {
  if (resoniteWs && resoniteWs.readyState === 1) {
    resoniteWs.send(JSON.stringify({ type: 'Heartbeat' }));
  }
}, 25000);

// Start
console.log('🎙️ Resonite Bridge starting...');
console.log(`   Resonite Server: ${RESONITE_SERVER_WS}`);
console.log(`   OpenClaw Gateway: ${OPENCLAW_WS}`);

connectToResoniteServer();
connectToOpenClaw();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  if (resoniteWs) resoniteWs.close();
  if (openclawWs) openclawWs.close();
  process.exit(0);
});