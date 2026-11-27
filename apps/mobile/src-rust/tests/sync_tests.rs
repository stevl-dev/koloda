//! Starting the sync engine through the façade, with a vault the host registered first.

use std::collections::HashMap;
use std::sync::Mutex;

use koloda_mobile::{KolodaMobile, MobileError};
use koloda_mobile_vault::{register_secret_vault, SecretVault, VaultError};
use serde_json::{json, Value};

#[derive(Default)]
struct MemoryVault(Mutex<HashMap<String, String>>);

impl SecretVault for MemoryVault {
    fn get(&self, key: String) -> Result<Option<String>, VaultError> {
        Ok(self.0.lock().unwrap_or_else(|e| e.into_inner()).get(&key).cloned())
    }
    fn set(&self, key: String, value: String) -> Result<(), VaultError> {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).insert(key, value);
        Ok(())
    }
    fn remove(&self, key: String) -> Result<(), VaultError> {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).remove(&key);
        Ok(())
    }
}

fn starter() -> String {
    json!({
        "algorithm": {
            "title": "Default",
            "content": {
                "type": "fsrs",
                "retention": 90,
                "weights": "0.1104, 2.2395, 3.9221, 11.7841, 6.1686, 0.6457, 3.6807, 1.9795, 0, 1.3826, 0.7024, 0.5999, 0.8146, 0.6398, 1, 1.3207, 0.6707, 3.8668, 0.4416, 0.0934, 1.8631, 0.6162, 1.0869, 0.1567, 0.0801, 0.2421, 0.9464, 0.1433, 0.7145, 0, 0.5667, 0.3734, 0.5333, 0.3048",
                "isFuzzEnabled": true,
                "learningSteps": [[1, "m"], [10, "m"]],
                "relearningSteps": [[10, "m"]],
                "maximumInterval": 36500,
            },
        },
        "template": {
            "title": "Default",
            "content": {
                "fields": [{ "id": "01900000-0000-7000-8000-000000000001", "title": "Front", "type": "text", "isRequired": true }],
                "layout": [{ "field": "01900000-0000-7000-8000-000000000001", "operation": "display" }],
            },
        },
    })
    .to_string()
}

#[tokio::test]
async fn sync_starts_once_the_host_registered_its_vault_and_reports_a_file_in_no_space() {
    register_secret_vault(Box::new(MemoryVault::default())).expect("register");
    let dir = tempfile::tempdir().expect("temp dir");
    let mobile = KolodaMobile::new(dir.path().join("koloda.db").to_string_lossy().into_owned()).expect("open");

    let started: Value = serde_json::from_str(&mobile.sync_start(starter()).await.expect("start")).expect("json");
    assert_eq!(started["state"], json!({ "type": "notEnrolled" }));

    // A second start, as after a JS reload, reuses the engine.
    let again: Value = serde_json::from_str(&mobile.sync_start(starter()).await.expect("restart")).expect("json");
    assert_eq!(again["state"], json!({ "type": "notEnrolled" }));
    let status: Value = serde_json::from_str(&mobile.sync_status().await.expect("status")).expect("json");
    assert_eq!(status["state"], json!({ "type": "notEnrolled" }));
}

#[tokio::test]
async fn a_background_tick_in_no_space_starts_the_engine_and_syncs_nothing() {
    register_secret_vault(Box::new(MemoryVault::default())).expect("register");
    let dir = tempfile::tempdir().expect("temp dir");
    let mobile = KolodaMobile::new(dir.path().join("koloda.db").to_string_lossy().into_owned()).expect("open");

    let ticked: Value = serde_json::from_str(&mobile.sync_tick(starter()).await.expect("tick")).expect("json");

    assert_eq!(ticked, json!({ "hasRun": false, "isDone": true }));
    let status: Value = serde_json::from_str(&mobile.sync_status().await.expect("status")).expect("json");
    assert_eq!(status["state"], json!({ "type": "notEnrolled" }));
}

#[tokio::test]
async fn a_file_in_no_space_cannot_invite_a_device() {
    register_secret_vault(Box::new(MemoryVault::default())).expect("register");
    let dir = tempfile::tempdir().expect("temp dir");
    let mobile = KolodaMobile::new(dir.path().join("koloda.db").to_string_lossy().into_owned()).expect("open");
    mobile.sync_start(starter()).await.expect("start");

    let error = mobile.sync_issue_pairing().await.expect_err("no space");

    let MobileError::App { code, .. } = error;
    assert_eq!(code, "sync.not-enrolled");
}
