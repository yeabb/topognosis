import logging
import os

import anthropic

from .anthropic_adapter import AnthropicAdapter
from .base import LLMAdapter

logger = logging.getLogger(__name__)

# Maps model name prefixes to their provider
ANTHROPIC_MODELS = ('claude-',)
# OPENAI_MODELS = ('gpt-', 'o1-', 'o3-')  # future
# GEMINI_MODELS = ('gemini-',)              # future


def get_adapter(model: str) -> LLMAdapter:
    """
    Returns the correct LLM adapter for the given model name.
    """
    if any(model.startswith(prefix) for prefix in ANTHROPIC_MODELS):
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError('ANTHROPIC_API_KEY is not set in environment')
        return AnthropicAdapter(api_key=api_key, model=model)

    # Future providers go here:
    # if any(model.startswith(prefix) for prefix in OPENAI_MODELS):
    #     return OpenAIAdapter(api_key=os.getenv('OPENAI_API_KEY'), model=model)

    raise ValueError(f'No adapter found for model: {model}')


def get_error_message(e: Exception) -> str:
    """
    Maps provider-specific exceptions to user-friendly messages.
    """
    if isinstance(e, anthropic.APIStatusError):
        if e.status_code == 529:
            return 'Claude is currently overloaded. Please try again in a moment.'
        if e.status_code == 401:
            return 'Invalid API key. Please check your configuration.'
        if e.status_code == 400:
            return 'The request was invalid. The conversation may be too long.'
        return f'The AI service returned an error (status {e.status_code}). Please try again.'

    if isinstance(e, anthropic.APIConnectionError):
        return 'Connection to the AI service failed. Please check your internet and try again.'

    return 'An unexpected error occurred. Please try again.'
