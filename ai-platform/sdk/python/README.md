# Eior Python SDK

Official Python client for the **Eior AI API** — free, OpenAI-compatible.

## Install

```bash
pip install eior
```

## Quick Start

```python
from eior import Eior

client = Eior(api_key="sk-your-key")

# Chat
response = client.chat.completions.create(
    model="eior-chat",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)

# Streaming
stream = client.chat.completions.create(
    model="eior-chat",
    messages=[{"role": "user", "content": "Count to 5"}],
    stream=True,
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="", flush=True)
```

## Async

```python
from eior import AsyncEior
import asyncio

async def main():
    client = AsyncEior(api_key="sk-your-key")
    response = await client.chat.completions.create(
        model="eior-chat",
        messages=[{"role": "user", "content": "Hello!"}],
    )
    print(response.choices[0].message.content)

asyncio.run(main())
```

## Models

| Model | Best for |
|---|---|
| `eior-chat` | General chat |
| `eior-fast` | Quick responses |
| `eior-vision` | Image understanding |
| `eior-code` | Code generation |

Get your API key at **https://free-backed.web.app**
