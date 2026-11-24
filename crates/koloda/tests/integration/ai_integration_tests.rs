use koloda::app::error::error_codes;
use koloda::domain::ai::AISecrets;
use koloda::domain::settings::SettingsName;
use koloda::repo::{ai, settings};
use serde_json::json;
use std::collections::BTreeMap;
use std::sync::Arc;

use crate::common::test_db;

mod test_store {
    use koloda::app::error::{error_codes, AppError};
    use koloda::app::secrets::{set_test_secret_store, SecretStore};
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};

    static LOCK: std::sync::LazyLock<std::sync::Mutex<()>> = std::sync::LazyLock::new(|| std::sync::Mutex::new(()));

    #[derive(Default)]
    pub struct MockSecretStore {
        data: Arc<Mutex<HashMap<String, String>>>,
    }

    impl SecretStore for MockSecretStore {
        fn get(&self, key: &str) -> Result<Option<String>, AppError> {
            Ok(self.data.lock().unwrap_or_else(|e| e.into_inner()).get(key).cloned())
        }

        fn set(&self, key: &str, value: &str) -> Result<(), AppError> {
            self.data
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .insert(key.to_string(), value.to_string());
            Ok(())
        }

        fn remove(&self, key: &str) -> Result<(), AppError> {
            self.data.lock().unwrap_or_else(|e| e.into_inner()).remove(key);
            Ok(())
        }
    }

    impl MockSecretStore {
        pub fn new() -> Self {
            Self::default()
        }

        pub fn into_arc(self) -> Arc<dyn SecretStore> {
            Arc::new(self)
        }
    }

    pub struct FailingGetSecretStore;

    impl SecretStore for FailingGetSecretStore {
        fn get(&self, _key: &str) -> Result<Option<String>, AppError> {
            Err(AppError::new(
                error_codes::KEYRING,
                Some("simulated keyring failure".to_string()),
            ))
        }
        fn set(&self, _key: &str, _value: &str) -> Result<(), AppError> {
            Ok(())
        }
        fn remove(&self, _key: &str) -> Result<(), AppError> {
            Ok(())
        }
    }

    pub struct FailingSetSecretStore {
        data: Arc<Mutex<HashMap<String, String>>>,
    }

    impl FailingSetSecretStore {
        pub fn new(data: Arc<Mutex<HashMap<String, String>>>) -> Self {
            Self { data }
        }

        pub fn into_arc(self) -> Arc<dyn SecretStore> {
            Arc::new(self)
        }
    }

    impl SecretStore for FailingSetSecretStore {
        fn get(&self, key: &str) -> Result<Option<String>, AppError> {
            Ok(self.data.lock().unwrap_or_else(|e| e.into_inner()).get(key).cloned())
        }
        fn set(&self, _key: &str, _value: &str) -> Result<(), AppError> {
            Err(AppError::new(
                error_codes::KEYRING,
                Some("simulated keyring set failure".to_string()),
            ))
        }
        fn remove(&self, key: &str) -> Result<(), AppError> {
            self.data.lock().unwrap_or_else(|e| e.into_inner()).remove(key);
            Ok(())
        }
    }

    pub struct FailingRemoveSecretStore {
        data: Arc<Mutex<HashMap<String, String>>>,
    }

    impl FailingRemoveSecretStore {
        pub fn new(data: Arc<Mutex<HashMap<String, String>>>) -> Self {
            Self { data }
        }

        pub fn into_arc(self) -> Arc<dyn SecretStore> {
            Arc::new(self)
        }
    }

    impl SecretStore for FailingRemoveSecretStore {
        fn get(&self, key: &str) -> Result<Option<String>, AppError> {
            Ok(self.data.lock().unwrap_or_else(|e| e.into_inner()).get(key).cloned())
        }
        fn set(&self, key: &str, value: &str) -> Result<(), AppError> {
            self.data
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .insert(key.to_string(), value.to_string());
            Ok(())
        }
        fn remove(&self, _key: &str) -> Result<(), AppError> {
            Err(AppError::new(
                error_codes::KEYRING,
                Some("simulated keyring remove failure".to_string()),
            ))
        }
    }

    pub fn setup_failing_store() -> Guard {
        let guard = LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let store: Arc<dyn SecretStore> = Arc::new(FailingGetSecretStore);
        set_test_secret_store(Some(store)).expect("set test secret store");
        Guard(guard)
    }

    pub fn setup_failing_set_store() -> Guard {
        let guard = LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let store = FailingSetSecretStore::new(Arc::new(Mutex::new(HashMap::new()))).into_arc();
        set_test_secret_store(Some(store)).expect("set test secret store");
        Guard(guard)
    }

    pub struct Guard(
        #[expect(dead_code, reason = "holds mutex guard for test isolation")] std::sync::MutexGuard<'static, ()>,
    );

    pub fn setup() -> Guard {
        let guard = LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let store = MockSecretStore::new().into_arc();
        set_test_secret_store(Some(store)).expect("set test secret store");
        Guard(guard)
    }

    pub fn setup_shared() -> (Guard, Arc<Mutex<HashMap<String, String>>>) {
        let guard = LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let data = Arc::new(Mutex::new(HashMap::new()));
        let store = MockSecretStore {
            data: Arc::clone(&data),
        }
        .into_arc();
        set_test_secret_store(Some(store)).expect("set test secret store");
        (Guard(guard), data)
    }

    pub fn replace_store(store: Arc<dyn SecretStore>) {
        set_test_secret_store(Some(store)).expect("set test secret store");
    }

    pub fn teardown(_guard: Guard) {
        set_test_secret_store(None).expect("clear test secret store");
    }
}

