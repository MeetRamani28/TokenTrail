#!/usr/bin/env python3
"""Manual verification script for Groq free-tier with TokenTrail SDK.

Usage:
    $env:GROQ_API_KEY="gsk_..."
    uv run python demo/test_groq_manual.py
"""

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
SDK_SRC = BACKEND_DIR / "sdk" / "src"
if str(SDK_SRC) not in sys.path:
    sys.path.insert(0, str(SDK_SRC))

from tokentrail import TokenTrail  # noqa: E402

try:
    from openai import OpenAI
except ImportError:
    print("OpenAI client not installed. Run: uv add --dev openai")
    sys.exit(0)


def main() -> None:
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        print("[INFO] GROQ_API_KEY environment variable is not set.")
        print("[INFO] To run the live Groq manual test against the free tier:")
        print("       PowerShell: $env:GROQ_API_KEY='gsk_...'")
        print("       uv run python demo/test_groq_manual.py")
        sys.exit(0)

    print("Initializing TokenTrail SDK and Groq OpenAI-compatible client...")
    tt = TokenTrail(
        api_key=os.getenv("TOKENTRAIL_API_KEY", "tt_dev_test_key"),
        endpoint=os.getenv("TOKENTRAIL_ENDPOINT", "http://localhost:8000"),
    )

    client = tt.wrap_openai(
        OpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=groq_api_key,
        )
    )

    model = "llama-3.3-70b-versatile"
    print(f"\n1. Testing non-streaming completion with model: {model}...")
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": "Explain observability in AI in 20 words."}],
    )
    print("Response:", response.choices[0].message.content)
    if hasattr(response, "usage") and response.usage:
        print(
            f"Usage: {response.usage.prompt_tokens} prompt tokens, {response.usage.completion_tokens} completion tokens"
        )

    print(f"\n2. Testing streaming completion with TTFT tracking on {model}...")
    stream = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": "Count from 1 to 5."}],
        stream=True,
    )
    print("Streaming output: ", end="", flush=True)
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            print(chunk.choices[0].delta.content, end="", flush=True)
    print("\nStream completed.")

    print("\nFlushing spans to TokenTrail backend...")
    tt.flush(timeout=3.0)
    print("Done! Spans enqueued and sent.")


if __name__ == "__main__":
    main()
