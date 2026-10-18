# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OSUMOTO is a LINE bot for group chats that integrates ChatGPT and OpenAI image generation. The bot responds when messages start with a configured bot name (`CHANNEL_BOT_NAME`).

## Commands

### Local Development

```bash
yarn dev                # Start development server with hot reload (uses nodemon)
```

### Building

```bash
yarn build             # Clean dist folder and compile TypeScript
yarn ts-check          # Type check without emitting files (runs on pre-commit hook)
yarn verify            # Lint, formatting check, tests, type check, build
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
- Routes requests to either ChatGPT (default) or OpenAI image generation (when message starts with `{CHANNEL_BOT_NAME}画伯`)
- Manages group member profile caching in `groupMemberMap`
- Returns TextMessage or ImageMessage responses

**[src/gpt.ts](src/gpt.ts)** - OpenAI ChatGPT integration

- Uses `openai@6.8.1` with modern Responses API (`responses.create()`)
- Requests Fast mode via `service_tier: "priority"` (2x standard pricing)
- Model configured via the required `OPENAI_MODEL` env variable (`gpt-6-luna` in `.env.example`)
- Uses `src/conversation.ts` for per-group history and serial processing (default: 10 messages)
- System settings configured via `SYSTEM_SETTINGS` env variable
- `ask(groupId, content)` sends messages and maintains context; content may be a deferred sender-name lookup to preserve queue order
- `rememberImage(groupId, imageId)` loads and records a received LINE image in process memory without replying
- `src/line-image.ts` retrieves images once at reception (10s / 8MiB each), and `src/image-input.ts` builds multimodal input from memory; total retained data URLs are capped at 64MiB

**[src/image.ts](src/image.ts)** - OpenAI image generation integration

- Uses `images.generate()` with `OPENAI_IMAGE_MODEL` (default: `gpt-image-2.5-flare`)
- Generates one 1024x1024 PNG at `low` quality using the existing `OPENAI_API_KEY`
- Prepares the image prompt using `OPENAI_MODEL`, optional `web_search`, and the shared search policy in `src/web-search.ts`
- Prompt preparation and image generation share a 40-second budget with no retries; Drive upload requests time out after 10 seconds with no retries (OAuth authentication time is not included)
- Empty prompts and generation/upload failures return a text reply to LINE
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
- `OPENAI_MODEL` - OpenAI model name (configured as `gpt-6-luna` in `.env.example`)
- `MESSAGE_HISTORY_LIMIT` - Maximum number of conversation messages to retain (default: 10)
- `OPENAI_IMAGE_MODEL` - Image model (default: `gpt-image-2.5-flare`)
- `PORT` - Server port (default: 3000)
- `SYSTEM_SETTINGS` - ChatGPT system prompt for personality/behavior

**Message Flow**:

1. LINE sends webhook event to `/webhook`
2. [src/line.ts](src/line.ts) validates it's a group text message starting with bot name
3. Routes to `useChatGpt()` or `useImageGeneration()` based on trigger phrase
4. For ChatGPT: extracts sender name, formats message as `{name}:{text}`, sends to OpenAI
5. For image generation: generates image, uploads to Google Drive, returns image URL
6. Response sent back via LINE API

**Conversation Context**:

- Conversation history is isolated per group; text turns and received images respect `MESSAGE_HISTORY_LIMIT` (default and maximum: 10); image inputs use only the latest image inside that window
- History is process-local, expires after 30 idle minutes, and is capped at 1,000 groups
- Webhook event IDs share one result per process until one hour after completion, including failures; up to 10,000 IDs are retained
- Restarts and separate Vercel instances do not share history or deduplication state
- Sender names are cached per group in `groupMemberMap`

**Deployment**:

- Hosted on Vercel (serverless)
- TypeScript compiled to `dist/` directory
- Pre-commit hook runs lint, format check, and type check
- GitHub Actions runs `yarn verify` on pull requests and main pushes

## Package Manager

This project uses Yarn 1.22.22 (specified in `packageManager` field).