#[test]
fn ai_profiles_add_get_and_remove() {
    let _guard = test_store::setup();
    let db = test_db();

    let added = ai::add_ai_profile(
        &db,
        Some("Local model".to_string()),
        AISecrets::Ollama {
            base_url: "http://localhost:11434".to_string(),
            api_key: None,
        },
    )
    .expect("profile should be added");

    assert_eq!(added.title, Some("Local model".to_string()));
    assert!(!added.id.is_empty());

    let all = ai::get_ai_profiles(&db).expect("should get profiles");
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].id, added.id);

    ai::remove_ai_profile(&db, &added.id).expect("should remove profile");

    let after_remove = ai::get_ai_profiles(&db).expect("should get profiles after remove");
    assert!(after_remove.is_empty());

    test_store::teardown(_guard);
}

#[test]
fn ai_profile_api_key_is_stored_in_secret_store() {
    let _guard = test_store::setup();
    let db = test_db();

    let profile = ai::add_ai_profile(
        &db,
        Some("Test".to_string()),
        AISecrets::OpenRouter {
            api_key: Some("sk-secret-key".to_string()),
        },
    )
    .expect("profile should be added");

    let all = ai::get_ai_profiles(&db).expect("should get profiles");
    let retrieved = all.iter().find(|p| p.id == profile.id).expect("profile should exist");

    assert!(retrieved.has_secrets);
    match &retrieved.secrets {
        AISecrets::OpenRouter { api_key } => {
            assert!(api_key.is_none(), "public read must redact apiKey");
        }
        other => panic!("expected OpenRouter secrets, got {:?}", other),
    }

    let secrets = ai::get_ai_profile_secrets(&db, &profile.id)
        .expect("should load secrets")
        .expect("secrets should exist");
    assert_eq!(secrets.api_key(), Some("sk-secret-key"));

    test_store::teardown(_guard);
}

#[test]
fn api_key_only_profiles_round_trip_via_secret_store() {
    let cases = [
        AISecrets::OpenAi {
            api_key: Some("sk-openai-secret".to_string()),
        },
        AISecrets::DeepSeek {
            api_key: Some("sk-deepseek-secret".to_string()),
        },
        AISecrets::OpencodeGo {
            api_key: Some("go-secret".to_string()),
        },
        AISecrets::OpencodeZen {
            api_key: Some("zen-secret".to_string()),
        },
        AISecrets::OllamaCloud {
            api_key: Some("cloud-secret".to_string()),
        },
        AISecrets::Anthropic {
            api_key: Some("sk-ant-secret".to_string()),
        },
        AISecrets::Xai {
            api_key: Some("xai-secret".to_string()),
        },
        AISecrets::Vercel {
            api_key: Some("vercel-secret".to_string()),
        },
    ];

    for secrets in cases {
        let _guard = test_store::setup();
        let db = test_db();
        let provider = secrets.provider();
        let key = secrets.api_key().expect("each case carries a key").to_string();

        let added = ai::add_ai_profile(&db, None, secrets).expect("profile should be added");

        let profiles = ai::get_ai_profiles(&db).expect("should get profiles");
        let public = profiles
            .iter()
            .find(|p| p.id == added.id)
            .expect("profile should exist");
        assert!(public.has_secrets, "{provider}");
        assert_eq!(public.secrets.provider(), provider);
        assert_eq!(
            public.secrets.api_key(),
            None,
            "{provider}: public read must redact apiKey"
        );

        let stored = ai::get_ai_profile_secrets(&db, &added.id)
            .expect("should load secrets")
            .expect("secrets should exist");
        assert_eq!(stored.api_key(), Some(key.as_str()), "{provider}");

        test_store::teardown(_guard);
    }
}

