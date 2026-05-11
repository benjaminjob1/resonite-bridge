# Resonite Bridge

Connect BenBot/OpenClaw AI to Resonite for voice, visual, and interactive capabilities.

## Overview

This bridge allows BenBot (running on Raspberry Pi via OpenClaw) to:
- 🗣️ **Speak** into Resonite worlds
- 👁️ **See** visual data from Resonite
- 🎮 **Interact** with Resonite objects and world state
- 💬 **Chat** with users in Resonite via voice/text

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         RESONITE                                 │
│  ┌──────────────┐                    ┌──────────────────────┐   │
│  │ Headless     │◄────────Audio/─────│ Resonite Bridge      │   │
│  │ Client       │◄────────Visual────│ (server.js - local) │   │
│  │              │◄────────Commands──└──────────┬───────────┘   │
│  └──────────────┘                               │               │
└─────────────────────────────────────────────────│───────────────┘
                                                  │ WebSocket
                                                  │ (Port 8765)
                                              ┌───▼─────────┐
                                              │   Pi         │
                                              │ bridge.js    │
                                              └─────┬───────┘
                                                    │ WebSocket
                                              ┌───▼──────────┐
                                              │  OpenClaw   │
                                              │  (BenBot)   │
                                              └─────────────┘
```

## Components

### Pi Side (`bridge.js`)
- Runs on Raspberry Pi
- Connects to OpenClaw gateway
- Handles AI responses (TTS, visual, text)
- Forwards audio/video/data to local server

### Local Side (`server.js`)
- Runs on user's machine (Windows/macOS/Linux)
- Connects to Resonite headless client
- Connects to Pi bridge
- Handles audio streaming and visual display

## Setup

### 1. Install on Pi
```bash
cd ~/resonite-bridge
npm install
PI_HOST=<your-pi-tailscale-ip> node bridge.js
```

### 2. Install on Local Machine
```bash
npm install
PI_HOST=<pi-tailscale-ip> node server.js
```

### 3. Configure Resonite Headless
Start Resonite headless client with WebSocket enabled (default port 9090).

## Requirements

- Node.js 18+
- Resonite headless client
- Tailscale network (for Pi connection)
- OpenClaw/BenBot running on Pi

## Protocol

Messages between bridge and Resonite use JSON with types:
- `Hello` / `Goodbye` - Connection handshake
- `Heartbeat` - Keep alive (every 30s)
- `Audio` - Audio data (base64)
- `Video` - Video frame data
- `Data` - World/object state
- `Command` - Execute action
- `Speak` - TTS playback
- `DisplayVisual` - Show visual content

## License

MIT