mod http;
mod pty;
mod sessions;

pub use pty::run_ssh_terminal;
pub use sessions::{PendingSession, TerminalSessionStore};

pub fn http_routes() -> axum::Router<virtspawn_core::LibvirtManager> {
    http::routes()
}