fn openai_compatible_secrets(api_key: Option<&str>, headers: &[(&str, Option<&str>)]) -> AISecrets {
    AISecrets::OpenaiCompatible {
        base_url: "http://localhost:8000/v1".to_string(),
        api_key: api_key.map(str::to_string),
        headers: headers
            .iter()
            .map(|(name, value)| (name.to_string(), value.map(str::to_string)))
            .collect(),
        model_ids: Vec::new(),
    }
}

fn stored_headers(secrets: AISecrets) -> Option<BTreeMap<String, Option<String>>> {
    match secrets {
        AISecrets::OpenaiCompatible { headers, .. } => Some(headers),
        _ => None,
    }
}

#[test]
fn openai_compatible_profile_round_trips_base_url_key_headers_and_model_ids() {
    let (guard, data) = test_store::setup_shared();
    let db = test_db();
    let model_ids = vec!["llama-3.1-8b".to_string(), "qwen3-32b".to_string()];

    let mut secrets = openai_compatible_secrets(
        Some("sk-local"),
        &[
            ("X-Team", Some("team-1")),
            ("cf-aig-authorization", Some("Bearer gateway")),
        ],
    );
    if let AISecrets::OpenaiCompatible { model_ids: ids, .. } = &mut secrets {
        ids.clone_from(&model_ids);
    }
    let added = ai::add_ai_profile(&db, None, secrets).expect("profile should be added");

    let settings = settings::get_settings(&db, SettingsName::Ai)
        .expect("should read settings")
        .expect("settings row should exist");
    let settings_json = settings.content.to_string();
    assert!(
        !settings_json.contains("team-1") && !settings_json.contains("Bearer gateway"),
        "header values must stay out of the settings row: {settings_json}"
    );
    assert!(data
        .lock()
        .unwrap()
        .contains_key(&format!("ai-profile-{}-headers", added.id)));

    let profiles = ai::get_ai_profiles(&db).expect("should get profiles");
    let public = profiles
        .iter()
        .find(|p| p.id == added.id)
        .expect("profile should exist");
    assert!(public.has_secrets);
    match &public.secrets {
        AISecrets::OpenaiCompatible {
            base_url,
            api_key,
            headers,
            model_ids: public_model_ids,
        } => {
            assert_eq!(base_url, "http://localhost:8000/v1");
            assert_eq!(public_model_ids, &model_ids, "public read keeps the model IDs");
            assert!(api_key.is_none(), "public read must redact apiKey");
            assert_eq!(
                headers,
                &BTreeMap::from([("X-Team".to_string(), None), ("cf-aig-authorization".to_string(), None),]),
                "public read keeps the names and redacts the values"
            );
        }
        other => panic!("expected OpenaiCompatible secrets, got {:?}", other),
    }

    let stored = ai::get_ai_profile_secrets(&db, &added.id)
        .expect("should load secrets")
        .expect("secrets should exist");
    assert_eq!(stored.api_key(), Some("sk-local"));
    assert!(
        matches!(&stored, AISecrets::OpenaiCompatible { model_ids: ids, .. } if ids == &model_ids),
        "loaded secrets keep the model IDs"
    );
    assert_eq!(
        stored_headers(stored),
        Some(BTreeMap::from([
            ("X-Team".to_string(), Some("team-1".to_string())),
            ("cf-aig-authorization".to_string(), Some("Bearer gateway".to_string())),
        ]))
    );

    test_store::teardown(guard);
}

// WHY: the merge rule is pinned in the domain tests; this one owns reading the kept values back from the keyring.
#[test]
fn openai_compatible_edit_keeps_removes_and_sets_headers() {
    let _guard = test_store::setup();
    let db = test_db();

    let added = ai::add_ai_profile(
        &db,
        None,
        openai_compatible_secrets(None, &[("X-Kept", Some("kept")), ("X-Dropped", Some("dropped"))]),
    )
    .expect("profile should be added");

    ai::update_ai_profile(
        &db,
        &added.id,
        None,
        Some(openai_compatible_secrets(
            None,
            &[("X-Kept", None), ("X-Added", Some("added"))],
        )),
        None,
        None,
        None,
    )
    .expect("profile should be updated");

    let stored = ai::get_ai_profile_secrets(&db, &added.id)
        .expect("should load secrets")
        .expect("secrets should exist");
    assert_eq!(
        stored_headers(stored),
        Some(BTreeMap::from([
            ("X-Added".to_string(), Some("added".to_string())),
            ("X-Kept".to_string(), Some("kept".to_string())),
        ]))
    );

    test_store::teardown(_guard);
}

