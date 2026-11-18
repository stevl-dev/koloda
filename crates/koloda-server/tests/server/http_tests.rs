use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use axum::body::{Body, Bytes};
use axum::http::StatusCode;
use koloda_server::listen::BODY_READ_TIMEOUT;
use koloda_sync_proto::transport::{Enrollment, ErrorCode, PairingClaim, PairingPreview, PushReply, MAX_BODY_BYTES};

use crate::common::{create_request, nonce, token, uuid, Harness};

/// A body that is not CBOR and records in `read` whether the server polled it.
fn watched(read: &Arc<AtomicBool>) -> Body {
    let read = Arc::clone(read);
    Body::from_stream(futures_util::stream::once(async move {
        read.store(true, Ordering::SeqCst);
        Ok::<_, std::io::Error>(Bytes::from_static(&[0xff]))
    }))
}

#[tokio::test]
async fn a_body_is_read_only_once_its_token_checks() {
    let harness = Harness::new();
    let home = harness.create_space("Home").await;
    let push = format!("/v1/spaces/{}/push", uuid(home.space_id));

    let read = Arc::new(AtomicBool::new(false));
    let unknown = harness
        .post(&push)
        .token(&token(&[7; 16]))
        .stream(watched(&read))
        .send::<PushReply>()
        .await;
    assert_eq!(unknown.error(), (StatusCode::UNAUTHORIZED, ErrorCode::UnknownDevice));
    assert!(
        !read.load(Ordering::SeqCst),
        "a token that names no device leaves the body unread"
    );

    let read = Arc::new(AtomicBool::new(false));
    let without_setup = harness
        .post("/v1/spaces")
        .stream(watched(&read))
        .send::<Enrollment>()
        .await;
    assert_eq!(
        without_setup.error(),
        (StatusCode::UNAUTHORIZED, ErrorCode::Unauthorized)
    );
    assert!(
        !read.load(Ordering::SeqCst),
        "a space creation without the setup token leaves the body unread"
    );

    let read = Arc::new(AtomicBool::new(false));
    let checked = harness
        .post(&push)
        .token(&home.token)
        .stream(watched(&read))
        .send::<PushReply>()
        .await;
    assert_eq!(checked.error(), (StatusCode::BAD_REQUEST, ErrorCode::BadRequest));
    assert!(read.load(Ordering::SeqCst), "a push whose token checks is read");
}

#[tokio::test]
async fn a_pairing_preview_or_claim_body_is_at_most_16_kib() {
    let harness = Harness::new();

    // WHY: zero bytes decode as CBOR integers, so a body at the cap gets past the size check and fails as CBOR.
    for path in ["/v1/pairings/preview", "/v1/pairings/claim"] {
        let at_cap = harness
            .post(path)
            .raw(vec![0; 16 * 1024], None)
            .send::<PairingClaim>()
            .await;
        let past_cap = harness
            .post(path)
            .raw(vec![0; 16 * 1024 + 1], None)
            .send::<PairingPreview>()
            .await;

        assert_eq!(
            at_cap.error(),
            (StatusCode::BAD_REQUEST, ErrorCode::BadRequest),
            "{path}"
        );
        assert_eq!(
            past_cap.error(),
            (StatusCode::PAYLOAD_TOO_LARGE, ErrorCode::TooLarge),
            "{path}"
        );
    }
}

#[tokio::test]
async fn a_body_at_the_size_cap_is_read_and_one_byte_more_is_refused() {
    let harness = Harness::new();

    // WHY: zero bytes decode as CBOR integers, so a body at the cap gets past the size check and fails as CBOR.
    let at_cap = harness
        .post("/v1/spaces")
        .token(&harness.setup_token)
        .raw(vec![0; MAX_BODY_BYTES], None)
        .send::<Enrollment>()
        .await;
    let past_cap = harness
        .post("/v1/spaces")
        .token(&harness.setup_token)
        .raw(vec![0; MAX_BODY_BYTES + 1], None)
        .send::<Enrollment>()
        .await;

    assert_eq!(at_cap.error(), (StatusCode::BAD_REQUEST, ErrorCode::BadRequest));
    assert_eq!(past_cap.error(), (StatusCode::PAYLOAD_TOO_LARGE, ErrorCode::TooLarge));
}

