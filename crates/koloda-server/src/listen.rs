//! The accept loop `serve` runs over TCP or TLS: HTTP/1.1 connections with a deadline on each request's headers, and
//! a cap on how many are open at once. `http::read_body` holds the body's deadline.
//!
//! WHY not `axum::serve`: it builds each connection with no timer, and hyper drops its header read timeout without
//! one, so a client that sends nothing, or a header a byte at a time, holds a socket for good without a token.

use std::future::Future;
use std::io;
use std::net::SocketAddr;
use std::pin::{pin, Pin};
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::Duration;

use axum::extract::ConnectInfo;
use axum::serve::Listener;
use axum::{Extension, Router};
use hyper_util::rt::{TokioIo, TokioTimer};
use hyper_util::service::TowerToHyperService;
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};
use tokio::sync::{watch, OwnedSemaphorePermit, Semaphore};

pub const HEADER_READ_TIMEOUT: Duration = Duration::from_secs(30);
/// How long a handler may wait for a request body, counted from when it starts reading.
// WHY: long enough for a 16 MiB body at about 55 KB/s, so only a client that stalls meets it.
pub const BODY_READ_TIMEOUT: Duration = Duration::from_secs(5 * 60);
// WHY: below the 1024 open files a Linux process gets by default, which the space databases and attachment files
// share with the sockets.
pub const MAX_CONNECTIONS: usize = 512;

#[derive(Clone, Copy, Debug)]
pub struct Limits {
    /// How long a request's headers may take to arrive, counted from when the connection is ready for them.
    pub header_read_timeout: Duration,
    /// How many connections are open at once; past it, the loop accepts no more until one closes.
    pub max_connections: usize,
}

impl Default for Limits {
    fn default() -> Limits {
        Limits {
            header_read_timeout: HEADER_READ_TIMEOUT,
            max_connections: MAX_CONNECTIONS,
        }
    }
}

/// Serves `router` on every connection `listener` accepts until `stop` resolves, then waits for the requests in
/// flight. Handlers see the peer as `ConnectInfo<SocketAddr>`.
pub async fn serve<L>(mut listener: L, router: Router, limits: Limits, stop: impl Future<Output = ()>)
where
    L: Listener<Addr = SocketAddr>,
{
    let permits = Arc::new(Semaphore::new(limits.max_connections));
    // Every connection task holds a clone of `open`, so `closing` reports when the last one ends; dropping `shutdown`
    // tells each to finish its request in flight and close.
    let (shutdown, _) = watch::channel(());
    let (closing, open) = watch::channel(());
    let mut stop = pin!(stop);
    loop {
        let permit = tokio::select! {
            permit = Arc::clone(&permits).acquire_owned() => match permit {
                Ok(permit) => permit,
                Err(_closed) => break,
            },
            () = &mut stop => break,
        };
        let (io, peer) = tokio::select! {
            accepted = listener.accept() => accepted,
            () = &mut stop => break,
        };
        let service = TowerToHyperService::new(router.clone().layer(Extension(ConnectInfo(peer))));
        let io = TokioIo::new(Counted { io, _permit: permit });
        let mut stopping = shutdown.subscribe();
        let open = open.clone();
        tokio::spawn(async move {
            let mut builder = hyper::server::conn::http1::Builder::new();
            builder
                .timer(TokioTimer::new())
                .header_read_timeout(limits.header_read_timeout);
            let mut connection = pin!(builder.serve_connection(io, service).with_upgrades());
            // WHY: an error here is the connection's own end, such as a header deadline or a client gone; there is
            // no one to report it to.
            tokio::select! {
                _ = connection.as_mut() => {}
                _ = stopping.changed() => {
                    connection.as_mut().graceful_shutdown();
                    drop(connection.as_mut().await);
                }
            }
            drop(open);
        });
    }
    drop(shutdown);
    drop(open);
    closing.closed().await;
}

/// An accepted connection and its place under the cap.
///
/// INVARIANT: the permit lives as long as the socket, which outlives the HTTP connection when it upgrades to the
/// events WebSocket, so open sockets count, not requests.
struct Counted<I> {
    io: I,
    _permit: OwnedSemaphorePermit,
}

impl<I: AsyncRead + Unpin> AsyncRead for Counted<I> {
    fn poll_read(self: Pin<&mut Self>, cx: &mut Context<'_>, buf: &mut ReadBuf<'_>) -> Poll<io::Result<()>> {
        Pin::new(&mut self.get_mut().io).poll_read(cx, buf)
    }
}

impl<I: AsyncWrite + Unpin> AsyncWrite for Counted<I> {
    fn poll_write(self: Pin<&mut Self>, cx: &mut Context<'_>, buf: &[u8]) -> Poll<io::Result<usize>> {
        Pin::new(&mut self.get_mut().io).poll_write(cx, buf)
    }

    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Pin::new(&mut self.get_mut().io).poll_flush(cx)
    }

    fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Pin::new(&mut self.get_mut().io).poll_shutdown(cx)
    }

    fn poll_write_vectored(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        bufs: &[io::IoSlice<'_>],
    ) -> Poll<io::Result<usize>> {
        Pin::new(&mut self.get_mut().io).poll_write_vectored(cx, bufs)
    }

    fn is_write_vectored(&self) -> bool {
        self.io.is_write_vectored()
    }
}