#[test]
fn openai_compatible_kept_header_without_stored_value_is_rejected_and_changes_nothing() {
    let _guard = test_store::setup();
    let db = test_db();

    let err = ai::add_ai_profile(&db, None, openai_compatible_secrets(None, &[("X-Missing", None)]))
        .expect_err("a kept header on add has nothing to keep");
    assert_eq!(err.code, error_codes::VALIDATION_SETTINGS_AI_PROVIDERS_HEADERS);
    assert!(ai::get_ai_profiles(&db).expect("should get profiles").is_empty());

    let added = ai::add_ai_profile(
        &db,
        None,
        openai_compatible_secrets(None, &[("X-Team", Some("team-1"))]),
    )
    .expect("profile should be added");
    let err = ai::update_ai_profile(
        &db,
        &added.id,
        None,
        Some(openai_compatible_secrets(None, &[("X-Missing", None)])),
        None,
        None,
        None,
    )
    .expect_err("a kept header the profile never stored is rejected");
    assert_eq!(err.code, error_codes::VALIDATION_SETTINGS_AI_PROVIDERS_HEADERS);

    let stored = ai::get_ai_profile_secrets(&db, &added.id)
        .expect("should load secrets")
        .expect("secrets should exist");
    assert_eq!(
        stored_headers(stored),
        Some(BTreeMap::from([("X-Team".to_string(), Some("team-1".to_string()))]))
    );

    test_store::teardown(_guard);
}

#[test]
fn removing_an_openai_compatible_profile_removes_its_header_values() {
    let (guard, data) = test_store::setup_shared();
    let db = test_db();

    let added = ai::add_ai_profile(
        &db,
        None,
        openai_compatible_secrets(None, &[("X-Team", Some("team-1"))]),
    )
    .expect("profile should be added");
    ai::remove_ai_profile(&db, &added.id).expect("profile should be removed");

    let keys: Vec<String> = data.lock().unwrap().keys().cloned().collect();
    assert!(
        keys.iter().all(|key| !key.contains(&added.id)),
        "no keyring entry may outlive the profile: {keys:?}"
    );

    test_store::teardown(guard);
}

#[test]
fn update_ai_profile_rejects_a_provider_change() {
    // Twin: "rejects a provider change on update" (apps/web/src/app/ai.test.ts).
    let _guard = test_store::setup();
    let db = test_db();

    let added = ai::add_ai_profile(
        &db,
        Some("OpenRouter".to_string()),
        AISecrets::OpenRouter {
            api_key: Some("sk-original-key".to_string()),
        },
    )
    .expect("profile should be added");

    let err = ai::update_ai_profile(
        &db,
        &added.id,
        Some("Local model".to_string()),
        Some(AISecrets::Ollama {
            base_url: "http://localhost:11434".to_string(),
            api_key: None,
        }),
        None,
        None,
        None,
    )
    .expect_err("a provider change must be rejected");
    assert_eq!(err.code, error_codes::VALIDATION_AI_PROVIDERS_PROVIDER_CHANGED);

    let all = ai::get_ai_profiles(&db).expect("should get profiles");
    let retrieved = all.iter().find(|p| p.id == added.id).expect("profile should exist");
    assert_eq!(
        retrieved.title,
        Some("OpenRouter".to_string()),
        "a rejected update writes nothing"
    );
    assert!(matches!(retrieved.secrets, AISecrets::OpenRouter { .. }));
    let secrets = ai::get_ai_profile_secrets(&db, &added.id)
        .expect("should load secrets")
        .expect("secrets should exist");
    assert_eq!(secrets.api_key(), Some("sk-original-key"), "the stored key stays");

    test_store::teardown(_guard);
}

#[test]
fn update_ai_profile_keeps_keyring_when_same_provider_omits_api_key() {
    let _guard = test_store::setup();
    let db = test_db();

    let added = ai::add_ai_profile(
        &db,
        Some("Local".to_string()),
        AISecrets::Ollama {
            base_url: "http://localhost:11434".to_string(),
            api_key: Some("local-key".to_string()),
        },
    )
    .expect("profile should be added");

    let updated = ai::update_ai_profile(
        &db,
        &added.id,
        Some("Local renamed".to_string()),
        Some(AISecrets::Ollama {
            base_url: "http://127.0.0.1:11434".to_string(),
            api_key: None,
        }),
        None,
        None,
        None,
    )
    .expect("profile should be updated");

    assert!(updated.has_secrets);
    let secrets = ai::get_ai_profile_secrets(&db, &added.id)
        .expect("should load secrets")
        .expect("secrets should exist");
    match secrets {
        AISecrets::Ollama { base_url, api_key } => {
            assert_eq!(base_url, "http://127.0.0.1:11434");
            assert_eq!(api_key.as_deref(), Some("local-key"));
        }
        other => panic!("expected Ollama secrets, got {:?}", other),
    }

    test_store::teardown(_guard);
}

