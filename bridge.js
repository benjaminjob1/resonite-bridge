#!/usr/bin/env node
/**
 * Resonite Bridge - Pi Side
 * Connects Resonite headless client to OpenClaw/BenBot for AI interaction
 * 
 * Usage: PI_HOST=<tailscale-ip> node bridge.js
 */

const WebSocket = require('ws');
const http = require('http');

const PI_HOST = process.env.PI_HOST || 'localhost';
const PI_PORT = process.env.PI_PORT || 8765;
const OPENCLAW_WS = `ws://${PI_HOST}:18789`;
const RESONITE_WS = `ws://localhost:9090`;

// Connection state
let resoniteWs = null;
let openclawWs = null;

// Resonite message types
const RESONITE_PROTOCOLS = {
  HELLO: 'Hello',
  GOODBYE: 'Goodbye',
  HEARTBEAT: 'Heartbeat',
  COMMAND: 'Command',
  DATA: 'Data',
  AUDIO: 'Audio',
  VIDEO: 'Video'
};

// Connect to Resonite headless
function connectToResonite() {
  console.log('🔗 Connecting to Resonite headless...');
  
  resoniteWs = new WebSocket(RESONITE_WS, {
    headers: {
      'Protocol-Version': '1.0',
      'App-Name': 'BenBot-Bridge'
    }
  });

  resoniteWs.on('open', () => {
    console.log('✅ Connected to Resonite headless');
    sendHello();
  });

  resoniteWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleResoniteMessage(msg);
    } catch (e) {
      console.log('Raw Resonite data:', data.toString('hex', 0, 100));
    }
  });

  resoniteWs.on('close', () => {
    console.log('❌ Resonite disconnected');
    setTimeout(connectToResonite, 5000);
  });

  resoniteWs.on('error', (err) => {
    console.error('Resonite error:', err.message);
  });
}

// Send hello to Resonite
function sendHello() {
  if (resoniteWs && resoniteWs.readyState === 1) {
    resoniteWs.send(JSON.stringify({
      type: RESONITE_PROTOCOLS.HELLO,
      version: '1.0',
      capabilities: ['voice', 'visual', 'text', 'commands']
    }));
  }
}

// Handle messages from Resonite
function handleResoniteMessage(msg) {
  console.log('[Resonite]', msg.type, msg.data ? '(data)' : '');
  
  switch (msg.type) {
    case RESONITE_PROTOCOLS.AUDIO:
      // Forward audio to OpenClaw for processing
      if (openclawWs && openclawWs.readyState === 1) {
        openclawWs.send(JSON.stringify({
          type: 'resonite_audio',
          audio: msg.audio,
          timestamp: Date.now()
        }));
      }
      break;
      
    case RESONITE_PROTOCOLS.VIDEO:
      // Forward video/visual data to OpenClaw
      if (openclawWs && openclawWs.readyState === 1) {
        openclawWs.send(JSON.stringify({
          type: 'resonite_video',
          frame: msg.frame,
          timestamp: Date.now()
        }));
      }
      break;
      
    case RESONITE_PROTOCOLS.DATA:
      // Forward world/object state to OpenClaw
      if (openclawWs && openclawWs.readyState === 1) {
        openclawWs.send(JSON.stringify({
          type: 'resonite_data',
          data: msg.data,
          timestamp: Date.now()
        }));
      }
      break;
      
    case RESONITE_PROTOCOLS.COMMAND:
      // Execute command in Resonite
      executeResoniteCommand(msg.command, msg.args);
      break;
      
    case RESONITE_PROTOCOLS.HEARTBEAT:
      resoniteWs.send(JSON.stringify({ type: RESONITE_PROTOCOLS.HEARTBEAT }));
      break;
  }
}

// Execute command in Resonite world
function executeResoniteCommand(cmd, args) {
  console.log(`Executing Resonite command: ${cmd}`, args);
  
  const commands = {
    speak: (text) => {
      // Use OpenClaw TTS to generate speech
      if (openclawWs && openclawWs.readyState === 1) {
        openclawWs.send(JSON.stringify({
          type: 'tts_request',
          text: text,
          callback: 'resonite_speak'
        }));
      }
    },
    show: (visual) => {
      // Display visual in Resonite
      sendToResonite({
        type: 'DisplayVisual',
        data: visual
      });
    },
    interact: (obj) => {
      // Interact with object
      sendToResonite({
        type: 'ObjectInteraction',
        objectId: obj.id,
        action: obj.action
      });
    }
  };
  
  if (commands[cmd]) {
    commands[cmd](args);
  }
}

// Send to Resonite
function sendToResonite(data) {
  if (resoniteWs && resoniteWs.readyState === 1) {
    resoniteWs.send(JSON.stringify(data));
  }
}

// Connect to OpenClaw gateway
function connectToOpenClaw() {
  console.log('🔗 Connecting to OpenClaw...');
  
  openclawWs = new WebSocket(OPENCLAW_WS, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENCLAW_TOKEN || ''}`
    }
  });

  openclawWs.on('open', () => {
    console.log('✅ Connected to OpenClaw');
    openclawWs.send(JSON.stringify({
      type: 'session_attach',
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
    setTimeout(connectToOpenClaw, 5000);
  });

  openclawWs.on('error', (err) => {
    console.error('OpenClaw error:', err.message);
  });
}

// Handle messages from OpenClaw
function handleOpenClawMessage(msg) {
  console.log('[OpenClaw]', msg.type);
  
  if (msg.type === 'ai_response') {
    // AI responded - send to Resonite as speech
    sendToResonite({
      type: 'Speak',
      text: msg.text
    });
  } else if (msg.type === 'visual_response') {
    // Visual response - display in Resonite
    sendToResonite({
      type: 'DisplayVisual',
      visual: msg.visual
    });
  } else if (msg.type === 'resonite_speak') {
    // TTS response - forward as audio
    sendToResonite({
      type: 'PlayAudio',
      audio: msg.audio
    });
  }
}

// Heartbeat
setInterval(() => {
  if (resoniteWs && resoniteWs.readyState === 1) {
    resoniteWs.send(JSON.stringify({ type: RESONITE_PROTOCOLS.HEARTBEAT }));
  }
}, 30000);

// Start
console.log('🎙️ Resonite Bridge starting...');
console.log(`   Resonite WS: ${RESONITE_WS}`);
console.log(`   OpenClaw WS: ${OPENCLAW_WS}`);

connectToResonite();
connectToOpenClaw();