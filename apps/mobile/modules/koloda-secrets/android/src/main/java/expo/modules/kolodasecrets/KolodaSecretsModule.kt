package expo.modules.kolodasecrets

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import uniffi.koloda_mobile.registerSecretVault

// INVARIANT: JS only asks for the vault to be registered; no secret crosses into JS.
class KolodaSecretsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KolodaSecrets")

    Function("register") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      registerSecretVault(KeystoreVault(context.applicationContext))
    }
  }
}
