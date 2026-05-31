#!/usr/bin/env python3
# Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
"""Tail Tetragon pod logs and POST JSON events to PacketWolf ingest."""

from __future__ import annotations

import json
import os
import time
import urllib.request

from kubernetes import client, config

EXPORT_URL = os.environ["PACKETWOLF_EXPORT_URL"].rstrip("/")
HOST_ID = os.environ["PACKETWOLF_HOST_ID"]
API_KEY = os.environ.get("PACKETWOLF_API_KEY", "")
NAMESPACE = os.environ.get("TETRAGON_NAMESPACE", "kube-system")
LABEL = os.environ.get("TETRAGON_LABEL_SELECTOR", "app.kubernetes.io/name=tetragon")
INTERVAL = int(os.environ.get("PACKETWOLF_EXPORT_INTERVAL", "10"))
SINCE = int(os.environ.get("PACKETWOLF_EXPORT_SINCE", "15"))
BATCH = int(os.environ.get("PACKETWOLF_EXPORT_BATCH", "50"))


def post_events(events: list[dict]) -> None:
    if not events:
        return
    payload = json.dumps({"events": events}).encode()
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["Authorization"] = f"Bearer {API_KEY}"
    req = urllib.request.Request(
        f"{EXPORT_URL}/{HOST_ID}",
        data=payload,
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        resp.read()


def main() -> None:
    config.load_incluster_config()
    v1 = client.CoreV1Api()
    while True:
        try:
            pods = v1.list_namespaced_pod(NAMESPACE, label_selector=LABEL)
            for pod in pods.items:
                if pod.status.phase != "Running":
                    continue
                name = pod.metadata.name
                try:
                    logs = v1.read_namespaced_pod_log(
                        name,
                        NAMESPACE,
                        since_seconds=SINCE,
                        timestamps=False,
                    )
                except Exception as exc:  # noqa: BLE001
                    print(f"log read failed for {name}: {exc}")
                    continue
                batch: list[dict] = []
                for line in logs.splitlines():
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        batch.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
                    if len(batch) >= BATCH:
                        post_events(batch)
                        batch = []
                if batch:
                    post_events(batch)
        except Exception as exc:  # noqa: BLE001
            print(f"export loop error: {exc}")
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