#[test]
fn get_ai_profiles_propagates_keyring_error_instead_of_swallowing_it() {
    // WHY: stage a profile under a working store first; otherwise the failing
    // get_api_key in get_ai_profiles is never reached and the test passes
    // vacuously.
    let guard = test_store::setup();
    let db = test_db();
    ai::add_ai_profile(
        &db,
        Some("OpenRouter".to_string()),
        AISecrets::OpenRouter {
            api_key: Some("sk-secret-key".to_string()),
        },
    )
    .expect("profile should be added under working store");
    test_store::teardown(guard);

    let guard = test_store::setup_failing_store();
    let result = ai::get_ai_profiles(&db);

    let err = result.expect_err("get_ai_profiles must propagate keyring errors, not swallow as None");
    assert_eq!(
        err.code,
        error_codes::KEYRING,
        "the keyring error code must be preserved"
    );

    test_store::teardown(guard);
}

#[test]
fn add_ai_profile_rolls_back_settings_when_keyring_set_fails() {
    let _guard = test_store::setup_failing_set_store();
    let db = test_db();

    let err = ai::add_ai_profile(
        &db,
        Some("OpenRouter".to_string()),
        AISecrets::OpenRouter {
            api_key: Some("sk-secret-key".to_string()),
        },
    )
    .expect_err("add must fail when keyring set fails");
    assert_eq!(err.code, error_codes::KEYRING);

    let profiles = ai::get_ai_profiles(&db).expect("settings read should still work");
    assert!(profiles.is_empty(), "failed add must not leave a profile in settings");

    test_store::teardown(_guard);
}

#[test]
fn update_ai_profile_rolls_back_settings_when_keyring_set_fails() {
    let (guard, data) = test_store::setup_shared();
    let db = test_db();

    let added = ai::add_ai_profile(
        &db,
        Some("OpenRouter".to_string()),
        AISecrets::OpenRouter {
            api_key: Some("sk-original-key".to_string()),
        },
    )
    .expect("profile should be added");

    test_store::replace_store(test_store::FailingSetSecretStore::new(Arc::clone(&data)).into_arc());

    let err = ai::update_ai_profile(
        &db,
        &added.id,
        Some("Renamed".to_string()),
        Some(AISecrets::OpenRouter {
            api_key: Some("sk-new-key".to_string()),
        }),
        None,
        None,
        None,
    )
    .expect_err("update must fail when keyring set fails");
    assert_eq!(err.code, error_codes::KEYRING);

    let profiles = ai::get_ai_profiles(&db).expect("should get profiles");
    let retrieved = profiles
        .iter()
        .find(|p| p.id == added.id)
        .expect("profile should remain");
    assert_eq!(retrieved.title, Some("OpenRouter".to_string()));
    assert!(retrieved.has_secrets);
    match &retrieved.secrets {
        AISecrets::OpenRouter { api_key } => assert!(api_key.is_none()),
        other => panic!("expected redacted OpenRouter secrets after rollback, got {:?}", other),
    }
    let secrets = ai::get_ai_profile_secrets(&db, &added.id)
        .expect("should load secrets")
        .expect("secrets should exist");
    assert_eq!(secrets.api_key(), Some("sk-original-key"));

    test_store::teardown(guard);
}

#[test]
fn update_ai_profile_sets_clears_and_preserves_whitelist_model_ids() {
    let _guard = test_store::setup();
    let db = test_db();

    let added = ai::add_ai_profile(
        &db,
        Some("OpenRouter".to_string()),
        AISecrets::OpenRouter {
            api_key: Some("sk-secret-key".to_string()),
        },
    )
    .expect("profile should be added");
    assert_eq!(added.whitelist_model_ids, None);

    let set = ai::update_ai_profile(
        &db,
        &added.id,
        None,
        None,
        Some(Some(vec!["openai/gpt-4".to_string()])),
        None,
        None,
    )
    .expect("whitelist should be set");
    assert_eq!(set.whitelist_model_ids, Some(vec!["openai/gpt-4".to_string()]));

    let preserved = ai::update_ai_profile(&db, &added.id, Some("Renamed".to_string()), None, None, None, None)
        .expect("title-only update should preserve whitelist");
    assert_eq!(preserved.title, Some("Renamed".to_string()));
    assert_eq!(preserved.whitelist_model_ids, Some(vec!["openai/gpt-4".to_string()]));

    let cleared =
        ai::update_ai_profile(&db, &added.id, None, None, Some(None), None, None).expect("whitelist should clear");
    assert_eq!(cleared.whitelist_model_ids, None);

    let all = ai::get_ai_profiles(&db).expect("should get profiles");
    let retrieved = all.iter().find(|p| p.id == added.id).expect("profile should exist");
    assert_eq!(retrieved.whitelist_model_ids, None);

    test_store::teardown(_guard);
}

