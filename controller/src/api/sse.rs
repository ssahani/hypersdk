// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use std::convert::Infallible;
use std::time::Duration;

use axum::extract::State;
use axum::response::sse::{Event, KeepAlive, Sse};
use futures_util::stream::Stream;
use tokio_stream::StreamExt;
use tokio_stream::wrappers::BroadcastStream;

use crate::state::AppState;

pub async fn stream_events(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.events.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|msg| msg.ok().map(|data| Ok(Event::default().data(data))));
    Sse::new(stream).keep_alive(KeepAlive::new().interval(Duration::from_secs(15)))
}
