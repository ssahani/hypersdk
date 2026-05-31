# Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

"""In-memory event store with demo seed data (ClickHouse optional)."""

from __future__ import annotations

import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from .models import DnsInfo, EventKind, FileInfo, NetworkInfo, ProcessInfo, SecurityEvent, Severity

_events: list[SecurityEvent] = []
_sensors: dict[str, dict[str, Any]] = {}
_process_edges: dict[str, list[tuple[int, int, str]]] = defaultdict(list)
_seeded = False


def _seed_demo() -> None:
    global _seeded
    if _seeded:
        return
    _seeded = True
    now = datetime.now(timezone.utc)
    hosts = ["h1", "h2", "demo-host"]
    for hid in hosts:
        _sensors[hid] = {
            "host_id": hid,
            "status": "healthy",
            "tetragon_version": "1.0.0",
            "last_event_at": now.isoformat(),
        }
    demo: list[SecurityEvent] = [
        SecurityEvent(
            host_id="h1",
            timestamp=now - timedelta(minutes=30),
            kind=EventKind.PROCESS_EXEC,
            severity=Severity.INFO,
            process=ProcessInfo(pid=1000, ppid=1, user="root", binary="/usr/sbin/sshd", args="-D"),
            summary="sshd started",
        ),
        SecurityEvent(
            host_id="h1",
            timestamp=now - timedelta(minutes=29),
            kind=EventKind.PROCESS_EXEC,
            severity=Severity.INFO,
            process=ProcessInfo(pid=1234, ppid=1000, user="sus", binary="/bin/bash", args="-l"),
            summary="bash started",
        ),
        SecurityEvent(
            host_id="h1",
            timestamp=now - timedelta(minutes=28),
            kind=EventKind.PROCESS_EXEC,
            severity=Severity.INFO,
            process=ProcessInfo(pid=1235, ppid=1234, user="sus", binary="/usr/bin/kubectl", args="get pods"),
            summary="kubectl get pods",
        ),
        SecurityEvent(
            host_id="h1",
            timestamp=now - timedelta(minutes=27),
            kind=EventKind.PROCESS_EXEC,
            severity=Severity.INFO,
            process=ProcessInfo(pid=1236, ppid=1235, user="sus", binary="/usr/bin/curl", args="https://api.github.com"),
            summary="curl https://api.github.com",
        ),
        SecurityEvent(
            host_id="h1",
            timestamp=now - timedelta(minutes=25),
            kind=EventKind.NETWORK_CONNECT,
            severity=Severity.INFO,
            process=ProcessInfo(pid=1236, binary="/usr/bin/curl", user="sus"),
            network=NetworkInfo(dst_ip="140.82.121.3", port=443, protocol="tcp"),
            verdict="allowed",
            summary="curl → github.com:443",
        ),
        SecurityEvent(
            host_id="h1",
            timestamp=now - timedelta(minutes=20),
            kind=EventKind.DNS_QUERY,
            severity=Severity.INFO,
            process=ProcessInfo(pid=1236, binary="/usr/bin/curl", user="sus"),
            dns=DnsInfo(query="api.github.com"),
            summary="curl → api.github.com",
        ),
        SecurityEvent(
            host_id="h1",
            timestamp=now - timedelta(minutes=15),
            kind=EventKind.PRIVILEGE_ESC,
            severity=Severity.HIGH,
            process=ProcessInfo(pid=1300, ppid=1234, user="sus", binary="/usr/bin/sudo", args="-s"),
            summary="User sus executed sudo",
        ),
        SecurityEvent(
            host_id="h1",
            timestamp=now - timedelta(minutes=10),
            kind=EventKind.FILE_WRITE,
            severity=Severity.HIGH,
            process=ProcessInfo(pid=1301, user="root", binary="/usr/bin/vim"),
            file=FileInfo(path="/etc/sudoers", action="write"),
            summary="Sensitive file modified: /etc/sudoers",
        ),
        SecurityEvent(
            host_id="h1",
            timestamp=now - timedelta(minutes=5),
            kind=EventKind.SECURITY,
            severity=Severity.CRITICAL,
            process=ProcessInfo(pid=1400, user="root", binary="/usr/bin/nc", args="-l 4444"),
            summary="Possible reverse shell on port 4444",
            verdict="blocked",
        ),
        SecurityEvent(
            host_id="h2",
            timestamp=now - timedelta(minutes=8),
            kind=EventKind.DNS_QUERY,
            severity=Severity.HIGH,
            process=ProcessInfo(pid=2001, binary="/usr/bin/curl", user="www-data"),
            dns=DnsInfo(query="suspicious-domain.xyz"),
            summary="curl → suspicious-domain.xyz",
        ),
    ]
    for ev in demo:
        ingest(ev)
    _process_edges["h1"] = [(1, 1000, "/usr/sbin/sshd"), (1000, 1234, "/bin/bash"), (1234, 1235, "/usr/bin/kubectl"), (1235, 1236, "/usr/bin/curl")]


def ingest(event: SecurityEvent) -> SecurityEvent:
    _seed_demo()
    _events.append(event)
    if event.process.ppid and event.process.pid:
        _process_edges[event.host_id].append(
            (event.process.ppid, event.process.pid, event.process.binary)
        )
    if event.host_id not in _sensors:
        _sensors[event.host_id] = {"host_id": event.host_id, "status": "healthy", "tetragon_version": "1.0.0"}
    _sensors[event.host_id]["last_event_at"] = event.timestamp.isoformat()
    return event


