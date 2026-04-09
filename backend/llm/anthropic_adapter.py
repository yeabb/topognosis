import logging
import time
from typing import Generator

import anthropic

from .base import LLMAdapter

logger = logging.getLogger(__name__)


class AnthropicAdapter(LLMAdapter):
    """
    Adapter for Anthropic's Claude models.
    Handles streaming, retries on overload, and specific error types.
    """

    MAX_RETRIES = 2

    def __init__(self, api_key: str, model: str):
        self.model = model
        self._client = anthropic.Anthropic(api_key=api_key)

    def stream(self, messages: list[dict], max_tokens: int = 4096) -> Generator[str, None, None]:
        for attempt in range(self.MAX_RETRIES + 1):
            try:
                with self._client.messages.stream(
                    model=self.model,
                    max_tokens=max_tokens,
                    messages=messages,
                ) as anthropic_stream:
                    for text in anthropic_stream.text_stream:
                        yield text
                return

            except anthropic.APIStatusError as e:
                if e.status_code == 529 and attempt < self.MAX_RETRIES:
                    wait = 2 ** attempt
                    logger.warning(f'Anthropic overloaded, retrying in {wait}s (attempt {attempt + 1}/{self.MAX_RETRIES})')
                    time.sleep(wait)
                    continue
                logger.error(f'Anthropic API error {e.status_code}: {e.message}')
                raise

            except anthropic.APIConnectionError as e:
                logger.error(f'Anthropic connection error: {e}')
                raise
