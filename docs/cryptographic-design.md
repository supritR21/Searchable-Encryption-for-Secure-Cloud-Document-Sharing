# CipherShare — Cryptographic Design & Mathematical Specifications

## 1. Cryptographic Primitive Summary

| Operation | Primitive | Parameters | Standards / References |
| :--- | :--- | :--- | :--- |
| **Document Encryption** | AES-GCM | 256-bit key, 96-bit random nonce, 128-bit authentication tag | NIST SP 800-38D |
| **Search Trapdoor Generation** | HMAC-SHA-256 | 256-bit workspace search key, 256-bit output | RFC 2104 / FIPS 198-1 |
| **Key Wrapping & Sharing** | RSA-OAEP | 3072-bit modulus, $e = 65537$, SHA-256 hash & MGF1 | RFC 8017 (PKCS#1 v2.2) |
| **Private-Key Derivation** | Argon2id | $m = 65536 \text{ KiB}$, $t = 3$, $p = 1$, 16-byte salt | RFC 9106 |
| **Password Authentication** | Argon2id | $m = 65536 \text{ KiB}$, $t = 3$, $p = 1$, 16-byte salt | OWASP Password Storage |
| **Random Number Generation** | CSPRNG | Web Crypto `getRandomValues` | NIST SP 800-90A |

---

## 2. Key Hierarchy & Lifecycle

```mermaid
graph TD
    UserPassword["User Account Password"] -->|Argon2id KDF| DerivedAESKey["Derived AES-256 Key"]
    DerivedAESKey -->|AES-256-GCM Decrypt| UserRSAKeyPair["User RSA-OAEP 3072 Key Pair"]

    WorkspaceCreator["Workspace Creator"] -->|CSPRNG U{0,1}^256| WorkspaceSearchKey["Workspace Search Key (32 Bytes)"]
    WorkspaceSearchKey -->|RSA-OAEP Wrap| WrappedSearchKey["Wrapped Search Key (in workspace_members)"]

    DocumentUpload["Document Ingestion"] -->|CSPRNG U{0,1}^256| DEK["Data Encryption Key (32 Bytes)"]
    DEK -->|AES-256-GCM + AAD| DocumentCiphertext["Encrypted Document (BYTEA)"]
    DEK -->|RSA-OAEP Wrap with Owner/Recipient PubKey| WrappedDEK["Wrapped DEK Envelope (in document_access)"]

    WorkspaceSearchKey -->|HMAC-SHA-256 with Keyword| SearchTokens["Search Tokens (in search_index)"]
```

---

## 3. Mathematical Formulations

### 3.1 Key Derivation for Private-Key Backup
Given user password $P$ and 16-byte random salt $S$:
$$K_{\text{derived}} = \text{Argon2id}(P, S, t=3, m=65536, p=1, \text{hashLength}=32)$$
The encrypted private key $C_{\text{sk}}$ is computed as:
$$C_{\text{sk}} = \text{AES-GCM-Encrypt}(K_{\text{derived}}, N_{\text{sk}}, \text{PKCS8}(SK_u))$$
where $N_{\text{sk}} \leftarrow \{0,1\}^{96}$ is a fresh cryptographic nonce.

### 3.2 Document Encryption with AAD Binding
Each document $D$ is assigned a freshly sampled DEK $K_{\text{dek}} \leftarrow \{0,1\}^{256}$ and nonce $N_{\text{file}} \leftarrow \{0,1\}^{96}$.
The Additional Authenticated Data is defined as:
$$\text{AAD} = \text{"ciphershare-aad\|v1\|"} \mathbin{\Vert} \text{workspaceId} \mathbin{\Vert} \text{"\|"} \mathbin{\Vert} \text{documentId}$$
The ciphertext is:
$$C_{\text{file}} = \text{AES-GCM-Encrypt}(K_{\text{dek}}, N_{\text{file}}, D, \text{AAD})$$
Document metadata $M$ is encrypted with separate nonce $N_{\text{meta}} \leftarrow \{0,1\}^{96}$:
$$C_{\text{meta}} = \text{AES-GCM-Encrypt}(K_{\text{dek}}, N_{\text{meta}}, \text{JSON}(M))$$

### 3.3 Search Token Derivation
For normalized keyword $w \in \text{Terms}(D)$:
$$T_w = \text{HMAC-SHA-256}(K_{\text{ws}}, \text{"ciphershare\|"} \mathbin{\Vert} \text{workspaceId} \mathbin{\Vert} \text{"\|"} \mathbin{\Vert} w)$$
The output $T_w \in \{0,1\}^{256}$ (32 bytes) is transmitted to the cloud as a Base64URL string and stored in PostgreSQL as `BYTEA`.

### 3.4 Multi-Keyword Conjunctive (AND) Queries
Given query keywords $W = \{w_1, w_2, \dots, w_k\}$:
1. The client derives tokens $\mathcal{T} = \{T_{w_1}, T_{w_2}, \dots, T_{w_k}\}$.
2. The database executes the conjunctive aggregation:
$$\mathcal{R} = \{ d \in \text{Docs} \mid |\{T \in \mathcal{T} \mid (d, T) \in \text{SearchIndex}\}| = k \land \text{Authorized}(u, d) \}$$
