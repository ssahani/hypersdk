// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::extract::{ConnectInfo, Request, State};
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::Response;
use std::net::SocketAddr;

struct Bucket {
    window_start: Instant,
    count: u32,
}

pub struct RateLimiter {
    inner: Mutex<HashMap<String, Bucket>>,
    limit: u32,
    window: Duration,
}

impl RateLimiter {
    pub fn new(limit: u32) -> Arc<Self> {
        Arc::new(Self {
            inner: Mutex::new(HashMap::new()),
            limit,
            window: Duration::from_secs(60),
        })
    }

    fn check(&self, key: &str) -> bool {
        let now = Instant::now();
        let mut map = self.inner.lock().expect("rate limiter lock");
        let bucket = map.entry(key.to_string()).or_insert(Bucket {
            window_start: now,
            count: 0,
        });
        if now.duration_since(bucket.window_start) >= self.window {
            bucket.window_start = now;
            bucket.count = 0;
        }
        if bucket.count >= self.limit {
            return false;
        }
        bucket.count += 1;
        true
    }
}

pub async fn rate_limit_middleware(
    State(limiter): State<Arc<RateLimiter>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let ip_key = format!("ip:{}", addr.ip());
    let key = if let Some(auth) = request.headers().get("authorization") {
        format!("auth:{}", auth.to_str().unwrap_or(""))
    } else if let Some(ip) = request.headers().get("x-forwarded-for") {
        format!("ip:{}", ip.to_str().unwrap_or("unknown"))
    } else {
        ip_key.clone()
    };
    if !limiter.check(&key) {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }
    if key != ip_key && !limiter.check(&ip_key) {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }
    Ok(next.run(request).await)
}
