//! CORE — frozen. Machine identity + the builder-pass signature + state encryption.
//! Don't change without re-running the full test plan (secure_Hearthmon.md §10).

use base64::{engine::general_purpose::STANDARD, Engine};
use chacha20poly1305::aead::generic_array::GenericArray;
use chacha20poly1305::aead::Aead;
use chacha20poly1305::{ChaCha20Poly1305, KeyInit};
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

use super::state::ChapterState;

type HmacSha256 = Hmac<Sha256>;

/// Run `f` with the deobfuscated secret on the stack only for the duration of the call.
/// The plaintext never lives in a long-held variable, and `obfstr` keeps it out of `strings`.
fn with_secret<R>(f: impl FnOnce(&[u8]) -> R) -> R {
    // Inlined so the deobfuscated stack buffer lives for the whole call to `f`.
    f(obfstr::obfstr!(env!("HEARTHMON_PASS_SECRET")).as_bytes())
}

/// SHA-256 of the Windows MachineGuid, first 8 lowercase hex chars (32-bit binding id).
pub fn machine_hash() -> String {
    let guid = read_machine_guid().unwrap_or_else(|| "00000000-dev".to_string());
    let digest = Sha256::digest(guid.as_bytes());
    hex::encode(digest)[..8].to_string()
}

/// The user-facing request code, e.g. `HM-7X9K2P4M`.
pub fn request_code() -> String {
    format!("HM-{}", machine_hash().to_uppercase())
}

/// The canonical signature for a (machine_hash, yymmdd) pair: first 8 hex chars of
/// HMAC-SHA256(secret, machine_hash + yymmdd), uppercased. **This is the byte contract the
/// PowerShell admin script must reproduce exactly** (see tests + secure_Hearthmon.md §3).
pub fn sign(machine_hash: &str, yymmdd: &str) -> String {
    let msg = format!("{machine_hash}{yymmdd}");
    with_secret(|secret| {
        let mut mac =
            <HmacSha256 as Mac>::new_from_slice(secret).expect("hmac accepts any key length");
        mac.update(msg.as_bytes());
        hex::encode(mac.finalize().into_bytes())[..8].to_uppercase()
    })
}

/// Verify a builder-pass signature against THIS machine, in constant time.
pub fn verify_pass(yymmdd: &str, sig: &str) -> bool {
    let expected = sign(&machine_hash(), yymmdd);
    ct_eq(expected.as_bytes(), sig.to_uppercase().as_bytes())
}

/// Founder's Mark provenance: full HMAC-SHA256(secret, origin) hex. A forker can strip the
/// visible signature, but cannot forge THIS over their own build without the secret — so it
/// proves original lineage. (secure_Hearthmon: Founder's Mark.)
pub fn founder_signature(origin: &str) -> String {
    with_secret(|secret| {
        let mut mac =
            <HmacSha256 as Mac>::new_from_slice(secret).expect("hmac accepts any key length");
        mac.update(origin.as_bytes());
        hex::encode(mac.finalize().into_bytes())
    })
}

/// Short, stable hash of the origin string (for a human-readable build/origin id).
pub fn origin_hash(origin: &str) -> String {
    hex::encode(Sha256::digest(origin.as_bytes()))[..16].to_string()
}

#[cfg(test)]
mod tests {
    use super::sign;

    // Shared test vector — pins the Rust ⇄ PowerShell byte contract using the DEV fallback
    // secret ("dev-only-insecure-secret-do-not-ship", injected by build.rs when the env is
    // unset, as it is under `cargo test`). The admin script run with the same secret + inputs
    // MUST print this signature. If this test fails, the contract drifted.
    #[test]
    fn sign_matches_shared_vector() {
        assert_eq!(sign("7x9k2p4m", "260630"), SHARED_VECTOR);
    }

    // Computed by tools/generate_pass.ps1's HMAC with the dev secret:
    //   HMAC_SHA256("dev-only-insecure-secret-do-not-ship", "7x9k2p4m260630") → 2b0b5ae3 → upper.
    const SHARED_VECTOR: &str = "2B0B5AE3";
}

/// Encrypt + authenticate a state blob, bound to this machine. Returns base64(nonce‖ct‖tag).
pub fn encrypt_state(st: &ChapterState) -> Option<String> {
    let plaintext = serde_json::to_vec(st).ok()?;
    let cipher = ChaCha20Poly1305::new(GenericArray::from_slice(&derive_key()));
    let mut nonce = [0u8; 12];
    getrandom::getrandom(&mut nonce).ok()?;
    let ct = cipher
        .encrypt(GenericArray::from_slice(&nonce), plaintext.as_ref())
        .ok()?;
    let mut blob = Vec::with_capacity(12 + ct.len());
    blob.extend_from_slice(&nonce);
    blob.extend_from_slice(&ct);
    Some(STANDARD.encode(blob))
}

/// Decrypt a state blob. Any failure (tamper, wrong machine, corruption) → `None`, which the
/// caller treats as "missing/forged" and heals from the other store.
pub fn decrypt_state(blob: &str) -> Option<ChapterState> {
    let bytes = STANDARD.decode(blob.trim()).ok()?;
    if bytes.len() < 12 + 16 {
        return None; // too short to hold a nonce + an AEAD tag
    }
    let (nonce, ct) = bytes.split_at(12);
    let cipher = ChaCha20Poly1305::new(GenericArray::from_slice(&derive_key()));
    let plaintext = cipher.decrypt(GenericArray::from_slice(nonce), ct).ok()?;
    serde_json::from_slice(&plaintext).ok()
}

/// 32-byte key = HKDF-SHA256(ikm = secret, salt = machine_hash). Machine-bound, so a blob
/// copied from another laptop is undecryptable.
fn derive_key() -> [u8; 32] {
    let salt = machine_hash();
    with_secret(|secret| {
        let hk = Hkdf::<Sha256>::new(Some(salt.as_bytes()), secret);
        let mut okm = [0u8; 32];
        hk.expand(b"hearthmon-chapter-v1", &mut okm)
            .expect("32 is a valid HKDF output length");
        okm
    })
}

/// Constant-time byte compare (timing isn't a real threat for a local check, but it's cheap).
fn ct_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

#[cfg(windows)]
fn read_machine_guid() -> Option<String> {
    use winreg::enums::{HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_64KEY};
    use winreg::RegKey;
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    // Force the 64-bit view so a 32-bit build still reads the real MachineGuid.
    let key = hklm
        .open_subkey_with_flags(r"SOFTWARE\Microsoft\Cryptography", KEY_READ | KEY_WOW64_64KEY)
        .ok()?;
    key.get_value::<String, _>("MachineGuid").ok()
}

#[cfg(not(windows))]
fn read_machine_guid() -> Option<String> {
    None // dev fallback handled by the caller; the real target is Windows
}