#[test]
fn update_ai_profile_sets_preserves_and_replaces_input_model_ids() {
    let _guard = test_store::setup();
    let db = test_db();

    let added = ai::add_ai_profile(
        &db,
        Some("OpenRouter".to_string()),
        AISecrets::OpenRouter {
            api_key: Some("sk-secret-key".to_string()),
        },
    )
    .expect("profile should be added");
    assert_eq!(added.image_input_model_ids, None);
    assert_eq!(added.pdf_input_model_ids, None);

    let set = ai::update_ai_profile(
        &db,
        &added.id,
        None,
        None,
        None,
        Some(vec!["local/vision".to_string()]),
        None,
    )
    .expect("image input list should be set");
    assert_eq!(set.image_input_model_ids, Some(vec!["local/vision".to_string()]));
    assert_eq!(
        set.pdf_input_model_ids, None,
        "the image list alone leaves the PDF list unset"
    );

    let set = ai::update_ai_profile(
        &db,
        &added.id,
        None,
        None,
        None,
        None,
        Some(vec!["local/reader".to_string()]),
    )
    .expect("PDF input list should be set");
    assert_eq!(set.pdf_input_model_ids, Some(vec!["local/reader".to_string()]));
    assert_eq!(
        set.image_input_model_ids,
        Some(vec!["local/vision".to_string()]),
        "the PDF list keeps the image list"
    );

    let preserved = ai::update_ai_profile(&db, &added.id, None, None, Some(Some(vec![])), None, None)
        .expect("allowlist-only update should preserve both input lists");
    assert_eq!(preserved.image_input_model_ids, Some(vec!["local/vision".to_string()]));
    assert_eq!(preserved.pdf_input_model_ids, Some(vec!["local/reader".to_string()]));

    ai::update_ai_profile(&db, &added.id, None, None, None, Some(vec![]), Some(vec![]))
        .expect("input lists should be replaced");
    let all = ai::get_ai_profiles(&db).expect("should get profiles");
    let retrieved = all.iter().find(|p| p.id == added.id).expect("profile should exist");
    assert_eq!(retrieved.image_input_model_ids, Some(vec![]));
    assert_eq!(retrieved.pdf_input_model_ids, Some(vec![]));

    test_store::teardown(_guard);
}

#[test]
fn update_ai_profile_rejects_empty_whitelist_model_id() {
    let _guard = test_store::setup();
    let db = test_db();

    let added = ai::add_ai_profile(
        &db,
        Some("OpenRouter".to_string()),
        AISecrets::OpenRouter {
            api_key: Some("sk-secret-key".to_string()),
        },
    )
    .expect("profile should be added");

    let err = ai::update_ai_profile(&db, &added.id, None, None, Some(Some(vec!["".to_string()])), None, None)
        .expect_err("empty model id must fail");
    assert_eq!(err.code, "validation.settings-ai.profiles.whitelist-model-ids");

    let profiles = ai::get_ai_profiles(&db).expect("settings read should still work");
    assert_eq!(
        profiles[0].whitelist_model_ids, None,
        "failed update must leave the allowlist unset"
    );

    test_store::teardown(_guard);
}

#[test]
fn add_ai_profile_rejects_title_over_max_length() {
    let _guard = test_store::setup();
    let db = test_db();

    // WHY: 129 Cyrillic chars are 258 UTF-8 bytes but 129 UTF-16 units — byte counting
    // would reject a title the TS zod mirror (UTF-16 units) accepts.
    let err = ai::add_ai_profile(
        &db,
        Some("ф".repeat(129)),
        AISecrets::OpenRouter {
            api_key: Some("sk-secret-key".to_string()),
        },
    )
    .expect_err("title over 128 UTF-16 units must fail");
    assert_eq!(err.code, "validation.common.title.too-long");

    let profiles = ai::get_ai_profiles(&db).expect("settings read should still work");
    assert!(profiles.is_empty(), "failed add must not leave a profile in settings");

    test_store::teardown(_guard);
}

