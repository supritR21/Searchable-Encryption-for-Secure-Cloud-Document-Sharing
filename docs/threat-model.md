# CipherShare — Threat Model & Security Boundaries

## 1. Threat Model Definition

CipherShare models cloud infrastructure according to the established cryptographic definition of an **honest-but-curious adversary** (also known as a semi-honest adversary):

### Adversary Capabilities
- Follows the application protocol truthfully (e.g. executes queries, stores records, enforces schema constraints).
- Can inspect all stored database rows in PostgreSQL (all tables, columns, BYTEA blobs).
- Can inspect file contents delivered over network interfaces.
- Can observe search tokens submitted in query parameters and body payloads.
- Can observe document IDs returned by searches and calculate result frequencies.
- Can observe request timing, payload sizes, and communication graphs.

### Adversary Inabilities
- Cannot perform arbitrary mathematical inversions of standard cryptographic primitives (AES-256-GCM, HMAC-SHA-256, RSA-OAEP-3072, Argon2id).
- Cannot access browser memory where decrypted `CryptoKey` objects and plaintext files reside.

---

## 2. Cryptographic Security Boundaries

```
[ UNTRUSTED ZONE: Cloud / DB / Network ]
  - Postgres: documents.encrypted_file, search_index.search_token, document_access.encrypted_dek
  - Express Server: Inverted index execution, JWT verification, rate limiting
-----------------------------------------------------------------------------------------
                                 <<< TRUST BOUNDARY >>>
-----------------------------------------------------------------------------------------
[ TRUSTED ZONE: User Client Machine ]
  - Web Crypto API (SubtleCrypto)
  - Plaintext documents, extracted text, and filenames
  - Decrypted DEKs (Data Encryption Keys)
  - Unlocked RSA-OAEP private keys & workspace search keys in RAM
```

---

## 3. Searchable Symmetric Encryption (SSE) Leakage Profile

CipherShare implements static Searchable Symmetric Encryption using deterministic HMAC tokens. In accordance with Applied Cryptography research (Curtmola et al., CCS 2006), the leakage profile is characterized as follows:

| Leakage Category | What is Leaked | Impact & Mitigations |
| :--- | :--- | :--- |
| **Search Pattern Leakage** | Whether two searches queried the same keyword | Queries for keyword $w$ repeatedly produce $T_w = \text{HMAC}(K_{ws}, \text{"ciphershare\|"} + id + \text{"\|"} + w)$. The server observes query repetition. Mitigated by workspace-level key isolation. |
| **Access Pattern Leakage** | Which encrypted document IDs match a given trapdoor | The server learns the list of matching document IDs for token $T_w$. |
| **Volume & Size Leakage** | File ciphertext byte length & keyword count | Encrypted files stored in PostgreSQL BYTEA have lengths approximately equal to original plaintext plus 16-byte GCM tag. Frequency of keywords per document is visible from token counts. |
| **Co-occurrence Leakage** | Pairs of terms appearing in the same document | The server observes document ID clusters sharing multiple tokens. |

> [!WARNING]
> CipherShare does **not** claim zero-leakage or perfect indistinguishability against frequency analysis attacks on small keyword vocabularies. Document search tokens operate deterministically within a workspace domain.

---

## 4. Specific Attack Scenarios & Mitigations

1. **Cut-and-Paste Attacks between Documents/Workspaces**:
   - *Risk*: Adversary re-associates ciphertext $C_A$ from Document A into Document B.
   - *Defense*: Versioned Additional Authenticated Data (AAD) bound to workspace and document UUIDs (`ciphershare-aad|v1|{wsId}|{docId}`) verified by AES-256-GCM authentication tag.

2. **Server-Side Plaintext Keyword Harvesting**:
   - *Risk*: Curious DBA runs SQL queries to extract popular search terms.
   - *Defense*: Search API accepts only 32-byte opaque HMAC-SHA-256 Base64URL tokens. Plaintext keywords are never transmitted to the server.

3. **Compromised Private Key Storage**:
   - *Risk*: Attacker dumps user table containing encrypted private keys.
   - *Defense*: Private keys are encrypted using AES-256-GCM under a key derived via Argon2id with 64 MB memory cost, 3 iterations, and 16-byte random salt. Decryption is computationally infeasible without the user's password.

4. **Revocation Bypass**:
   - *Risk*: Revoked user attempts to download document content or search index.
   - *Defense*: All SQL queries join `document_access` requiring `revokedAt IS NULL` and active `workspace_members`. Subsequent API requests return HTTP 404/403.
   - *Limitation*: If a user previously decrypted and cached a local plaintext copy prior to revocation, cryptographic software cannot forcibly delete local files from an offline disk.
