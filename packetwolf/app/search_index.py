# Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

"""Optional OpenSearch indexing for security events."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

OPENSEARCH_URL = os.environ.get("OPENSEARCH_URL", "").rstrip("/")
INDEX = "packetwolf-events"


def index_event(event: dict[str, Any]) -> None:
    if not OPENSEARCH_URL:
        return
    doc_id = event.get("id", "")
    url = f"{OPENSEARCH_URL}/{INDEX}/_doc/{doc_id}"
    data = json.dumps(event).encode()
    req = urllib.request.Request(url, data=data, method="PUT", headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=3)
    except (urllib.error.URLError, TimeoutError):
        pass


def search(query: str, host_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
    if not OPENSEARCH_URL:
        return []
    must: list[dict] = [{"query_string": {"query": query or "*"}}]
    if host_id:
        must.append({"term": {"host_id.keyword": host_id}})
    body = json.dumps({"size": limit, "query": {"bool": {"must": must}}}).encode()
    url = f"{OPENSEARCH_URL}/{INDEX}/_search"
    req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            payload = json.loads(resp.read().decode())
            hits = payload.get("hits", {}).get("hits", [])
            return [h.get("_source", {}) for h in hits]
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return []
