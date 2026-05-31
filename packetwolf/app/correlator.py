# Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

"""Threat correlation rules — reverse shell, port scan, suspicious DNS, priv-esc chains."""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta

from .models import EventKind, SecurityEvent, Severity


def correlate_events(events: list[SecurityEvent]) -> list[dict]:
    """Return correlation findings from recent events."""
    findings: list[dict] = []
    by_host: dict[str, list[SecurityEvent]] = defaultdict(list)
    for e in events:
        by_host[e.host_id].append(e)

    for host_id, host_events in by_host.items():
        host_events.sort(key=lambda x: x.timestamp)
        findings.extend(_host_correlations(host_id, host_events))

    return findings


def _host_correlations(host_id: str, events: list[SecurityEvent]) -> list[dict]:
    out: list[dict] = []
    window = timedelta(minutes=30)

    # Reverse shell: nc/listen + outbound connect
    listeners = [e for e in events if e.kind == EventKind.SECURITY and "4444" in e.summary]
    if listeners:
        out.append({
            "kind": "reverse_shell",
            "host_id": host_id,
            "severity": "critical",
            "summary": "Possible reverse shell detected",
            "detail": listeners[-1].summary,
            "event_ids": [e.id for e in listeners[-3:]],
        })

    # Suspicious DNS cluster
    dns_bad = [
        e for e in events
        if e.kind == EventKind.DNS_QUERY
        and any(x in (e.dns.query or "") for x in ("suspicious", "malicious", ".xyz", ".ru"))
    ]
    if dns_bad:
        out.append({
            "kind": "suspicious_dns",
            "host_id": host_id,
            "severity": "high",
            "summary": f"{len(dns_bad)} suspicious DNS quer(ies)",
            "detail": dns_bad[-1].summary,
            "event_ids": [e.id for e in dns_bad[-5:]],
        })

    # Privilege escalation chain: sudo then sensitive file write
    priv = [e for e in events if e.kind == EventKind.PRIVILEGE_ESC]
    files = [e for e in events if e.kind == EventKind.FILE_WRITE]
    if priv and files:
        t0 = priv[-1].timestamp
        follow = [f for f in files if f.timestamp >= t0 and f.timestamp <= t0 + window]
        if follow:
            out.append({
                "kind": "privilege_escalation_chain",
                "host_id": host_id,
                "severity": "high",
                "summary": "Privilege escalation followed by sensitive file change",
                "detail": f"{priv[-1].summary} → {follow[-1].summary}",
                "event_ids": [priv[-1].id, follow[-1].id],
            })

    # Port scan heuristic: many distinct connect targets in short window
    connects = [e for e in events if e.kind == EventKind.NETWORK_CONNECT][-20:]
    ports = {e.network.port for e in connects if e.network.port}
    if len(ports) >= 5:
        out.append({
            "kind": "port_scan",
            "host_id": host_id,
            "severity": "medium",
            "summary": f"Unusual connect pattern — {len(ports)} distinct ports",
            "detail": connects[-1].summary if connects else "",
            "event_ids": [e.id for e in connects[-5:]],
        })

    return out


def correlations_to_anomalies(findings: list[dict]) -> list[dict]:
    """Promote correlation findings into anomaly feed shape."""
    return [
        {
            "id": f"corr-{f['kind']}-{f['host_id']}",
            "host_id": f["host_id"],
            "severity": f["severity"],
            "kind": f["kind"],
            "summary": f["summary"],
            "detail": f.get("detail", ""),
        }
        for f in findings
    ]