#[test]
fn update_ai_profile_removes_title_sent_empty() {
    // Twin: "removes the title when an update sends an empty one" (apps/web/src/app/ai.test.ts).
    let _guard = test_store::setup();
    let db = test_db();

    let added = ai::add_ai_profile(
        &db,
        Some("OpenRouter".to_string()),
        AISecrets::OpenRouter {
            api_key: Some("sk-secret-key".to_string()),
        },
    )
    .expect("profile should be added");

    let updated = ai::update_ai_profile(&db, &added.id, Some(String::new()), None, None, None, None)
        .expect("profile should be updated");
    assert_eq!(updated.title, None, "an empty title is stored as absent");

    let profiles = ai::get_ai_profiles(&db).expect("should get profiles");
    assert_eq!(profiles[0].title, None, "the cleared title must persist");

    test_store::teardown(_guard);
}

#[test]
fn update_ai_profile_rejects_title_over_max_length() {
    let _guard = test_store::setup();
    let db = test_db();

    let added = ai::add_ai_profile(
        &db,
        Some("OpenRouter".to_string()),
        AISecrets::OpenRouter {
            api_key: Some("sk-secret-key".to_string()),
        },
    )
    .expect("profile should be added");

    // WHY: 129 Cyrillic chars are 258 UTF-8 bytes but 129 UTF-16 units — byte counting
    // would reject a title the TS zod mirror (UTF-16 units) accepts.
    let err = ai::update_ai_profile(&db, &added.id, Some("ф".repeat(129)), None, None, None, None)
        .expect_err("title over 128 UTF-16 units must fail");
    assert_eq!(err.code, "validation.common.title.too-long");

    let profiles = ai::get_ai_profiles(&db).expect("should get profiles");
    let retrieved = profiles
        .iter()
        .find(|p| p.id == added.id)
        .expect("profile should remain");
    assert_eq!(
        retrieved.title,
        Some("OpenRouter".to_string()),
        "failed update must leave the stored title unchanged"
    );

    test_store::teardown(_guard);
}

#[test]
fn remove_ai_profile_rolls_back_settings_when_keyring_remove_fails() {
    let (guard, data) = test_store::setup_shared();
    let db = test_db();

    let added = ai::add_ai_profile(
        &db,
        Some("OpenRouter".to_string()),
        AISecrets::OpenRouter {
            api_key: Some("sk-original-key".to_string()),
        },
    )
    .expect("profile should be added");

    test_store::replace_store(test_store::FailingRemoveSecretStore::new(Arc::clone(&data)).into_arc());

    let err = ai::remove_ai_profile(&db, &added.id).expect_err("remove must fail when keyring remove fails");
    assert_eq!(err.code, error_codes::KEYRING);

    let profiles = ai::get_ai_profiles(&db).expect("should get profiles");
    let retrieved = profiles
        .iter()
        .find(|p| p.id == added.id)
        .expect("profile should be restored after failed remove");
    assert_eq!(retrieved.title, Some("OpenRouter".to_string()));
    assert!(retrieved.has_secrets);
    let secrets = ai::get_ai_profile_secrets(&db, &added.id)
        .expect("should load secrets")
        .expect("secrets should exist");
    assert_eq!(secrets.api_key(), Some("sk-original-key"));

    test_store::teardown(guard);
}

#[test]
fn update_ai_profile_not_found() {
    let _guard = test_store::setup();
    let db = test_db();

    // Twin: "throws not-found on update when the ai settings row is absent" in
    // apps/web/src/app/ai.test.ts — both hosts reject a missing-profile update.
    let err = ai::update_ai_profile(
        &db,
        "01900000-0000-7000-8000-000000000009",
        Some("Renamed".to_string()),
        None,
        None,
        None,
        None,
    )
    .expect_err("update without an ai settings row should fail");
    assert_eq!(err.code, error_codes::NOT_FOUND_AI_PROFILE);

    ai::add_ai_profile(
        &db,
        Some("OpenRouter".to_string()),
        AISecrets::OpenRouter {
            api_key: Some("sk-or".to_string()),
        },
    )
    .expect("profile should be added");

    let err = ai::update_ai_profile(
        &db,
        "01900000-0000-7000-8000-000000000009",
        Some("Renamed".to_string()),
        None,
        None,
        None,
        None,
    )
    .expect_err("update of a missing profile should fail");
    assert_eq!(err.code, error_codes::NOT_FOUND_AI_PROFILE);
}

