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
    publicKeySpki: string;
    publicKeyAlgorithm: string;
    createdAt: string;
}
export interface UserProfile extends UserSummary {
    encryptedPrivateKey: string;
    privateKeySalt: string;
    privateKeyNonce: string;
    privateKeyKdfParams: Argon2idParams;
}
export interface WorkspaceSummary {
    id: string;
    ownerId: string;
    encryptedName: string;
    nameNonce: string;
    keyVersion: number;
    createdAt: string;
    role?: UserRole;
    wrappedSearchKey?: string;
}
export interface WorkspaceMemberInfo {
    id: string;
    workspaceId: string;
    userId: string;
    role: UserRole;
    wrappedSearchKey: string;
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
    encryptedMetadata: string;
    metadataNonce: string;
    fileNonce: string;
    cryptoVersion: number;
    keyVersion: number;
    createdAt: string;
    permission?: DocumentPermission;
    wrappedDek?: string;
}
export interface DocumentDetail extends DocumentSummary {
    encryptedFile?: string;
    fileNonce: string;
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
    tokens: string[];
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
    encryptedDek: string;
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
