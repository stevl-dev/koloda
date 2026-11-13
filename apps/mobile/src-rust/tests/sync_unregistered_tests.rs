//! Its own test binary: the vault registration is process-wide, so no other test may have registered one.

use koloda_mobile::{KolodaMobile, MobileError, SyncListener};

struct Ignore;

impl SyncListener for Ignore {
    fn on_event(&self, _event: String) {}
}

#[tokio::test]
async fn sync_refuses_to_start_before_the_host_registers_its_vault() {
    let dir = tempfile::tempdir().expect("temp dir");
    let mobile = KolodaMobile::new(dir.path().join("koloda.db").to_string_lossy().into_owned()).expect("open");

    let err = mobile
        .sync_start("{}".to_string(), Box::new(Ignore))
        .await
        .expect_err("no vault");

    let MobileError::App { code, .. } = err;
    assert_eq!(code, "secret-store");
}
