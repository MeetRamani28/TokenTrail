"""TokenTrail Multi-Step Agent Demo Application.

Demonstrates:
- Top-level workflow instrumentation with @trace decorator
- Sub-span hierarchy for retrieval, tool execution, and guardrails
- Streaming LLM generation with automatic Time-to-First-Token (TTFT) and token tracking
- Graceful fallback when no live LLM API keys are provided
"""

import os
import sys
import time
from pathlib import Path
from types import SimpleNamespace
from typing import Any

# Ensure SDK is on sys.path when running standalone
sdk_src = Path(__file__).resolve().parent.parent / "sdk" / "src"
if sdk_src.exists() and str(sdk_src) not in sys.path:
    sys.path.insert(0, str(sdk_src))

from tokentrail import TokenTrail, set_default_client, trace  # noqa: E402

# 1. Initialize TokenTrail SDK and configure as default client
API_KEY = os.getenv("TOKENTRAIL_API_KEY", "tt_live_dev_test_key")
ENDPOINT = os.getenv("TOKENTRAIL_ENDPOINT", "http://127.0.0.1:8000")
tt = TokenTrail(api_key=API_KEY, endpoint=ENDPOINT, flush_interval=1.0)
set_default_client(tt)


# 2. Configure LLM client (Groq free tier or mock fallback)
def get_llm_client() -> Any:
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        try:
            from openai import OpenAI

            print(" [LLM] Using live Groq endpoint with GROQ_API_KEY")
            client = OpenAI(
                base_url="https://api.groq.com/openai/v1",
                api_key=groq_key,
            )
            return tt.wrap_openai(client)
        except Exception as e:
            print(f" [LLM] Failed to initialize OpenAI client for Groq: {e}, falling back to mock")

    print(" [LLM] No GROQ_API_KEY found; using simulated zero-dependency streaming client")

    def mock_create(model: str, messages: list[dict[str, str]], stream: bool = False) -> Any:
        chunks = [
            "TokenTrail ",
            "is ",
            "a ",
            "lightweight ",
            "LLM ",
            "observability ",
            "platform ",
            "with ",
            "zero ",
            "overhead.",
        ]

        def generator() -> Any:
            time.sleep(0.04)  # Simulate 40ms TTFT
            for word in chunks:
                time.sleep(0.015)
                yield SimpleNamespace(
                    choices=[SimpleNamespace(delta=SimpleNamespace(content=word))],
                    usage=None,
                )
            # Final chunk with provider usage
            yield SimpleNamespace(
                choices=[],
                usage=SimpleNamespace(prompt_tokens=18, completion_tokens=10),
            )

        return generator()

    mock_client = SimpleNamespace(
        chat=SimpleNamespace(
            completions=SimpleNamespace(create=mock_create)
        )
    )
    return tt.wrap_openai(mock_client)


wrapped_client = get_llm_client()


# 3. Step 1: Simulated Vector Retrieval
def perform_retrieval(query: str) -> list[str]:
    with tt.span("vector_db_retrieval", type="retrieval") as s:
        s.input = f"Embedding query: '{query}'"
        time.sleep(0.035)  # 35ms simulated vector search latency
        documents = [
            "Doc 1: TokenTrail utilizes a non-blocking background queue with drop-oldest policy.",
            "Doc 2: Model pricing is dynamically enriched per million tokens from the database.",
        ]
        s.output = f"Retrieved {len(documents)} documents"
        return documents


# 4. Step 2: Tool Execution (Calculator / Query Filter)
def execute_filter_tool(documents: list[str]) -> str:
    with tt.span("document_ranker_tool", type="tool") as s:
        s.input = f"Ranking {len(documents)} context fragments"
        time.sleep(0.02)  # 20ms simulated ranking latency
        ranked_context = "\n".join(documents)
        s.output = f"Context filtered to {len(ranked_context)} chars"
        return ranked_context


# 5. Step 3: Guardrail Check
def verify_guardrails(text: str) -> bool:
    with tt.span("content_safety_guardrail", type="chain") as s:
        s.input = text[:50]
        time.sleep(0.01)  # 10ms safety classifier
        s.output = "status: SAFE, score: 0.99"
        return True


# 6. Top-Level Workflow with @trace
@trace(name="research_assistant_workflow", tags=["demo", "research", "agent"])
def run_assistant(user_prompt: str) -> str:
    print(f"\n[Agent] Starting query: '{user_prompt}'")

    # Step 1: Retrieval
    docs = perform_retrieval(user_prompt)
    print(f" -> Retrieved {len(docs)} documents")

    # Step 2: Tool
    context = execute_filter_tool(docs)
    print(" -> Documents ranked and filtered")

    # Step 3: LLM Streaming Generation
    print(" -> Streaming response from LLM:")
    stream = wrapped_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": f"You are a helpful assistant. Context: {context}"},
            {"role": "user", "content": user_prompt},
        ],
        stream=True,
    )

    collected_chunks = []
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            word = chunk.choices[0].delta.content
            collected_chunks.append(word)
            sys.stdout.write(word)
            sys.stdout.flush()
    print()

    full_response = "".join(collected_chunks)

    # Step 4: Guardrail validation
    is_safe = verify_guardrails(full_response)
    if not is_safe:
        raise ValueError("Guardrail check failed on output")

    print("[Agent] Execution complete. Telemetry spans dispatched to background queue.")
    return full_response


def main() -> None:
    print("==================================================")
    print(" TokenTrail Observability Demo Application")
    print(f" Target Ingest Endpoint: {ENDPOINT}")
    print("==================================================")

    # Run query 1
    run_assistant("What is TokenTrail and how does its queue operate?")

    # Run query 2
    run_assistant("Explain how TTFT is captured during streaming.")

    print("\n[SDK] Flushing pending spans before exiting...")
    tt.flush(timeout=5.0)
    print("[SDK] All telemetry sent successfully!")


if __name__ == "__main__":
    main()
