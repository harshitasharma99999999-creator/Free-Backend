# EIOR + OpenClaw Integration Guide

## How to Add EIOR Models to OpenClaw

This guide walks you through connecting OpenClaw to EIOR step-by-step. EIOR is now fully OpenAI-compatible — OpenClaw treats it as a standard OpenAI endpoint, so no code changes are needed.

## Prerequisites

- OpenClaw installed — any version that supports custom LLM providers
- EIOR API key from your platform

## Step 1: Get Your EIOR API Key

1. Navigate to your EIOR platform dashboard
2. Go to API Keys section (left sidebar > API Keys)
3. Click **Create New Key**, give it a name like `openclaw`
4. Copy the key immediately — it starts with `fk_`
5. New accounts receive free credits for testing

## Step 2: Choose Your EIOR Models

EIOR provides several models optimized for different use cases:

### Available Models

| Model ID | Context | Capabilities | Best For |
|----------|---------|--------------|----------|
| `eior-v1` | 128K | Text generation, reasoning | General chat, coding assistance |
| `eior-advanced` | 128K | Advanced reasoning, complex tasks | Complex problem solving, analysis |
| `eior-coder` | 128K | Code generation, refactors, debugging | Vibecoding, code review, automation |
| `eior-image-gen` | N/A | Image generation | Creating images from text prompts |

### Use a Specific Local LLM (Server-Side)

If your EIOR backend is running on Ollama and you want `eior-v1` / `eior-advanced` / `eior-coder` to map to different local models, set these environment variables on the **backend server**:

```bash
EIOR_OLLAMA_MODEL_V1=llama3.1
EIOR_OLLAMA_MODEL_ADVANCED=qwen2.5
EIOR_OLLAMA_MODEL_CODER=deepseek-coder-v2
```

OpenClaw still uses the EIOR model IDs (for example `eior-v1`) — the backend decides which Ollama model runs.

### Model Pricing

- **Text Models**: Pay per token usage
- **Image Models**: Pay per image generated
- **Rate Limits**: 100 requests per minute (free tier)

## Step 3: Configure OpenClaw

Choose one of these three methods to connect OpenClaw to EIOR:

### Method A: Environment Variables (Simplest)

Set these in your shell profile (`~/.bashrc`, `~/.zshrc`) or in `~/.openclaw/.env` so your OpenClaw config can reference them via `${...}`:

```bash
export EIOR_BASE_URL="https://your-eior-domain.com/eior/v1"
export EIOR_API_KEY="fk_your_eior_api_key_here"
```

**Windows PowerShell (same config):**

```powershell
$env:EIOR_BASE_URL="https://your-eior-domain.com/eior/v1"
$env:EIOR_API_KEY="fk_your_eior_api_key_here"
```

**Variable Reference:**

| Variable | Required | Description |
|----------|----------|-------------|
| `EIOR_BASE_URL` | Yes | Must be `https://your-domain.com/eior/v1` |
| `EIOR_API_KEY` | Yes | Your EIOR API key (starts with `fk_`) |

After setting variables, restart your terminal and OpenClaw.

### Method B: openclaw.json Config File (Most Flexible)

For multi-model setups and advanced configuration. Edit `~/.openclaw/openclaw.json`:

```json
{
  "models": {
    "providers": {
      "eior": {
        "baseUrl": "${EIOR_BASE_URL}",
        "apiKey": "${EIOR_API_KEY}",
        "api": "openai-completions",
        "models": [
          { "id": "eior-v1", "name": "EIOR v1" },
          { "id": "eior-advanced", "name": "EIOR Advanced" },
          { "id": "eior-coder", "name": "EIOR Coder" },
          { "id": "eior-image-gen", "name": "EIOR Image Gen" }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "eior/eior-v1"
      }
    }
  }
}
```

**Config Field Reference:**

| Field | Description |
|-------|-------------|
| `models.providers.eior` | Registers EIOR as provider named "eior" |
| `baseUrl` | EIOR endpoint: `https://your-domain.com/eior/v1` |
| `apiKey` | Your API key. Use `${EIOR_API_KEY}` for env var substitution |
| `api` | Must be `"openai-completions"` |
| `models` | Array of available EIOR models (IDs shown by `GET /eior/v1/models`) |
| `agents.defaults.model.primary` | Default model format: `eior/model-name` |

### Method C: CLI Commands (Quick Setup)

Use OpenClaw's built-in CLI to configure without editing files:

