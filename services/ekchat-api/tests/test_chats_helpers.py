"""Unit tests for chats helper functions."""

from app.routers.chats import _build_columns_metadata, _parse_json_rows, _parse_table_reference


def test_parse_table_reference_with_selector():
    assert _parse_table_reference("file123:Sheet One") == ("file123", "Sheet One")


def test_parse_table_reference_without_selector():
    assert _parse_table_reference("file123") == ("file123", None)


def test_parse_json_rows_list_payload():
    raw = b'[{"amount": 10, "name": "alpha"}, {"amount": 20}]'
    headers, rows, total = _parse_json_rows(raw, limit=10)

    assert headers == ["amount", "name"]
    assert total == 2
    assert rows[0]["amount"] == 10
    assert rows[1]["name"] is None


def test_build_columns_metadata_detects_numeric_column():
    headers = ["amount", "label"]
    rows = [
        {"amount": "100.5", "label": "A"},
        {"amount": "42", "label": "B"},
        {"amount": "7", "label": "C"},
    ]

    metadata = _build_columns_metadata(headers, rows)
    kinds = {item["name"]: item["kind"] for item in metadata}

    assert kinds["amount"] == "number"
    assert kinds["label"] == "other"
