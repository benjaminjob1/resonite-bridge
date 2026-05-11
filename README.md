# Resonite Bridge

**Two-way voice + text AI connection between Resonite and BenBot/OpenClaw on Pi**

## Overview

This bridge allows BenBot (running on Raspberry Pi via OpenClaw) to:
- 🗣️ **Speak** into Resonite (AI voice responses play in-world)
- 👂 **Hear** you through Resonite (your voice goes to BenBot)
- 💬 **Chat** with you in Resonite (text also works)
- 👁️ **See** visual data from Resonite (screenshots, world state)
- 🎮 **Interact** with Resonite objects and world state

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         RESONITE                                 │
│  ┌──────────────┐                    ┌────────────────────────┐   │
│  │ Headless     │◄───────────────────│ Resonite Bridge        │   │
│  │ Client       │◄─ Audio/Text ──────│ (server.js - local)   │   │
│  │ (port 9090)  │───────────────────▶│                        │   │
│  └──────────────┘                    └───────────┬────────────┘   │
└─────────────────────────────────────────────────│────────────────┘
                                                  │ WebSocket
                                                  │ (Port 8765)
                                              ┌───▼────────────┐
                                              │     Pi          │
                                              │  bridge.js     │
                                              │  (OpenClaw)    │
                                              └───────┬────────┘
                                                      │ WebSocket
                                              ┌───────▼──────────┐
                                              │   OpenClaw       │
                                              │   Gateway        │
                                              │   (BenBot AI)   │
                                              └─────────────────┘
```

## Two-Way Flow

1. **You speak in Resonite** → Audio sent to BenBot → BenBot processes and responds → Response plays in Resonite
2. **You type in Resonite** → Text sent to BenBot → BenBot responds → Response plays in Resonite
3. **BenBot initiates** → Speaks/acts in Resonite world in real-time

## Setup

### 1. On Pi (already running OpenClaw)
```bash
cd ~/resonite-bridge
npm install
PI_HOST=<your-pi-tailscale-ip> node bridge.js
```

### 2. On Local Machine (Windows/macOS/Linux)
```bash
cd ~/resonite-bridge
npm install
PI_HOST=<pi-tailscale-ip> node server.js
```

### 3. In Resonite
Start headless client with WebSocket enabled (default port 9090).

## How It Works

### Connection Flow
1. **server.js** (local) connects to Resonite headless on port 9090
2. **server.js** (local) connects to **bridge.js** (Pi) on port 8765
3. **bridge.js** (Pi) connects to OpenClaw gateway on port 18789

### Audio Pipeline
- Microphone in Resonite → server.js → bridge.js → OpenClaw Realtime API
- OpenClaw response → bridge.js → server.js → Resonite (play audio)

### Text Pipeline  
- Type in Resonite → server.js → bridge.js → OpenClaw
- OpenClaw response → bridge.js → server.js → Resonite (speak)

## Features

### Voice
- Real-time speech-to-speech with BenBot
- Spatial audio support in Resonite
- Works with any Resonite world

### Text
- Type messages directly to BenBot
- Useful for quick questions

### Visual
- Share screen/visual data with BenBot
- BenBot can display info in Resonite

### Interactive
- World state shared with BenBot
- BenBot can trigger actions in Resonite

## Requirements

- Node.js 18+
- Resonite headless client
- Tailscale network (for Pi connection)
- OpenClaw/BenBot running on Pi

## Protocol

Messages between bridge and Resonite use JSON with types:
- `Hello` / `Goodbye` - Connection handshake
- `Heartbeat` - Keep alive (every 25s)
- `Audio` - Audio data (base64 PCM)
- `Text` - Text messages
- `Visual` - Visual/screenshot data
- `Interactive` - World/object state
- `PlayAudio` - Play audio in Resonite
- `Speak` - TTS playback
- `DisplayVisual` - Show visual content

## License

MIT