```bash
# Set EIOR as provider
openclaw config set models.providers.eior.baseUrl "https://your-eior-domain.com/eior/v1"
openclaw config set models.providers.eior.apiKey "${EIOR_API_KEY}"
openclaw config set models.providers.eior.api "openai-completions"

# Set default model
openclaw config set agents.defaults.model.primary "eior/eior-v1"

# Verify configuration
openclaw config get models.providers.eior
```

## Step 4: Verify the Integration

### 4.1 Test API Key Directly

Before testing in OpenClaw, verify your EIOR key works:

```bash
curl -X POST "https://your-eior-domain.com/eior/v1/chat/completions" \
  -H "Authorization: Bearer fk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "eior-v1",
    "messages": [{"role": "user", "content": "Hello, EIOR!"}]
  }'
```

You should get a JSON response with `choices[0].message.content`.

### 4.2 Test in OpenClaw

Start OpenClaw and give it a simple task:

```bash
openclaw chat "Hello, test EIOR integration"
```

If OpenClaw responds normally, the integration is working.

### 4.3 Test Image Generation

For image generation capabilities:

```bash
openclaw chat "Generate an image of a sunset over mountains"
```

OpenClaw should use the `eior-image-gen` model automatically for image requests.

### 4.4 Check Usage Dashboard

Monitor your usage and costs in real-time at your EIOR platform dashboard:
- Per-request token usage and cost
- Daily/monthly spending breakdown
- Model-by-model cost analysis

## Step 5: Optimize Your Setup

### Recommended Configurations by Use Case

#### Daily Automation (~$5/month)
```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "eior/eior-v1"
      }
    }
  }
}
```
Best for: file management, web browsing, shell scripts, everyday tasks.

#### Coding Assistant (~$12/month)
```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "eior/eior-advanced"
      }
    }
  }
}
```
Best for: code review, debugging, refactoring, complex reasoning.

#### Creative Work (~$20/month)
```json
{
  "models": {
    "providers": {
      "eior": {
        "models": ["eior-v1", "eior-advanced", "eior-image-gen"]
      }
    }
  }
}
```
Best for: content creation, image generation, creative writing.

### Switching Models On-the-Fly

With Method B (openclaw.json), you can list multiple models and switch between them during a session using OpenClaw's model selector — no restart needed.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Invalid API key | API key incorrect or expired | Verify key in dashboard, regenerate if needed |
| Insufficient credits | Account balance is low | Top up credits in billing section |
| Model not found | Wrong model ID format | Use exact model IDs: `eior-v1`, `eior-advanced`, `eior-image-gen` |
| OpenClaw still uses OpenAI | `OPENCLAW_BASE_URL` not set | Verify with `echo $OPENCLAW_BASE_URL` |
| Image generation fails | Model doesn't support images | Use `eior-image-gen` model for image requests |
| Slow responses | High server load | Try different model or check status page |

## API Quick Reference

- **Base URL**: `https://your-eior-domain.com/eior/v1`
- **Auth**: `Authorization: Bearer fk_your_api_key`
- **Endpoints**: 
  - `POST /chat/completions` - Text generation
  - `POST /images/generations` - Image generation
  - `GET /models` - List available models
- **Model IDs**: `eior-v1`, `eior-advanced`, `eior-coder`, `eior-image-gen`
- **Features**: Streaming, tool/function calling (model-dependent), image generation

## Advanced Features

### Function Calling Support

EIOR supports OpenAI-compatible tool/function calling for tool use (works best with a tool-capable local model):

```json
{
  "model": "eior-advanced",
  "messages": [...],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get current weather",
        "parameters": {
          "type": "object",
          "properties": {
            "location": { "type": "string" }
          }
        }
      }
    }
  ],
  "tool_choice": "auto"
}
```

### Streaming Responses

Enable streaming for real-time responses:

```json
{
  "model": "eior-v1",
  "messages": [...],
  "stream": true
}
```

### Custom Parameters

Fine-tune model behavior:

```json
{
  "model": "eior-v1",
  "messages": [...],
  "temperature": 0.7,
  "max_tokens": 2000,
  "top_p": 0.9
}
```

## Getting Help

- **Documentation**: Check your EIOR platform docs
- **Support**: Contact EIOR support team
- **Community**: Join OpenClaw Discord for integration help
- **Status**: Check EIOR status page for service updates

---

**Ready to get started?** Follow the configuration steps above and start using EIOR with OpenClaw in minutes!