#[test]
fn remove_ai_profile_creates_default_row_when_settings_absent() {
    let _guard = test_store::setup();
    let db = test_db();

    // Twin: "creates the default ai row on remove when the settings row is absent"
    // in apps/web/src/app/ai.test.ts — the ai row exists after any remove.
    ai::remove_ai_profile(&db, "01900000-0000-7000-8000-000000000009")
        .expect("remove without an ai settings row should succeed");

    let settings = koloda::repo::settings::get_settings(&db, koloda::domain::settings::SettingsName::Ai)
        .expect("query should succeed")
        .expect("default ai settings row should exist after remove");
    assert_eq!(
        settings.content["profiles"].as_array().expect("profiles array").len(),
        0
    );
}

#[test]
fn profile_writes_keep_the_assistant_settings() {
    // Twin: "profile writes keep the assistant settings" (apps/web/src/app/ai.test.ts).
    let _guard = test_store::setup();
    let db = test_db();
    let assistant = json!({ "temperature": 0.7, "chatPromptTemplate": "mine", "chatPromptMode": "custom" });
    settings::set_settings(&db, SettingsName::Ai, json!({ "profiles": [], "assistant": assistant }))
        .expect("seed AI settings");
    let read_assistant = || {
        settings::get_settings(&db, SettingsName::Ai)
            .expect("read AI settings")
            .expect("AI settings row")
            .content["assistant"]
            .clone()
    };

    let added = ai::add_ai_profile(
        &db,
        Some("OpenRouter".to_string()),
        AISecrets::OpenRouter {
            api_key: Some("sk-secret-key".to_string()),
        },
    )
    .expect("profile should be added");
    assert_eq!(read_assistant(), assistant, "add keeps the assistant settings");

    ai::update_ai_profile(&db, &added.id, Some("Renamed".to_string()), None, None, None, None)
        .expect("profile should be updated");
    assert_eq!(read_assistant(), assistant, "update keeps the assistant settings");

    ai::remove_ai_profile(&db, &added.id).expect("profile should be removed");
    assert_eq!(read_assistant(), assistant, "remove keeps the assistant settings");

    test_store::teardown(_guard);
}

#[test]
fn generic_settings_writes_keep_the_stored_ai_profiles() {
    let _guard = test_store::setup();
    let db = test_db();
    let added = ai::add_ai_profile(
        &db,
        None,
        openai_compatible_secrets(Some("sk-local"), &[("X-Team", Some("team-1"))]),
    )
    .expect("profile should be added");
    let secrets_before = serde_json::to_value(
        ai::get_ai_profile_secrets(&db, &added.id)
            .expect("read secrets")
            .expect("profile secrets"),
    )
    .expect("serialize secrets");
    let stored_profiles = || {
        settings::get_settings(&db, SettingsName::Ai)
            .expect("read AI settings")
            .expect("AI settings row")
            .content["profiles"]
            .clone()
    };
    let profiles_before = stored_profiles();
    let mut moved = profiles_before.clone();
    moved[0]["secrets"] = json!({ "provider": "ollama", "baseUrl": "https://evil.example", "apiKey": null });
    let assistant = json!({ "temperature": 0.7, "chatPromptTemplate": "mine", "chatPromptMode": "custom" });

    let writes = [
        (
            "patch that moves the profile",
            true,
            json!({ "profiles": moved, "assistant": assistant }),
        ),
        (
            "set that moves the profile",
            false,
            json!({ "profiles": moved, "assistant": assistant }),
        ),
        (
            "patch that drops the profile",
            true,
            json!({ "profiles": [], "assistant": assistant }),
        ),
        (
            "set that drops the profile",
            false,
            json!({ "profiles": [], "assistant": assistant }),
        ),
        ("set with no profiles key", false, json!({ "assistant": assistant })),
    ];
    for (case, is_patch, content) in writes {
        let saved = if is_patch {
            settings::patch_settings(&db, SettingsName::Ai, content)
        } else {
            settings::set_settings(&db, SettingsName::Ai, content)
        }
        .unwrap_or_else(|err| panic!("{case}: write should succeed: {err:?}"));

        assert_eq!(
            saved.content["assistant"], assistant,
            "{case}: the assistant settings are saved"
        );
        assert_eq!(
            stored_profiles(),
            profiles_before,
            "{case}: the stored profiles are unchanged"
        );
        let secrets_after = ai::get_ai_profile_secrets(&db, &added.id)
            .expect("read secrets")
            .unwrap_or_else(|| panic!("{case}: the profile is still there"));
        assert_eq!(
            serde_json::to_value(secrets_after).expect("serialize secrets"),
            secrets_before,
            "{case}: the key and header values stay with the profile's own provider and base URL"
        );
    }

    test_store::teardown(_guard);
}
