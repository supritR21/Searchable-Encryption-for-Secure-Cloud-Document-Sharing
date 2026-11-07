# CipherShare — Database Design & Schema Specification

## 1. Schema ER Diagram

```mermaid
erDiagram
    users ||--o{ workspaces : "owns"
    users ||--o{ workspace_members : "participates"
    users ||--o{ documents : "owns"
    users ||--o{ document_access : "granted"
    users ||--o{ audit_logs : "acts"

    workspaces ||--o{ workspace_members : "contains"
    workspaces ||--o{ documents : "contains"
    workspaces ||--o{ search_index : "indexes"
    workspaces ||--o{ audit_logs : "records"

    documents ||--o{ search_index : "has_tokens"
    documents ||--o{ document_access : "access_envelopes"
    documents ||--o{ audit_logs : "records"

    users {
        uuid id PK
        varchar email UK
        varchar passwordHash
        bytea publicKeySpki
        bytea encryptedPrivateKey
        bytea privateKeySalt
        bytea privateKeyNonce
        jsonb privateKeyKdfParams
        varchar publicKeyAlgorithm
        timestamp createdAt
        timestamp updatedAt
    }

    workspaces {
        uuid id PK
        uuid ownerId FK
        bytea encryptedName
        bytea nameNonce
        int keyVersion
        timestamp createdAt
    }

    workspace_members {
        uuid id PK
        uuid workspaceId FK
        uuid userId FK
        enum role
        bytea wrappedSearchKey
        int keyVersion
        timestamp joinedAt
        timestamp revokedAt
    }

    documents {
        uuid id PK
        uuid workspaceId FK
        uuid ownerId FK
        bytea encryptedFile
        bytea fileNonce
        bytea encryptedMetadata
        bytea metadataNonce
        int cryptoVersion
        int keyVersion
        timestamp createdAt
        timestamp updatedAt
        timestamp deletedAt
    }

    search_index {
        uuid id PK
        uuid workspaceId FK
        uuid documentId FK
        bytea searchToken
        int keyVersion
        timestamp createdAt
    }

    document_access {
        uuid id PK
        uuid documentId FK
        uuid userId FK
        bytea encryptedDek
        enum permission
        uuid grantedBy FK
        timestamp createdAt
        timestamp revokedAt
    }

    audit_logs {
        uuid id PK
        uuid actorId FK
        varchar action
        uuid documentId FK
        uuid workspaceId FK
        timestamp createdAt
        jsonb details
    }
```

---

## 2. PostgreSQL BYTEA Justification

In CipherShare, all cryptographic data (ciphertexts, nonces, search tokens, wrapped keys, public/private key binaries) are stored directly as **`BYTEA`**:
1. **Zero Encoding Overhead**: Avoids 33% storage inflation caused by Base64 string representations in database storage.
2. **Binary Index Performance**: PostgreSQL evaluates B-Tree indexes over 32-byte `BYTEA` HMAC tokens substantially faster than string comparisons.
3. **Strict Tamper Detection**: Binary byte comparisons ensure nonces and GCM authentication tags cannot be altered by collation or character set transformations.

---

## 3. Indexing Strategy & Conjunctive Query Optimization

- `search_index`:
  - `@@unique([workspaceId, documentId, keyVersion, searchToken])` enforces duplicate token suppression per document.
  - `@@index([workspaceId, keyVersion, searchToken])` enables fast binary index lookups for trapdoor matching.
  - `@@index([documentId])` optimizes cascade deletion.
- `document_access`:
  - `@@unique([documentId, userId])` prevents duplicate access records.
  - `@@index([userId, revokedAt])` optimizes permission resolution and the "Shared with Me" view.
