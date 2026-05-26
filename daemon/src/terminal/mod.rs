// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

mod http;
mod pty;
mod sessions;

pub use pty::run_ssh_terminal;
pub use sessions::{PendingSession, TerminalSessionStore};

pub fn http_routes() -> axum::Router<machina_core::LibvirtManager> {
    http::routes()
}
