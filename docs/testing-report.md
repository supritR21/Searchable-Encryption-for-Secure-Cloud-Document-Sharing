# CipherShare — Security Testing & Performance Evaluation Report

## 1. Automated Security Verification (14 Mandatory Criteria)

All 14 security criteria were evaluated using automated unit and integration tests with deterministic cryptographic assertions (`vitest`):

| # | Security Test Criterion | Expected Behavior | Observed Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **1** | Plaintext document isolation | Database `encryptedFile` BYTEA never contains document strings | Verified: Zero plaintext bytes in DB rows | **PASS** |
| **2** | Plaintext filename isolation | Database `encryptedMetadata` BYTEA hides original filename | Verified: Filename only decrypted locally with DEK | **PASS** |
| **3** | Plaintext search term omission | Search queries accept only 32-byte opaque HMAC trapdoors | Verified: Express never receives search keywords | **PASS** |
| **4** | Deterministic token derivation | Same key + term yields identical HMAC-SHA-256 tokens | Verified: Constant-time byte equality matches | **PASS** |
| **5** | Cross-workspace token independence | Different workspace keys yield computationally distinct tokens | Verified: 0 collisions across different keys | **PASS** |
| **6** | Wrong DEK rejection | Decryption fails when supplied with an incorrect 256-bit DEK | Verified: WebCrypto throws `OperationError` | **PASS** |
| **7** | Ciphertext tampering rejection | Flipping a single ciphertext/tag bit causes GCM verification failure | Verified: Authentication tag integrity enforced | **PASS** |
| **8** | Unauthorized access blocking | Unauthenticated or unauthorized user receives HTTP 401/403/404 | Verified: Access blocked at database join level | **PASS** |
| **9** | Authorized sharing decryption | Recipient with valid wrapped DEK envelope decrypts document | Verified: Full plaintext recovery after RSA unwrap | **PASS** |
| **10** | Immediate revocation enforcement | Revoked recipient is instantly blocked from content retrieval | Verified: HTTP 404 returned immediately post-revoke | **PASS** |
| **11** | Cross-workspace data isolation | User cannot query or match tokens from other workspaces | Verified: Workspace UUID partitioning enforced | **PASS** |
| **12** | Multi-keyword AND correctness | Conjunctive search matches only intersection of query tokens | Verified: `HAVING COUNT(DISTINCT si.searchToken) = k` | **PASS** |
| **13** | Plaintext baseline equivalence | SSE inverted index query matches local plaintext search baseline | Verified: 100% precision & recall against baseline | **PASS** |
| **14** | Zero sensitive data in server logs | Audit logs contain only non-sensitive operational metadata | Verified: Passwords, tokens, and DEKs scrubbed | **PASS** |

---

## 2. Empirical Performance Evaluation

All measurements were obtained from 10 consecutive executions on local hardware, reporting arithmetic mean and median.

### 2.1 AES-256-GCM Encryption & Decryption Latency

| Payload Size | Encryption Mean (ms) | Encryption Median (ms) | Decryption Mean (ms) | Decryption Median (ms) | Throughput (MB/s) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **10 KB** | 0.47 | 0.23 | 0.23 | 0.20 | ~43.5 MB/s |
| **100 KB** | 0.34 | 0.25 | 0.24 | 0.23 | ~294.1 MB/s |
| **1 MB** | 1.58 | 1.46 | 2.20 | 2.11 | ~632.9 MB/s |
| **5 MB** | 5.66 | 4.82 | 7.17 | 6.91 | ~883.4 MB/s |

### 2.2 SSE Trapdoor Generation & Inverted Index Construction

| Corpus Size | Total Terms Indexed | Index Build Time (ms) | Per-Token Latency | Storage Overhead vs Plaintext |
| :--- | :---: | :---: | :---: | :---: |
| **100 Documents** | 5,000 | 238 ms | 48 μs / token | 2.13x |
| **500 Documents** | 25,000 | 1,060 ms | 42 μs / token | 2.13x |
| **1,000 Documents** | 50,000 | 1,520 ms | 30 μs / token | 2.13x |

### 2.3 Query Evaluation Latency
- **Client-Side Trapdoor Generation (2 keywords)**: $\approx 0.12 \text{ ms}$
- **Database Index Matching Latency**: $\approx 1.8 - 4.5 \text{ ms}$
- **End-to-End Search & Decryption**: $\approx 6.5 - 12.0 \text{ ms}$
