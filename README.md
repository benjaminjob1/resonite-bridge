# Resonite Bridge

**Connect BenBot (OpenClaw on Pi) to Resonite for voice, text, and visual interaction**

## Architecture

Resonite headless acts as a WebSocket server. bridge.js (Pi) connects to it and relays to OpenClaw.

```
┌─────────────────────────────────────────┐
│  RESONITE HEADLESS (port 9090)          │
│  ← acts as WebSocket SERVER             │
└────────────────────┬────────────────────┘
                     │ audio + text + world state
                     ▼
         ┌──────────────────────────┐
         │   bridge.js (on Pi)       │
         │   ← Connects as CLIENT   │
         │   ← Connects to OpenClaw │
         └────────────┬─────────────┘
                      │ relay
                      ▼
         ┌──────────────────────────┐
         │   OpenClaw Gateway        │
         │   (BenBot AI)            │
         └──────────────────────────┘
```

**No server.js needed** — bridge.js on Pi connects directly to Resonite headless.

## Setup

### 1. Start Resonite Headless
Resonite headless must be running with WebSocket enabled (port 9090 by default).

### 2. Run Bridge on Pi
```bash
cd ~/resonite-bridge
npm install
RESONITE_HOST=<resonite-headless-ip> OPENCLAW_TOKEN=<token> node bridge.js
```

## Protocol (ResoniteLink Compatible)

bridge.js implements the ResoniteLink protocol:
- Connects to Resonite WebSocket at `ws://<RESONITE_HOST>:9090`
- Authenticates with ResoniteLink session
- Creates objects in Resonite world (avatar, speakers, text displays)
- Receives voice audio and relays to OpenClaw
- Receives AI responses and plays in Resonite

## Release

GitHub Actions automatically builds releases on tags:
```bash
git tag v1.0.0 && git push origin v1.0.0
```

Creates: `.zip`, `.tar.gz`, checksums