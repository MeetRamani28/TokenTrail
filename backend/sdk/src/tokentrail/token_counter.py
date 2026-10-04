import logging
from typing import Any

logger = logging.getLogger("tokentrail.token_counter")

try:
    import tiktoken

    _TIKTOKEN_AVAILABLE = True
except ImportError:
    _TIKTOKEN_AVAILABLE = False


def estimate_tokens(text: str | None, model: str | None = None) -> int:
    """Estimates token count for a string using tiktoken or character ratio fallback."""
    if not text:
        return 0

    if _TIKTOKEN_AVAILABLE:
        try:
            try:
                encoding = tiktoken.encoding_for_model(model or "gpt-4")
            except KeyError:
                encoding = tiktoken.get_encoding("cl100k_base")
            return len(encoding.encode(text))
        except Exception as e:
            logger.debug("tiktoken encoding failed: %s", e)

    # Fast heuristic fallback: ~4 characters per token
    return max(1, len(text) // 4)


def estimate_messages_tokens(
    messages: list[dict[str, Any]] | None, model: str | None = None
) -> int:
    """Estimates token count for chat messages structure."""
    if not messages:
        return 0

    total = 3  # every reply is primed with <|start|>assistant<|message|>
    for msg in messages:
        total += 4  # message formatting overhead
        content = msg.get("content")
        if isinstance(content, str):
            total += estimate_tokens(content, model=model)
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    total += estimate_tokens(part.get("text", ""), model=model)
    return total
