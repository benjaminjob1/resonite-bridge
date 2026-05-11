#!/usr/bin/env node
/**
 * Resonite Bridge Server - Resonite side (runs on user's machine)
 * Connects to Resonite headless + Pi bridge for two-way AI interaction
 * 
 * Usage: PI_HOST=<pi-tailscale-ip> node server.js
 */

const { WebSocket } = require('ws');
const readline = require('readline');

const PI_HOST = process.env.PI_HOST || 'localhost';
const PI_PORT = process.env.PI_PORT || 8765;
const PI_BRIDGE_WS = `ws://${PI_HOST}:${PI_PORT}`;
const RESONITE_WS = 'ws://localhost:9090';

let bridgeWs = null;
let resoniteWs = null;
let audioQueue = [];
let lastAudioTime = 0;

// Connect to Pi Bridge
function connectToBridge() {
  console.log('🔗 Connecting to Pi Bridge...');
  
  bridgeWs = new WebSocket(PI_BRIDGE_WS);

  bridgeWs.on('open', () => {
    console.log('✅ Connected to Pi Bridge (BenBot)');
    bridgeWs.send(JSON.stringify({ type: 'Hello', version: '1.0' }));
  });

  bridgeWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleBridgeMessage(msg);
    } catch (e) {
      console.error('Bridge parse error:', e);
    }
  });

  bridgeWs.on('close', () => {
    console.log('❌ Pi Bridge disconnected');
    bridgeWs = null;
    setTimeout(connectToBridge, 5000);
  });

  bridgeWs.on('error', (err) => {
    console.error('Bridge error:', err.message);
  });
}

// Handle messages from Pi Bridge (BenBot)
function handleBridgeMessage(msg) {
  switch (msg.type) {
    case 'PlayAudio':
      // Receive AI audio response
      if (resoniteWs && resoniteWs.readyState === 1) {
        resoniteWs.send(JSON.stringify({
          type: 'Audio',
          data: msg.audio,
          spatial: msg.spatial || false
        }));
      }
      break;
      
    case 'Speak':
      // Text-to-speech command
      if (resoniteWs && resoniteWs.readyState === 1) {
        resoniteWs.send(JSON.stringify({
          type: 'Speak',
          text: msg.text
        }));
      }
      break;
      
    case 'DisplayVisual':
      // Display visual in Resonite
      if (resoniteWs && resoniteWs.readyState === 1) {
        resoniteWs.send(JSON.stringify({
          type: 'DisplayVisual',
          data: msg.data
        }));
      }
      break;
      
    case 'Interact':
      // Interact with object
      if (resoniteWs && resoniteWs.readyState === 1) {
        resoniteWs.send(JSON.stringify({
          type: 'Interact',
          objectId: msg.objectId,
          action: msg.action
        }));
      }
      break;
      
    case 'Pong':
      // Heartbeat response
      break;
  }
}

// Connect to Resonite headless
function connectToResonite() {
  console.log('🔗 Connecting to Resonite headless...');
  
  resoniteWs = new WebSocket(RESONITE_WS);

  resoniteWs.on('open', () => {
    console.log('✅ Connected to Resonite headless');
    
    // Send hello
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
      // Raw audio data - forward to bridge
      if (bridgeWs && bridgeWs.readyState === 1) {
        bridgeWs.send(data);
      }
    }
  });

  resoniteWs.on('close', () => {
    console.log('❌ Resonite disconnected');
    resoniteWs = null;
    setTimeout(connectToResonite, 5000);
  });

  resoniteWs.on('error', (err) => {
    console.error('Resonite error:', err.message);
  });
}

// Handle messages from Resonite
function handleResoniteMessage(msg) {
  console.log('[Resonite]', msg.type);
  
  if (!bridgeWs || bridgeWs.readyState !== 1) {
    console.log('   (No bridge connection, queuing...)');
    return;
  }
  
  switch (msg.type) {
    case 'Hello':
      console.log('   Resonite ready!');
      break;
      
    case 'Audio':
      // Forward audio to BenBot
      bridgeWs.send(JSON.stringify({
        type: 'Audio',
        data: msg.data
      }));
      break;
      
    case 'Text':
      // Forward text message to BenBot
      bridgeWs.send(JSON.stringify({
        type: 'Text',
        text: msg.text
      }));
      break;
      
    case 'Visual':
      // Forward visual data to BenBot
      bridgeWs.send(JSON.stringify({
        type: 'Visual',
        data: msg.data
      }));
      break;
      
    case 'Interactive':
      // Forward interaction data to BenBot
      bridgeWs.send(JSON.stringify({
        type: 'Interactive',
        data: msg.data
      }));
      break;
      
    case 'Heartbeat':
      resoniteWs.send(JSON.stringify({ type: 'Heartbeat' }));
      bridgeWs.send(JSON.stringify({ type: 'Heartbeat' }));
      break;
  }
}

// Keyboard input for testing
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (input) => {
  const text = input.trim();
  if (!text) return;
  
  // Send text to BenBot
  if (bridgeWs && bridgeWs.readyState === 1) {
    bridgeWs.send(JSON.stringify({
      type: 'Text',
      text: text
    }));
    console.log('📤 Sent:', text);
  } else {
    console.log('❌ Not connected to BenBot');
  }
});

// Start
console.log('🎮 Resonite Bridge Server starting...');
console.log(`   Pi Bridge: ${PI_BRIDGE_WS}`);
console.log(`   Resonite: ${RESONITE_WS}`);
console.log('');
console.log('Type messages and press Enter to send to BenBot...');
console.log('Ctrl+C to quit');
console.log('');

connectToBridge();
connectToResonite();

// Heartbeat
setInterval(() => {
  if (resoniteWs && resoniteWs.readyState === 1) {
    resoniteWs.send(JSON.stringify({ type: 'Heartbeat' }));
  }
}, 25000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  if (bridgeWs) bridgeWs.close();
  if (resoniteWs) resoniteWs.close();
  process.exit(0);
});