use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use axum::http::header::LOCATION;
use axum::http::StatusCode;

use koloda::app::db::Database;
use koloda_sync::disk::SystemDisk;
use koloda_sync::engine::Engine;
use koloda_sync::runner::Event;
use koloda_sync::transport::{HttpTransport, Method, Request, Transport};
use koloda_sync_proto::registry::Kind;
use koloda_sync_proto::transport::Platform;

use crate::common::{MemorySecrets, Space, TestServer};
use crate::fixtures::{seed_settings, starter};
use crate::runner_support::{channel_sink, wait_for, ManualTimer, SILENT_FOR};

#[test]
fn a_space_is_created_over_http_on_loopback() {
    let server = TestServer::new();
    let serving = tokio::runtime::Runtime::new().expect("server runtime");
    let listener = serving
        .block_on(tokio::net::TcpListener::bind("127.0.0.1:0"))
        .expect("bind a loopback port");
    let address = listener.local_addr().expect("the bound address");
    let routes = server.router();
    let serve = serving.spawn(async move { axum::serve(listener, routes).await });

    let db = Database::in_memory().expect("in-memory database");
    let engine = Engine::start(
        db.clone(),
        Arc::new(MemorySecrets::default()),
        Arc::new(HttpTransport::new().expect("HTTP client")),
        Arc::new(SystemDisk),
        Platform::DesktopLinux,
        starter(),
    )
    .expect("engine starts");
    engine
        .create_space(&format!("http://{address}"), &server.setup_token, "Study", "Laptop")
        .expect("space is created over HTTP");

    assert!(
        koloda::repo::sync::enrolled_device(&db)
            .expect("sync state reads")
            .is_some(),
        "the file is enrolled"
    );
    serve.abort();
}

#[test]
fn a_grade_reaches_a_device_on_http_through_its_events_socket() {
    let space = Space::new();
    let library = space.device.library();
    space.device.engine.sync_now().expect("the library is pushed");
    let serving = tokio::runtime::Runtime::new().expect("server runtime");
    let listener = serving
        .block_on(tokio::net::TcpListener::bind("127.0.0.1:0"))
        .expect("bind a loopback port");
    let address = listener.local_addr().expect("the bound address");
    let routes = space.server.router();
    let serve = serving.spawn(async move { axum::serve(listener, routes).await });

    let db = Database::in_memory().expect("in-memory database");
    let phone = Engine::start(
        db.clone(),
        Arc::new(MemorySecrets::default()),
        Arc::new(HttpTransport::new().expect("HTTP client")),
        Arc::new(SystemDisk),
        Platform::DesktopLinux,
        starter(),
    )
    .expect("engine starts");
    let code = space.device.engine.issue_pairing(None).expect("a code is issued").code;
    phone
        .join(&format!("http://{address}"), &code, "Phone", seed_settings())
        .expect("the phone joins over HTTP");
    let timer = ManualTimer::default();
    let (sink, events) = channel_sink();
    phone
        .start_runner(sink, Arc::new(timer.clone()))
        .expect("the runner starts");
    timer.wait_for_sleep(SILENT_FOR);

    space.device.grade(&library.card);
    space.device.engine.sync_now().expect("the grade is pushed");

    wait_for(
        &events,
        |event| matches!(event, Event::Changed { kinds } if kinds.contains(&Kind::Reviews)),
    );
    let reviews: i64 = db
        .with_conn(|conn| {
            Ok(conn.query_row(
                "SELECT COUNT(*) FROM reviews WHERE card_id = ?1",
                [&library.card],
                |row| row.get(0),
            )?)
        })
        .expect("reviews count");
    assert_eq!(reviews, 1, "the nudge pulled the grade with no poll");
    serve.abort();
}

#[test]
fn a_redirect_is_not_followed_and_its_target_gets_nothing() {
    let serving = tokio::runtime::Runtime::new().expect("server runtime");
    let bind = || {
        serving
            .block_on(tokio::net::TcpListener::bind("127.0.0.1:0"))
            .expect("bind a loopback port")
    };
    let (target, server) = (bind(), bind());
    let target_address = target.local_addr().expect("the bound address");
    let server_address = server.local_addr().expect("the bound address");
    let hits = Arc::new(AtomicUsize::new(0));
    let counted = Arc::clone(&hits);
    let target_routes = axum::Router::new().fallback(move || {
        counted.fetch_add(1, Ordering::SeqCst);
        async { "taken" }
    });
    let location = format!("http://{target_address}/v1/pairings/claim");
    let server_routes = axum::Router::new().fallback(move || {
        let location = location.clone();
        async move { (StatusCode::TEMPORARY_REDIRECT, [(LOCATION, location)]) }
    });
    serving.spawn(async move { axum::serve(target, target_routes).await });
    serving.spawn(async move { axum::serve(server, server_routes).await });

    let response = serving
        .block_on(HttpTransport::new().expect("HTTP client").send(Request {
            method: Method::Post,
            url: format!("http://{server_address}/v1/pairings/claim"),
            token: None,
            epoch: None,
            schemas: None,
            body: Some(b"the code and the new token".to_vec()),
            is_zstd: false,
        }))
        .expect("a reply arrives");

    assert_eq!(response.status, 307, "the redirect is the reply");
    assert_eq!(
        hits.load(Ordering::SeqCst),
        0,
        "the body never reaches the redirect's target"
    );
}
