# CipherShare — Backend REST API Specification

Base Route: `/api/v1`

---

## 1. Authentication Endpoints

### `POST /auth/register`
Creates an account and stores the user's public key and Argon2id-protected private key package.

**Request Body (JSON):**
```json
{
  "email": "alice@ciphershare.io",
  "password": "Password123!",
  "publicKeySpki": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
  "encryptedPrivateKey": "aW52ZXJ0ZWQgcHJpdmF0ZSBrZXkgY2lwaGVydGV4dA...",
  "privateKeySalt": "eHl6MTIzNHNhbHQxNmJ5dGVz...",
  "privateKeyNonce": "bm9uY2UxMmJ5dGVz...",
  "privateKeyKdfParams": {
    "timeCost": 3,
    "memoryCost": 65536,
    "parallelism": 1,
    "hashLength": 32
  },
  "publicKeyAlgorithm": "RSA-OAEP-3072"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "e30e1814-118c-4a39-9d57-19349c25f4bb",
      "email": "alice@ciphershare.io",
      "publicKeySpki": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8...",
      "publicKeyAlgorithm": "RSA-OAEP-3072",
      "createdAt": "2026-11-08T00:00:00.000Z"
    }
  }
}
```

---

### `POST /auth/login`
Authenticates the user and returns the encrypted private key package for client-side unlocking.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "e30e1814-118c-4a39-9d57-19349c25f4bb",
      "email": "alice@ciphershare.io",
      "publicKeySpki": "...",
      "encryptedPrivateKey": "...",
      "privateKeySalt": "...",
      "privateKeyNonce": "...",
      "privateKeyKdfParams": { ... }
    }
  }
}
```

---

## 2. Document & Search Endpoints

### `POST /workspaces/:workspaceId/documents`
Uploads a document encrypted client-side with AES-256-GCM and its associated HMAC trapdoor tokens.

**Request Format:** `multipart/form-data`
- `documentId`: (Optional UUID generated client-side for AAD binding)
- `encryptedMetadata`: Base64 encoded metadata ciphertext
- `fileNonce`: Base64 encoded 12-byte nonce
- `metadataNonce`: Base64 encoded 12-byte nonce
- `wrappedDek`: Base64 encoded DEK wrapped with owner's public key
- `searchTokens`: JSON array of Base64URL encoded HMAC-SHA-256 tokens
- `file`: Binary file stream (max 10 MB)

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "7b09c5a1-7786-4e58-944a-d69eb5c4beea",
    "workspaceId": "...",
    "ownerId": "...",
    "encryptedMetadata": "...",
    "metadataNonce": "...",
    "fileNonce": "...",
    "createdAt": "2026-11-08T00:00:00.000Z"
  }
}
```

---

### `POST /workspaces/:workspaceId/search`
Searches the inverted index using HMAC-SHA-256 trapdoors without revealing plaintext keywords.

**Request Body (JSON):**
```json
{
  "tokens": [
    "oUf3r0-6Q7e1_Q2B9Hn1234567890abcdefghijklm",
    "xYz8901234567890abcdefghijklm_Q2B9Hn123456"
  ],
  "mode": "AND",
  "limit": 20
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "7b09c5a1-7786-4e58-944a-d69eb5c4beea",
        "workspaceId": "...",
        "ownerId": "...",
        "encryptedMetadata": "...",
        "metadataNonce": "...",
        "permission": "READ",
        "wrappedDek": "...",
        "createdAt": "2026-11-08T00:00:00.000Z"
      }
    ],
    "totalMatches": 1,
    "searchDurationMs": 2.45
  }
}
```

---

## 3. Sharing & Revocation Endpoints

### `POST /documents/:id/share`
Shares a document with another registered user by supplying the DEK wrapped with the recipient's RSA-OAEP public key.

**Request Body (JSON):**
```json
{
  "recipientUserId": "c4793ff0-9302-4fc4-9bf5-c28f731cb279",
  "encryptedDek": "MIIEvgIBADANBgkqhkiG9w0BAQEFAASC...",
  "permission": "READ"
}
```

---

### `DELETE /documents/:id/access/:userId`
Revokes a recipient's access to the document. Subsequent requests by the revoked user return HTTP 404/403.
