# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

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

See [the layer design and feature placement guide](docs/architecture/README.md) for dependency rules, injection, tests, and the current implementation scope.

Place HTTP/webhook entrypoints in `src/entrypoints`, LINE input/output conversion in `src/adapters/line`, orchestration in `src/usecases`, SDK-independent rules in `src/services`, external communication in `src/clients`, and configuration loading and validation in `src/config`. Assemble dependencies at startup and inject them through function arguments.

The image-generation and chat-reply flows follow this separation. Chat replies and received images share one history queue, with sender-name lookup deferred inside it. History rules live in services. HTTP handling and existing transports still include code outside these directories; the final root layout keeps only startup and dependency composition. Add layers only when they have a concrete responsibility.

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

LINE webhook requests are validated and deduplicated before group messages with the configured bot prefix are routed to chat or image generation. Image generation prepares the prompt, generates an image, saves it to Drive, and converts the result or failure to a LINE reply.

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