#[tokio::test]
async fn zstd_bodies_decode_within_the_expansion_cap() {
    let harness = Harness::new();
    let mut body = Vec::new();
    ciborium::into_writer(&create_request("Home", nonce("zstd")), &mut body).expect("encode");
    let compressed = zstd::encode_all(body.as_slice(), 3).expect("compress");
    let bomb = zstd::encode_all(vec![0; 1024 * 1024].as_slice(), 3).expect("compress a bomb");

    let accepted = harness
        .post("/v1/spaces")
        .token(&harness.setup_token)
        .raw(compressed, Some("zstd"))
        .accept_zstd()
        .send::<Enrollment>()
        .await;
    let refused = harness
        .post("/v1/spaces")
        .token(&harness.setup_token)
        .raw(bomb, Some("zstd"))
        .send::<Enrollment>()
        .await;

    assert_eq!(
        accepted.content_encoding.as_deref(),
        Some("zstd"),
        "a caller that accepts zstd gets it"
    );
    accepted.ok();
    assert_eq!(refused.error(), (StatusCode::PAYLOAD_TOO_LARGE, ErrorCode::TooLarge));
}

#[tokio::test]
async fn malformed_bodies_are_bad_requests() {
    let harness = Harness::new();
    let mut trailing = Vec::new();
    ciborium::into_writer(&create_request("Home", nonce("trailing")), &mut trailing).expect("encode");
    trailing.push(0);
    let cases = [
        ("not CBOR", vec![0xff, 0x00], None),
        ("bytes after the body", trailing, None),
        ("unknown encoding", vec![0], Some("br")),
    ];
    for (name, bytes, encoding) in cases {
        let answer = harness
            .post("/v1/spaces")
            .token(&harness.setup_token)
            .raw(bytes, encoding)
            .send::<Enrollment>()
            .await;

        assert_eq!(
            answer.error(),
            (StatusCode::BAD_REQUEST, ErrorCode::BadRequest),
            "{name}"
        );
    }
}

#[tokio::test]
async fn an_unknown_endpoint_is_a_not_found_reply() {
    let harness = Harness::new();

    let answer = harness.get("/v1/nothing").send::<()>().await;

    assert_eq!(answer.error(), (StatusCode::NOT_FOUND, ErrorCode::NotFound));
}

#[tokio::test(start_paused = true)]
async fn a_body_that_stalls_is_refused_at_the_body_deadline() {
    let harness = Harness::new();
    // WHY: the body arrives only at twice the deadline, so a server without one reads it and refuses it otherwise; one
    // with a deadline drops the body, and its timer, when the deadline passes.
    let stalled = Body::from_stream(futures_util::stream::once(async {
        tokio::time::sleep(2 * BODY_READ_TIMEOUT).await;
        Ok::<_, std::io::Error>(Bytes::from_static(&[0xff]))
    }));
    let start = tokio::time::Instant::now();

    let preview = harness
        .post("/v1/pairings/preview")
        .stream(stalled)
        .send::<PairingPreview>()
        .await;

    assert_eq!(preview.error(), (StatusCode::REQUEST_TIMEOUT, ErrorCode::Internal));
    assert_eq!(start.elapsed(), BODY_READ_TIMEOUT);
}

#[tokio::test]
async fn a_server_fault_answers_without_its_detail() {
    let harness = Harness::new();
    rusqlite::Connection::open(harness.generation_dir().join("server.db"))
        .expect("server.db opens")
        .execute("DROP TABLE space_creations", [])
        .expect("the table drops");

    let created = harness
        .post("/v1/spaces")
        .token(&harness.setup_token)
        .body(&create_request("Home", nonce("home")))
        .send::<Enrollment>()
        .await;

    assert_eq!(
        created.error(),
        (StatusCode::INTERNAL_SERVER_ERROR, ErrorCode::Internal)
    );
    let message = &created.reply.error.as_ref().expect("an error").message;
    assert!(
        !message.contains("space_creations") && !message.contains("sqlite"),
        "the reply names no table and no SQLite text: {message}"
    );
}
