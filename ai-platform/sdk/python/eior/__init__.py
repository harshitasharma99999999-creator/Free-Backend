"""
Eior Python SDK
---------------
Official Python client for the Eior AI API.
A drop-in replacement for the OpenAI SDK — no base_url needed.

Install:
    pip install eior

Usage:
    from eior import Eior

    client = Eior(api_key="sk-your-key")

    response = client.chat.completions.create(
        model="eior-chat",
        messages=[{"role": "user", "content": "Hello!"}],
    )
    print(response.choices[0].message.content)
"""

from openai import OpenAI, AsyncOpenAI, Stream
from openai.types.chat import ChatCompletion, ChatCompletionChunk
from typing import Any

__version__ = "1.0.0"
__all__ = ["Eior", "AsyncEior"]

EIOR_BASE_URL = "https://api-production-2b12.up.railway.app/v1"


class Eior(OpenAI):
    """
    Synchronous Eior client.

    Args:
        api_key: Your Eior API key (sk-...) from https://free-backed.web.app
        base_url: Override the API base URL (optional)
        **kwargs: Any other OpenAI client kwargs (timeout, max_retries, etc.)

    Example:
        client = Eior(api_key="sk-...")
        response = client.chat.completions.create(
            model="eior-chat",
            messages=[{"role": "user", "content": "Hello!"}],
        )
    """

    def __init__(self, api_key: str, base_url: str = EIOR_BASE_URL, **kwargs: Any):
        super().__init__(api_key=api_key, base_url=base_url, **kwargs)


class AsyncEior(AsyncOpenAI):
    """
    Asynchronous Eior client.

    Example:
        import asyncio
        from eior import AsyncEior

        async def main():
            client = AsyncEior(api_key="sk-...")
            response = await client.chat.completions.create(
                model="eior-chat",
                messages=[{"role": "user", "content": "Hello!"}],
            )
            print(response.choices[0].message.content)

        asyncio.run(main())
    """

    def __init__(self, api_key: str, base_url: str = EIOR_BASE_URL, **kwargs: Any):
        super().__init__(api_key=api_key, base_url=base_url, **kwargs)
