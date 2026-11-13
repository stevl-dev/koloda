import { requireNativeModule } from "expo";

type KolodaSecrets = { register(): void };

// INVARIANT: call before the sync engine starts; Rust refuses to start it without a registered vault.
export function registerSecretVault(): void {
  requireNativeModule<KolodaSecrets>("KolodaSecrets").register();
}
