use std::future::pending;
use std::net::SocketAddr;
use std::time::Duration;

use koloda_server::listen::{self, Limits, HEADER_READ_TIMEOUT};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use crate::common::Harness;

const SECOND: Duration = Duration::from_secs(1);

async fn serve(harness: &Harness, limits: Limits) -> SocketAddr {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind a loopback port");
    let address = listener.local_addr().expect("the bound address");
    let router = harness.router.clone();
    tokio::spawn(listen::serve(listener, router, limits, pending()));
    address
}

async fn connect(address: SocketAddr) -> TcpStream {
    TcpStream::connect(address).await.expect("connect")
}

/// Everything the server sends until it closes the connection; a reset counts as closed.
async fn until_closed(stream: &mut TcpStream) -> String {
    let mut reply = Vec::new();
    drop(stream.read_to_end(&mut reply).await);
    String::from_utf8_lossy(&reply).into_owned()
}

async fn is_open_after(stream: &mut TcpStream, wait: Duration) -> bool {
    let mut byte = [0; 1];
    tokio::time::timeout(wait, stream.read(&mut byte)).await.is_err()
}

#[tokio::test(start_paused = true)]
async fn a_connection_that_sends_nothing_closes_at_the_header_deadline() {
    let harness = Harness::new();
    let address = serve(&harness, Limits::default()).await;
    let mut stream = connect(address).await;

    assert!(
        is_open_after(&mut stream, HEADER_READ_TIMEOUT.saturating_sub(SECOND)).await,
        "open before the deadline"
    );
    tokio::time::timeout(2 * SECOND, until_closed(&mut stream))
        .await
        .expect("closed at the deadline");
}

#[tokio::test(start_paused = true)]
async fn a_header_sent_in_pieces_still_meets_the_deadline() {
    let harness = Harness::new();
    let address = serve(&harness, Limits::default()).await;
    let mut stream = connect(address).await;

    // A byte every 10 s keeps the connection busy, but the whole header must arrive by the deadline.
    for byte in b"GET".iter() {
        stream.write_all(&[*byte]).await.expect("write a byte");
        assert!(is_open_after(&mut stream, Duration::from_millis(9_999)).await);
    }
    tokio::time::timeout(2 * SECOND, until_closed(&mut stream))
        .await
        .expect("closed at the deadline, 30 s after the first byte was awaited");
}

// WHY: on real time, unlike the tests above: paused time jumps to the next timer while the runtime waits on a socket,
// so the close of the first connection would lose to the test's own deadline. The windows bound a broken server, not
// an order: the drop is what lets the second in.
#[tokio::test]
async fn past_the_cap_a_connection_waits_until_one_closes() {
    let harness = Harness::new();
    let limits = Limits {
        max_connections: 1,
        ..Limits::default()
    };
    let address = serve(&harness, limits).await;
    let first = connect(address).await;
    let mut second = connect(address).await;
    // WHY: a request line hyper refuses on its own, so the reply needs no handler.
    second.write_all(b"?\r\n\r\n").await.expect("write the request");

    assert!(
        is_open_after(&mut second, Duration::from_millis(500)).await,
        "not served while the first is open"
    );
    drop(first);
    let reply = tokio::time::timeout(10 * SECOND, until_closed(&mut second))
        .await
        .expect("served once the first closes");
    assert!(reply.starts_with("HTTP/1.1 400"), "{reply}");
}
