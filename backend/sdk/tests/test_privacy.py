import re

from tokentrail import TokenTrail


def test_capture_content_disabled() -> None:
    """When capture_content=False, input and output text must never be recorded."""
    tt = TokenTrail(api_key="tt_mock", capture_content=False)

    with tt.span("private_call") as s:
        s.set_input("Sensitive user input with password=secret")
        s.set_output("Sensitive LLM output")

    spans = tt.queue.get_batch(10, timeout=0.0)
    assert len(spans) == 1
    assert spans[0].input is None
    assert spans[0].output is None


def test_custom_redaction_hook() -> None:
    """Custom redact function correctly masks sensitive patterns before storing."""

    def mask_emails(text: str) -> str:
        return re.sub(r"[\w\.-]+@[\w\.-]+", "[REDACTED_EMAIL]", text)

    tt = TokenTrail(api_key="tt_mock", capture_content=True, redact=mask_emails)

    with tt.span("call_with_pii") as s:
        s.set_input("Please send invoice to john.doe@example.com immediately.")
        s.set_output("Confirmation email forwarded to admin@company.org.")

    spans = tt.queue.get_batch(10, timeout=0.0)
    assert len(spans) == 1
    assert "john.doe@example.com" not in spans[0].input
    assert "[REDACTED_EMAIL]" in spans[0].input
    assert "admin@company.org" not in spans[0].output
    assert "[REDACTED_EMAIL]" in spans[0].output
