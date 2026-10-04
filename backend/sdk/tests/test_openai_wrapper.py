import asyncio
import time
from types import SimpleNamespace
from typing import Any

import pytest
from tokentrail import TokenTrail


def create_mock_completion(
    content: str = "Hello world!", prompt_tokens: int = 15, completion_tokens: int = 5
) -> Any:
    return SimpleNamespace(
        id="chatcmpl_mock_123",
        choices=[
            SimpleNamespace(
                index=0,
                message=SimpleNamespace(role="assistant", content=content),
                finish_reason="stop",
            )
        ],
        usage=SimpleNamespace(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
        ),
    )


class MockCompletions:
    def __init__(self, response: Any = None, side_effect: Exception | None = None) -> None:
        self.response = response or create_mock_completion()
        self.side_effect = side_effect

    def create(self, *args: Any, **kwargs: Any) -> Any:
        if self.side_effect:
            raise self.side_effect
        return self.response


class MockAsyncCompletions:
    def __init__(self, response: Any = None, side_effect: Exception | None = None) -> None:
        self.response = response or create_mock_completion()
        self.side_effect = side_effect

    async def create(self, *args: Any, **kwargs: Any) -> Any:
        if self.side_effect:
            raise self.side_effect
        return self.response


class MockOpenAIClient:
    def __init__(self, completions: Any, base_url: str = "https://api.groq.com/openai/v1") -> None:
        self.base_url = base_url
        self.chat = SimpleNamespace(completions=completions)


def test_sync_non_streaming() -> None:
    tt = TokenTrail(api_key="tt_mock", flush_interval=60.0)
    original_client = MockOpenAIClient(MockCompletions())
    wrapped = tt.wrap_openai(original_client)

    messages = [{"role": "user", "content": "What is 2+2?"}]
    response = wrapped.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
    )

    # 1. Proves wrapped client returns exactly what original returns
    assert response.id == "chatcmpl_mock_123"
    assert response.choices[0].message.content == "Hello world!"

    # 2. Verify span captured in queue
    spans = tt.queue.get_batch(10, timeout=0.0)
    assert len(spans) == 1
    s = spans[0]
    assert s.name == "chat_completion"
    assert s.model == "llama-3.3-70b-versatile"
    assert s.provider == "groq"
    assert s.prompt_tokens == 15
    assert s.completion_tokens == 5
    assert s.cost_is_estimated is False
    assert s.status == "ok"
    assert s.input == "user: What is 2+2?"
    assert s.output == "Hello world!"
    assert s.duration_ms is not None and s.duration_ms >= 0


@pytest.mark.asyncio
async def test_async_non_streaming() -> None:
    tt = TokenTrail(api_key="tt_mock", flush_interval=60.0)
    original_client = MockOpenAIClient(MockAsyncCompletions())
    wrapped = tt.wrap_openai(original_client)

    response = await wrapped.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": "Hi"}],
    )

    assert response.id == "chatcmpl_mock_123"
    spans = tt.queue.get_batch(10, timeout=0.0)
    assert len(spans) == 1
    assert spans[0].status == "ok"


def test_sync_streaming_with_usage() -> None:
    """Tests streaming where final chunk contains provider usage statistics."""

    def stream_generator():
        time.sleep(0.01)  # Simulate network latency before first token
        yield SimpleNamespace(
            choices=[SimpleNamespace(delta=SimpleNamespace(content="Hello "))],
            usage=None,
        )
        yield SimpleNamespace(
            choices=[SimpleNamespace(delta=SimpleNamespace(content="world!"))],
            usage=None,
        )
        yield SimpleNamespace(
            choices=[],
            usage=SimpleNamespace(prompt_tokens=10, completion_tokens=4),
        )

    tt = TokenTrail(api_key="tt_mock", flush_interval=60.0)
    client = MockOpenAIClient(MockCompletions(response=stream_generator()))
    wrapped = tt.wrap_openai(client)

    stream = wrapped.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": "Say hello"}],
        stream=True,
    )

    # Consume stream
    collected = []
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            collected.append(chunk.choices[0].delta.content)

    assert "".join(collected) == "Hello world!"

    spans = tt.queue.get_batch(10, timeout=0.0)
    assert len(spans) == 1
    s = spans[0]
    assert s.name == "chat_completion"
    assert s.output == "Hello world!"
    assert s.prompt_tokens == 10
    assert s.completion_tokens == 4
    assert s.cost_is_estimated is False
    assert s.ttft_ms is not None and s.ttft_ms >= 0
    assert s.duration_ms is not None and s.duration_ms >= s.ttft_ms


@pytest.mark.asyncio
async def test_async_streaming_without_usage_fallback_tiktoken() -> None:
    """Tests streaming where provider omits usage; verifies tiktoken fallback."""

    async def async_stream_generator():
        await asyncio.sleep(0.02)
        yield SimpleNamespace(
            choices=[SimpleNamespace(delta=SimpleNamespace(content="Quantum "))],
            usage=None,
        )
        yield SimpleNamespace(
            choices=[SimpleNamespace(delta=SimpleNamespace(content="Computing"))],
            usage=None,
        )

    tt = TokenTrail(api_key="tt_mock", flush_interval=60.0)
    client = MockOpenAIClient(MockAsyncCompletions(response=async_stream_generator()))
    wrapped = tt.wrap_openai(client)

    stream = await wrapped.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": "Explain quantum in two words"}],
        stream=True,
    )

    collected = []
    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            collected.append(chunk.choices[0].delta.content)

    assert "".join(collected) == "Quantum Computing"

    spans = tt.queue.get_batch(10, timeout=0.0)
    assert len(spans) == 1
    s = spans[0]
    assert s.cost_is_estimated is True
    assert s.prompt_tokens > 0
    assert s.completion_tokens > 0
    assert s.output == "Quantum Computing"
    assert s.ttft_ms is not None and s.ttft_ms >= 0


def test_llm_exception_captured_and_reraised() -> None:
    """Exceptions during LLM call are captured on the span and re-raised unchanged."""

    class CustomAPIError(Exception):
        pass

    tt = TokenTrail(api_key="tt_mock")
    failing_client = MockOpenAIClient(
        MockCompletions(side_effect=CustomAPIError("Rate limit reached: 429"))
    )
    wrapped = tt.wrap_openai(failing_client)

    with pytest.raises(CustomAPIError, match="Rate limit reached: 429"):
        wrapped.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "Hello"}],
        )

    spans = tt.queue.get_batch(10, timeout=0.0)
    assert len(spans) == 1
    s = spans[0]
    assert s.status == "error"
    assert s.error_type == "CustomAPIError"
    assert "Rate limit reached" in (s.error_message or "")
