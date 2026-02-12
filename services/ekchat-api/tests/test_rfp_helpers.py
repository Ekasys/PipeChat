"""Unit tests for RFP helper functions."""

from app.routers.rfp import (
    _build_capability_rows,
    _build_shred_rows,
    _extract_requirements,
    _extract_requirement_ids,
    _extract_rfp_tasks,
    _extract_text_from_bytes,
    _format_section_continuity,
)


def test_extract_requirements_prefers_requirement_lines():
    text = """
    The contractor shall provide a transition plan within 30 days.
    This line is short.
    The solution must maintain compliance with NIST 800-171 controls.
    """

    requirements = _extract_requirements(text, max_items=5)

    assert len(requirements) >= 2
    assert any("shall provide" in item.lower() for item in requirements)
    assert any("must maintain" in item.lower() for item in requirements)


def test_build_capability_rows_shape():
    rows = _build_capability_rows(
        ["The contractor shall provide monthly status reports."],
        [{"name": "history-a.pdf", "text": "Past proposal: we provide monthly status reports and governance updates."}],
    )

    assert len(rows) == 1
    row = rows[0]
    assert row["rfp_requirement_id"] == "REQ-001"
    assert "coverage_score" in row
    assert row["capability_area"]


def test_build_shred_rows_fallback_from_simple_text():
    rows = _build_shred_rows("Offeror must deliver status updates weekly.", max_rows=5)

    assert rows
    assert rows[0]["summary"]


def test_extract_text_from_bytes_plain_text():
    raw = "hello world".encode("utf-8")
    assert _extract_text_from_bytes("sample.txt", raw) == "hello world"


def test_extract_rfp_tasks_splits_heading_and_inline_requirement():
    text = (
        "3.1 Performance Work Statement: The contractor shall provide a transition plan.\n"
        "3.2 Staffing The contractor must maintain qualified personnel."
    )

    tasks = _extract_rfp_tasks(text)

    assert len(tasks) >= 2
    assert tasks[0]["title"].startswith("3.1 Performance Work Statement")
    assert "shall provide" in (tasks[0]["requirements"] or "").lower()
    assert tasks[1]["title"].startswith("3.2")
    assert "must maintain" in (tasks[1]["requirements"] or "").lower()


def test_extract_requirement_ids_uses_explicit_ids_when_present():
    ids = _extract_requirement_ids("REQ-7 and reqid 22 must both be addressed.", fallback_index=3)
    assert ids == ["REQ-007", "REQ-022"]


def test_format_section_continuity_returns_recent_prior_drafts_only():
    sections = [
        {"index": 1, "title": "Intro", "draft": "Intro draft body"},
        {"index": 2, "title": "Approach", "draft": "Approach draft body"},
        {"index": 3, "title": "Staffing", "draft": ""},
    ]

    continuity = _format_section_continuity(sections, current_index=3)

    assert "Section 1: Intro" in continuity
    assert "Section 2: Approach" in continuity
    assert "Section 3" not in continuity
