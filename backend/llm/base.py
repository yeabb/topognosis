from abc import ABC, abstractmethod
from typing import Generator


class LLMAdapter(ABC):
    """
    Abstract base class for all LLM provider adapters.
    Each adapter must implement stream() which yields text chunks.
    """

    @abstractmethod
    def stream(self, messages: list[dict], max_tokens: int = 4096) -> Generator[str, None, None]:
        """
        Stream a response from the LLM.

        Args:
            messages: List of {'role': 'user'|'assistant', 'content': str}
            max_tokens: Maximum tokens in the response

        Yields:
            str: Text chunks as they arrive from the model
        """
        pass
