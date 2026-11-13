package expo.modules.kolodasecrets

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import uniffi.koloda_mobile.MobileException
import uniffi.koloda_mobile.SecretVault

private const val KEYSTORE = "AndroidKeyStore"
private const val KEY_ALIAS = "koloda-secrets"
private const val PREFERENCES = "koloda-secrets"
private const val TRANSFORMATION = "AES/GCM/NoPadding"
private const val TAG_BITS = 128

// The app's secrets, each encrypted under an AES key that never leaves the Android Keystore.
// Stored as "<iv>:<ciphertext>", both Base64, in private shared preferences.
class KeystoreVault(context: Context) : SecretVault {
  private val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  override fun get(key: String): String? = guard {
    val stored = preferences.getString(key, null) ?: return@guard null
    val (iv, ciphertext) = stored.split(":", limit = 2).map { Base64.decode(it, Base64.NO_WRAP) }
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(TAG_BITS, iv))
    String(cipher.doFinal(ciphertext), Charsets.UTF_8)
  }

  override fun set(key: String, value: String) = guard {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, key())
    val ciphertext = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
    val stored = Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(ciphertext, Base64.NO_WRAP)
    // WHY: commit, not apply — Rust reads the secret back as soon as this returns.
    if (!preferences.edit().putString(key, stored).commit()) throw IllegalStateException("could not store $key")
  }

  override fun remove(key: String) = guard {
    if (!preferences.edit().remove(key).commit()) throw IllegalStateException("could not remove $key")
  }

  private fun key(): SecretKey {
    val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    (keyStore.getKey(KEY_ALIAS, null) as SecretKey?)?.let { return it }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
    generator.init(
      KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .build()
    )
    return generator.generateKey()
  }

  // WHY: Rust expects failures as the `MobileError` it declared; any other exception would abort the call.
  private fun <T> guard(block: () -> T): T =
    try {
      block()
    } catch (error: MobileException) {
      throw error
    } catch (error: Exception) {
      throw MobileException.App("secret-store", error.message ?: error.toString())
    }
}
