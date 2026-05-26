// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Write a Snappy-compressed prometheus.WriteRequest to stdout (for curl tests).

use std::io::{self, Write};

fn main() {
    let req = machina_core::write_request_with_gauge(
        "machina_host_cpu_percent",
        42.0,
        chrono::Utc::now().timestamp_millis(),
    );
    let body = machina_core::encode_remote_write_body(&req).expect("encode");
    io::stdout().write_all(&body).expect("stdout");
}
