# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OSUMOTO is a LINE bot for group chats that integrates ChatGPT and Stable Diffusion image generation. The bot responds when messages start with a configured bot name (`CHANNEL_BOT_NAME`).

## Commands

### Local Development

```bash
yarn dev                # Start development server with hot reload (uses nodemon)
```

### Building

```bash
yarn build             # Clean dist folder and compile TypeScript
yarn ts-check          # Type check without building (runs on pre-commit hook)
```

### Deployment

```bash
yarn deploy:prod       # Build and deploy to Vercel production
```

## Architecture

### Entry Point and Request Flow

- **[src/index.ts](src/index.ts)** - Express server setup with three endpoints:
  - `GET /` - Test endpoint for ChatGPT functionality
  - `GET /image` - Test endpoint for image generation
  - `POST /webhook` - LINE webhook handler (main entry point for production)

### Core Modules

**[src/line.ts](src/line.ts)** - LINE Bot integration layer

- Handles webhook events from LINE
- Filters for group chat messages starting with `CHANNEL_BOT_NAME`
- Routes requests to either ChatGPT (default) or Stable Diffusion (when message starts with `{CHANNEL_BOT_NAME}画伯`)
- Manages group member profile caching in `groupMemberMap`
- Returns TextMessage or ImageMessage responses

**[src/gpt.ts](src/gpt.ts)** - OpenAI ChatGPT integration

- Uses `openai@6.8.1` with modern Responses API (`responses.create()`)
- Model configurable via `OPENAI_MODEL` env variable (default: `gpt-5-nano`)
- Maintains conversation context in `pastMessages` array (configurable via `MESSAGE_HISTORY_LIMIT`, default: 10 messages)
- System settings configured via `SYSTEM_SETTINGS` env variable
- `ask()` function sends messages and maintains context

**[src/stable-diffusion.ts](src/stable-diffusion.ts)** - Stability AI integration

- Generates images via Stability AI API (engine: `stable-diffusion-v1-5`)
- Uses negative prompts to improve quality
- Generated images are base64-encoded and uploaded to Google Drive
- `checkGenerateArt()` is a test function that uploads sample.png

**[src/google.ts](src/google.ts)** - Google Drive integration

- Uploads generated images to Google Drive
- Requires `credentials.json` with service account credentials (use `credentials.json.example` as template)
- Images uploaded to folder ID: `1lLo7CG0ZdhTooWsAsC2NEs34QEUb8UgZ`
- Returns shareable Google Drive URLs in format: `https://drive.google.com/uc?id={fileId}`

### Key Technical Details

**Environment Variables** (configure in `.env`):

- `CHANNEL_ACCESS_TOKEN` - LINE Bot channel access token
- `CHANNEL_SECRET` - LINE Bot channel secret
- `CHANNEL_BOT_NAME` - Prefix for bot activation in group chat
- `OPENAI_API_KEY` - OpenAI API key
- `OPENAI_MODEL` - OpenAI model name (e.g., `gpt-5-nano`, `gpt-4o-mini`)
- `MESSAGE_HISTORY_LIMIT` - Maximum number of conversation messages to retain (default: 10)
- `STABILITY_API_KEY` - Stability AI API key
- `PORT` - Server port (default: 3000)
- `SYSTEM_SETTINGS` - ChatGPT system prompt for personality/behavior

**Message Flow**:

1. LINE sends webhook event to `/webhook`
2. [src/line.ts](src/line.ts) validates it's a group text message starting with bot name
3. Routes to `useChatGpt()` or `useStableDiffusion()` based on trigger phrase
4. For ChatGPT: extracts sender name, formats message as `{name}:{text}`, sends to OpenAI
5. For Stable Diffusion: generates image, uploads to Google Drive, returns image URL
6. Response sent back via LINE API

**Conversation Context**:

- ChatGPT maintains conversation history in `pastMessages` array (configurable via `MESSAGE_HISTORY_LIMIT`, default: 10)
- Context is shared globally across all groups/users (potential improvement area)
- Sender names are cached per group in `groupMemberMap`

**Deployment**:

- Hosted on Vercel (serverless)
- TypeScript compiled to `dist/` directory
- Pre-commit hook runs `ts-check` to validate types

## Package Manager

This project uses Yarn 1.22.22 (specified in `packageManager` field).
