//! The host's secret vault, as a UniFFI component of its own inside `koloda-mobile`'s library.
//!
//! WHY a separate crate: UniFFI keeps one process-wide vtable per callback interface, and each language's bindings
//! register theirs for every callback interface in a component. Kotlin implements the vault, so only the Kotlin
//! bindings may load this component; the app's JS bindings are generated for `koloda_mobile` alone
//! (`apps/mobile/native/project.json`). If JS registered a vtable here too, a JS reload would put it over Kotlin's.

use std::sync::{Arc, OnceLock};

use koloda::app::error::AppError;
use koloda::app::secrets::{register_host_secret_store, SecretStore};

uniffi::setup_scaffolding!();

/// `AppError` as the vault reports it.
#[derive(Debug, uniffi::Error)]
pub enum VaultError {
    App { code: String, details: Option<String> },
}

impl std::fmt::Display for VaultError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let VaultError::App { code, details } = self;
        match details {
            Some(details) => write!(f, "{code}: {details}"),
            None => write!(f, "{code}"),
        }
    }
}

impl std::error::Error for VaultError {}

impl From<AppError> for VaultError {
    fn from(err: AppError) -> Self {
        VaultError::App {
            code: err.code,
            details: err.details,
        }
    }
}

/// The host's secret store, which Kotlin (Android) or Swift (iOS) implements over the platform vault.
/// INVARIANT: only native code implements it, through the native bindings; secrets never reach JS.
#[uniffi::export(callback_interface)]
pub trait SecretVault: Send + Sync {
    fn get(&self, key: String) -> Result<Option<String>, VaultError>;
    fn set(&self, key: String, value: String) -> Result<(), VaultError>;
    fn remove(&self, key: String) -> Result<(), VaultError>;
}

struct VaultStore(Box<dyn SecretVault>);

fn vault_error(err: VaultError) -> AppError {
    let VaultError::App { code, details } = err;
    AppError::new(&code, details)
}

impl SecretStore for VaultStore {
    fn get(&self, key: &str) -> Result<Option<String>, AppError> {
        self.0.get(key.to_string()).map_err(vault_error)
    }
    fn set(&self, key: &str, value: &str) -> Result<(), AppError> {
        self.0.set(key.to_string(), value.to_string()).map_err(vault_error)
    }
    fn remove(&self, key: &str) -> Result<(), AppError> {
        self.0.remove(key.to_string()).map_err(vault_error)
    }
}

static VAULT: OnceLock<Arc<dyn SecretStore>> = OnceLock::new();

// INVARIANT: the host's native code calls this at startup, before JS starts sync.
#[uniffi::export]
pub fn register_secret_vault(vault: Box<dyn SecretVault>) -> Result<(), VaultError> {
    let store: Arc<dyn SecretStore> = Arc::new(VaultStore(vault));
    // WHY: a JS reload re-runs registration in the same process; the first vault stays.
    if VAULT.set(Arc::clone(&store)).is_ok() {
        register_host_secret_store(store)?;
    }
    Ok(())
}

pub fn registered_vault() -> Option<Arc<dyn SecretStore>> {
    VAULT.get().map(Arc::clone)
}
