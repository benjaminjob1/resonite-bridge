#!/usr/bin/env node
/**
 * Resonite Bridge Server - Resonite Side (runs on user's machine)
 * This connects to the Pi bridge for AI capabilities
 * 
 * Usage: PI_HOST=<tailscale-ip> node server.js
 */

const WebSocket = require('ws');

const PI_HOST = process.env.PI_HOST || 'localhost';
const PI_PORT = process.env.PI_PORT || 8765;
const PI_BRIDGE_WS = `ws://${PI_HOST}:${PI_PORT}`;

// Resonite headless typically runs on port 9090
const RESONITE_WS = 'ws://localhost:9090';

let bridgeWs = null;
let resoniteWs = null;

// Connect to Pi bridge
function connectToBridge() {
  console.log('🔗 Connecting to Pi Bridge...');
  
  bridgeWs = new WebSocket(PI_BRIDGE_WS);

  bridgeWs.on('open', () => {
    console.log('✅ Connected to Pi Bridge');
    bridgeWs.send(JSON.stringify({ type: 'Hello', version: '1.0' }));
  });

  bridgeWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      // Forward AI responses to Resonite
      if (msg.type === 'Speak') {
        sendToResonite({ type: 'Speak', text: msg.text });
      } else if (msg.type === 'PlayAudio') {
        sendToResonite({ type: 'PlayAudio', audio: msg.audio });
      } else if (msg.type === 'DisplayVisual') {
        sendToResonite({ type: 'DisplayVisual', data: msg.data });
      }
    } catch (e) {
      console.error('Bridge parse error:', e);
    }
  });

  bridgeWs.on('close', () => {
    console.log('❌ Pi Bridge disconnected');
    setTimeout(connectToBridge, 5000);
  });
}

// Connect to Resonite headless
function connectToResonite() {
  console.log('🔗 Connecting to Resonite headless...');
  
  resoniteWs = new WebSocket(RESONITE_WS);

  resoniteWs.on('open', () => {
    console.log('✅ Connected to Resonite headless');
  });

  resoniteWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      // Forward audio/video/data to bridge
      if (bridgeWs && bridgeWs.readyState === 1) {
        bridgeWs.send(JSON.stringify(msg));
      }
    } catch (e) {
      // Raw binary data - might be audio/video
      if (bridgeWs && bridgeWs.readyState === 1) {
        bridgeWs.send(data);
      }
    }
  });

  resoniteWs.on('close', () => {
    console.log('❌ Resonite disconnected');
    setTimeout(connectToResonite, 5000);
  });
}

// Send to Resonite
function sendToResonite(data) {
  if (resoniteWs && resoniteWs.readyState === 1) {
    resoniteWs.send(JSON.stringify(data));
  }
}

// Start
console.log('🎮 Resonite Bridge Server starting...');
console.log(`   Pi Bridge: ${PI_BRIDGE_WS}`);
console.log(`   Resonite: ${RESONITE_WS}`);

connectToBridge();
connectToResonite();

// Heartbeat
setInterval(() => {
  if (bridgeWs && bridgeWs.readyState === 1) {
    bridgeWs.send(JSON.stringify({ type: 'Heartbeat' }));
  }
}, 30000);