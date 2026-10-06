"""Auto-instrumentation entrypoint for TokenTrail.

Importing this module globally activates automatic patching across all supported LLM clients
(Groq, OpenAI, Anthropic, LiteLLM) and establishes background tracing.

Usage:
    import tokentrail.auto
"""

from tokentrail.instrumentation.patcher import patch_all

# Activate global runtime patching upon import
patch_all()
