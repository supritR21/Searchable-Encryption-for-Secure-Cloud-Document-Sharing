# CipherShare — System Architecture Specification

## 1. Monorepo Organization

CipherShare is structured as a TypeScript monorepo with strict separation of cryptographic responsibilities:

```
ciphershare/
├── apps/
│   ├── web/                     # Next.js 14 App Router (Client-side Cryptography & UI)
│   └── api/                     # Express.js + Prisma ORM (Metadata, BYTEA Storage & Access Control)
├── packages/
│   └── shared/                  # Universal Cryptographic Library, Types, Constants & Schemas
├── docs/                        # Complete Cryptographic & Engineering Documentation
├── docker-compose.yml           # Local PostgreSQL 16 Deployment
├── package.json                 # Monorepo Workspace Root
└── README.md
```

## 2. Layer Separation & Security Boundaries

```mermaid
flowchart TD
    subgraph ClientBrowser ["Browser Security Context (Next.js App)"]
        UI["User Interface (React/Tailwind)"]
        WebCrypto["Web Crypto API & hash-wasm"]
        Extract["PDF.js & Text Extractor"]
        DocEnc["AES-256-GCM + AAD Encryptor"]
        TokenGen["HMAC-SHA-256 Trapdoor Generator"]
        KeyStore["In-Memory CryptoKey Cache (Non-Extractable)"]
    end

    subgraph TransportBoundary ["Encrypted Transport (HTTPS / REST)"]
        OpaquePayload["Encrypted BYTEA, Nonces, Opaque Search Tokens & RSA Envelopes"]
    end

    subgraph CloudBackend ["Honest-But-Curious Server Context (Express.js)"]
        AuthMiddleware["JWT Authentication & Rate Limiting"]
        AccessEngine["Document & Workspace Access Control"]
        IndexMatcher["Inverted Index Query Engine (SQL Parameterized)"]
        PrismaORM["Prisma Client"]
    end

    subgraph DatabaseLayer ["PostgreSQL 16"]
        UsersTable["users (SPKI, Encrypted PKCS8, Argon2id params)"]
        WorkspacesTable["workspaces (BYTEA encrypted names)"]
        MembersTable["workspace_members (BYTEA wrappedSearchKey)"]
        DocsTable["documents (BYTEA encryptedFile, BYTEA nonces)"]
        IndexTable["search_index (BYTEA searchToken, docId, wsId)"]
        AccessTable["document_access (BYTEA encryptedDek, permission)"]
        AuditTable["audit_logs (Sanitized non-sensitive events)"]
    end

    UI --> Extract
    Extract --> TokenGen
    UI --> DocEnc
    DocEnc --> KeyStore
    TokenGen --> KeyStore
    WebCrypto --> KeyStore

    DocEnc --> OpaquePayload
    TokenGen --> OpaquePayload

    OpaquePayload --> AuthMiddleware
    AuthMiddleware --> AccessEngine
    AccessEngine --> IndexMatcher
    IndexMatcher --> PrismaORM
    PrismaORM --> UsersTable
    PrismaORM --> DocsTable
    PrismaORM --> IndexTable
    PrismaORM --> AccessTable
```

## 3. Cryptographic State Machine

1. **User Identity Initialization**:
   - `generateUserKeyPair()` creates a 3072-bit RSA-OAEP key pair extractable only in client memory.
   - `protectPrivateKey()` derives an AES-GCM key from the user password using Argon2id (`timeCost=3, memoryCost=64MB, parallelism=1`) and encrypts the PKCS8 private key with a fresh 12-byte nonce.
   - SPKI public key and encrypted private key package are uploaded to Express.

2. **Workspace Creation & Key Distribution**:
   - A 32-byte cryptographically secure random workspace search key is generated locally.
   - The creator encrypts the key with their RSA-OAEP public key (`wrapKeyForRecipient`).
   - When inviting Bob, Alice unwraps the search key locally using her private key, re-encrypts it using Bob's RSA-OAEP public key, and uploads the envelope to `workspace_members`.

3. **Document Ingestion**:
   - User selects a file (PDF or TXT).
   - Text is parsed page-by-page via PDF.js entirely in browser memory.
   - Text is normalized (Unicode NFC, lowercase, alphanumeric tokens, deduplicated).
   - Trapdoor generation: `HMAC-SHA-256(workspaceSearchKey, "ciphershare|" + workspaceId + "|" + keyword)`.
   - File encryption: 32-byte fresh DEK encrypts file with `AES-256-GCM` using 12-byte nonce and versioned AAD bound to `workspaceId` and `documentId`.
   - DEK is wrapped using the owner's RSA-OAEP public key.
   - Ciphertext bytes are transmitted and saved directly in PostgreSQL BYTEA.

4. **Encrypted Querying**:
   - User types a search query.
   - Browser computes HMAC trapdoors for all query terms.
   - Express queries `search_index` joined with `document_access` requiring active workspace membership and document-level permission.
   - Express returns matching document metadata and encrypted DEKs.
   - Browser decrypts metadata and downloads/decrypts document on demand.
