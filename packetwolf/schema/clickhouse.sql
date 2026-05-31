-- PacketWolf hot storage (ClickHouse)
CREATE DATABASE IF NOT EXISTS packetwolf;

CREATE TABLE IF NOT EXISTS packetwolf.security_events (
    id UUID,
    host_id String,
    timestamp DateTime64(3),
    kind LowCardinality(String),
    severity LowCardinality(String),
    verdict LowCardinality(String),
    process_pid UInt32 DEFAULT 0,
    process_ppid UInt32 DEFAULT 0,
    process_user String DEFAULT '',
    process_binary String DEFAULT '',
    process_args String DEFAULT '',
    network_src String DEFAULT '',
    network_dst String DEFAULT '',
    network_port UInt16 DEFAULT 0,
    network_protocol LowCardinality(String) DEFAULT '',
    dns_query String DEFAULT '',
    file_path String DEFAULT '',
    file_action LowCardinality(String) DEFAULT '',
    k8s_namespace String DEFAULT '',
    k8s_pod String DEFAULT '',
    k8s_container String DEFAULT '',
    summary String DEFAULT '',
    raw_tetragon String DEFAULT ''
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (host_id, timestamp, id);

CREATE TABLE IF NOT EXISTS packetwolf.process_edges (
    host_id String,
    parent_pid UInt32,
    child_pid UInt32,
    binary String,
    updated_at DateTime64(3)
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (host_id, parent_pid, child_pid);
