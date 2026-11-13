//! Starting the sync engine through the façade, with a vault the host registered first.

use std::collections::HashMap;
use std::sync::Mutex;

use koloda_mobile::{register_secret_vault, KolodaMobile, MobileError, SecretVault, SyncListener};
use serde_json::{json, Value};

#[derive(Default)]
struct MemoryVault(Mutex<HashMap<String, String>>);

impl SecretVault for MemoryVault {
    fn get(&self, key: String) -> Result<Option<String>, MobileError> {
        Ok(self.0.lock().unwrap_or_else(|e| e.into_inner()).get(&key).cloned())
    }
    fn set(&self, key: String, value: String) -> Result<(), MobileError> {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).insert(key, value);
        Ok(())
    }
    fn remove(&self, key: String) -> Result<(), MobileError> {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).remove(&key);
        Ok(())
    }
}

struct Ignore;

impl SyncListener for Ignore {
    fn on_event(&self, _event: String) {}
}

fn starter() -> String {
    json!({
        "algorithm": {
            "title": "Default",
            "content": {
                "type": "fsrs",
                "retention": 90,
                "weights": "0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542",
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

    let started: Value =
        serde_json::from_str(&mobile.sync_start(starter(), Box::new(Ignore)).await.expect("start")).expect("json");
    assert_eq!(started["state"], json!({ "type": "notEnrolled" }));

    // A second start, as after a JS reload, reuses the engine.
    let again: Value =
        serde_json::from_str(&mobile.sync_start(starter(), Box::new(Ignore)).await.expect("restart")).expect("json");
    assert_eq!(again["state"], json!({ "type": "notEnrolled" }));
    let status: Value = serde_json::from_str(&mobile.sync_status().await.expect("status")).expect("json");
    assert_eq!(status["state"], json!({ "type": "notEnrolled" }));
}