def ingest_raw(host_id: str, lines: list[dict[str, Any]]) -> int:
    from .normalizer import normalize_batch

    events = normalize_batch(host_id, lines)
    for ev in events:
        ingest(ev)
    return len(events)


def list_events(
    host_id: str | None = None,
    kind: EventKind | None = None,
    hours: int = 24,
    limit: int = 100,
) -> list[SecurityEvent]:
    _seed_demo()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    out = [e for e in _events if e.timestamp >= cutoff]
    if host_id:
        out = [e for e in out if e.host_id == host_id]
    if kind:
        out = [e for e in out if e.kind == kind]
    out.sort(key=lambda e: e.timestamp, reverse=True)
    return out[:limit]


def host_summary(host_id: str) -> dict[str, Any]:
    _seed_demo()
    events = list_events(host_id=host_id, limit=500)
    critical = sum(1 for e in events if e.severity == Severity.CRITICAL)
    high = sum(1 for e in events if e.severity == Severity.HIGH)
    threat = max(0, min(100, 100 - critical * 25 - high * 10))
    sensor = _sensors.get(host_id, {"host_id": host_id, "status": "not_installed"})
    return {
        "host_id": host_id,
        "threat_score": threat,
        "sensor": sensor,
        "event_counts": {
            "total": len(events),
            "critical": critical,
            "high": high,
        },
    }


def fleet_threat_summary() -> dict[str, Any]:
    _seed_demo()
    hosts = sorted(set(e.host_id for e in _events) | set(_sensors.keys()))
    summaries = [host_summary(h) for h in hosts]
    avg = sum(s["threat_score"] for s in summaries) / max(len(summaries), 1)
    critical_events = [
        e.model_dump(mode="json")
        for e in _events
        if e.severity in (Severity.CRITICAL, Severity.HIGH)
    ][:25]
    return {
        "fleet_threat_score": round(avg, 1),
        "hosts": summaries,
        "critical_events": critical_events,
        "sensors_healthy": sum(1 for s in _sensors.values() if s.get("status") == "healthy"),
        "sensors_total": len(_sensors),
    }


def process_graph(host_id: str, pid: int | None = None) -> dict[str, Any]:
    _seed_demo()
    edges = _process_edges.get(host_id, [])
    nodes: dict[int, dict[str, Any]] = {}
    for ppid, cpid, binary in edges:
        nodes.setdefault(ppid, {"pid": ppid, "binary": ""})
        nodes[cpid] = {"pid": cpid, "binary": binary, "ppid": ppid}
    if pid:
        ancestry = []
        cur = pid
        for _ in range(20):
            found = next((n for n in nodes.values() if n["pid"] == cur), None)
            if not found:
                break
            ancestry.append(found)
            cur = found.get("ppid")
            if not cur:
                break
        children = [{"pid": cp, "binary": b} for pp, cp, b in edges if pp == pid]
        return {"host_id": host_id, "pid": pid, "ancestry": ancestry, "children": children}
    return {
        "host_id": host_id,
        "nodes": list(nodes.values()),
        "edges": [{"from": pp, "to": cp, "binary": b} for pp, cp, b in edges],
    }


def open_ports(host_id: str) -> list[dict[str, Any]]:
    _seed_demo()
    ports = [
        {"port": 22, "protocol": "tcp", "service": "SSH", "process": "sshd", "user": "root", "bind": "0.0.0.0"},
        {"port": 443, "protocol": "tcp", "service": "HTTPS", "process": "nginx", "user": "www-data", "bind": "0.0.0.0"},
        {"port": 5432, "protocol": "tcp", "service": "PostgreSQL", "process": "postgres", "user": "postgres", "bind": "127.0.0.1"},
        {"port": 6443, "protocol": "tcp", "service": "Kubernetes", "process": "kube-apiserver", "user": "root", "bind": "0.0.0.0"},
    ]
    return [{"host_id": host_id, **p} for p in ports]


def search(query: str, host_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
    _seed_demo()
    q = query.lower()
    out = []
    for e in _events:
        if host_id and e.host_id != host_id:
            continue
        blob = f"{e.summary} {e.process.binary} {e.process.args} {e.dns.query} {e.file.path}".lower()
        if q in blob or not q.strip():
            out.append(e.model_dump(mode="json"))
        if len(out) >= limit:
            break
    return out


def register_sensor(host_id: str, tetragon_version: str = "1.0.0") -> dict[str, Any]:
    _sensors[host_id] = {
        "host_id": host_id,
        "status": "healthy",
        "tetragon_version": tetragon_version,
        "last_event_at": datetime.now(timezone.utc).isoformat(),
    }
    return _sensors[host_id]


def list_sensors() -> list[dict[str, Any]]:
    _seed_demo()
    return list(_sensors.values())


def asset_inventory() -> dict[str, Any]:
    _seed_demo()
    hosts: dict[str, Any] = {}
    for e in _events:
        h = hosts.setdefault(e.host_id, {"host_id": e.host_id, "processes": set(), "connections": []})
        if e.process.binary:
            h["processes"].add(e.process.binary)
        if e.kind == EventKind.NETWORK_CONNECT and e.network.dst_ip:
            h["connections"].append(
                {"from": e.process.binary, "to": f"{e.network.dst_ip}:{e.network.port}"}
            )
    return {
        "hosts": [
            {**v, "processes": sorted(v["processes"])} for v in hosts.values()
        ]
    }


CLICKHOUSE_URL = os.environ.get("CLICKHOUSE_URL", "")
