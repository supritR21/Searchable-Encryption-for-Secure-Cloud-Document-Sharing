export type UserRole = 'OWNER' | 'MEMBER';
export type DocumentPermission = 'READ' | 'OWNER';

export interface Argon2idParams {
  timeCost: number;
  memoryCost: number;
  parallelism: number;
  hashLength: number;
}

export interface UserSummary {
  id: string;
  email: string;
  publicKeySpki: string; // Base64 encoded
  publicKeyAlgorithm: string;
  createdAt: string;
}

export interface UserProfile extends UserSummary {
  encryptedPrivateKey: string; // Base64 encoded
  privateKeySalt: string;      // Base64 encoded
  privateKeyNonce: string;     // Base64 encoded
  privateKeyKdfParams: Argon2idParams;
}

export interface WorkspaceSummary {
  id: string;
  ownerId: string;
  encryptedName: string; // Base64 encoded
  nameNonce: string;     // Base64 encoded
  keyVersion: number;
  createdAt: string;
  role?: UserRole;
  wrappedSearchKey?: string; // Base64 encoded (for the authenticated user)
}

export interface WorkspaceMemberInfo {
  id: string;
  workspaceId: string;
  userId: string;
  role: UserRole;
  wrappedSearchKey: string; // Base64 encoded
  keyVersion: number;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    publicKeySpki: string;
  };
}

export interface DocumentMetadata {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
}

export interface DocumentSummary {
  id: string;
  workspaceId: string;
  ownerId: string;
  encryptedMetadata: string; // Base64 encoded
  metadataNonce: string;     // Base64 encoded
  fileNonce: string;         // Base64 encoded
  cryptoVersion: number;
  keyVersion: number;
  createdAt: string;
  permission?: DocumentPermission;
  wrappedDek?: string;       // Base64 encoded
}

export interface DocumentDetail extends DocumentSummary {
  encryptedFile?: string;    // Base64 encoded (when retrieving content)
  fileNonce: string;         // Base64 encoded
}

export interface SearchResultItem {
  id: string;
  workspaceId: string;
  ownerId: string;
  encryptedMetadata: string;
  metadataNonce: string;
  cryptoVersion: number;
  keyVersion: number;
  createdAt: string;
  permission: DocumentPermission;
  wrappedDek: string;
}

export interface SearchQueryRequest {
  tokens: string[]; // Base64URL encoded HMAC-SHA-256 tokens
  mode: 'AND' | 'SINGLE';
  limit?: number;
  cursor?: string | null;
}

export interface SearchQueryResponse {
  documents: SearchResultItem[];
  totalMatches: number;
  searchDurationMs: number;
}

export interface ShareDocumentRequest {
  recipientUserId: string;
  encryptedDek: string; // Base64 encoded DEK wrapped with recipient's RSA-OAEP public key
  permission: DocumentPermission;
}

export interface AccessEntryInfo {
  id: string;
  documentId: string;
  userId: string;
  encryptedDek: string;
  permission: DocumentPermission;
  grantedBy: string;
  createdAt: string;
  revokedAt: string | null;
  user: {
    id: string;
    email: string;
    publicKeySpki: string;
  };
}

export interface AuditLogItem {
  id: string;
  actorId: string;
  action: string;
  documentId: string | null;
  workspaceId: string | null;
  createdAt: string;
  details: Record<string, unknown>;
}
