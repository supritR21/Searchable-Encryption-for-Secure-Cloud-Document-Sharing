import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    publicKeySpki: z.ZodString;
    encryptedPrivateKey: z.ZodString;
    privateKeySalt: z.ZodString;
    privateKeyNonce: z.ZodString;
    privateKeyKdfParams: z.ZodObject<{
        timeCost: z.ZodNumber;
        memoryCost: z.ZodNumber;
        parallelism: z.ZodNumber;
        hashLength: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        timeCost: number;
        memoryCost: number;
        parallelism: number;
        hashLength: number;
    }, {
        timeCost: number;
        memoryCost: number;
        parallelism: number;
        hashLength: number;
    }>;
    publicKeyAlgorithm: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    publicKeySpki: string;
    encryptedPrivateKey: string;
    privateKeySalt: string;
    privateKeyNonce: string;
    privateKeyKdfParams: {
        timeCost: number;
        memoryCost: number;
        parallelism: number;
        hashLength: number;
    };
    publicKeyAlgorithm: string;
}, {
    email: string;
    password: string;
    publicKeySpki: string;
    encryptedPrivateKey: string;
    privateKeySalt: string;
    privateKeyNonce: string;
    privateKeyKdfParams: {
        timeCost: number;
        memoryCost: number;
        parallelism: number;
        hashLength: number;
    };
    publicKeyAlgorithm?: string | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const createWorkspaceSchema: z.ZodObject<{
    encryptedName: z.ZodString;
    nameNonce: z.ZodString;
    wrappedSearchKey: z.ZodString;
    keyVersion: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    encryptedName: string;
    nameNonce: string;
    wrappedSearchKey: string;
    keyVersion: number;
}, {
    encryptedName: string;
    nameNonce: string;
    wrappedSearchKey: string;
    keyVersion?: number | undefined;
}>;
export declare const addWorkspaceMemberSchema: z.ZodObject<{
    userId: z.ZodString;
    wrappedSearchKey: z.ZodString;
    keyVersion: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    wrappedSearchKey: string;
    keyVersion: number;
    userId: string;
}, {
    wrappedSearchKey: string;
    userId: string;
    keyVersion?: number | undefined;
}>;
export declare const uploadDocumentSchema: z.ZodObject<{
    documentId: z.ZodOptional<z.ZodString>;
    workspaceId: z.ZodString;
    encryptedMetadata: z.ZodString;
    fileNonce: z.ZodString;
    metadataNonce: z.ZodString;
    wrappedDek: z.ZodString;
    cryptoVersion: z.ZodDefault<z.ZodNumber>;
    keyVersion: z.ZodDefault<z.ZodNumber>;
    searchTokens: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    keyVersion: number;
    workspaceId: string;
    encryptedMetadata: string;
    fileNonce: string;
    metadataNonce: string;
    wrappedDek: string;
    cryptoVersion: number;
    searchTokens: string[];
    documentId?: string | undefined;
}, {
    workspaceId: string;
    encryptedMetadata: string;
    fileNonce: string;
    metadataNonce: string;
    wrappedDek: string;
    searchTokens: string[];
    keyVersion?: number | undefined;
    documentId?: string | undefined;
    cryptoVersion?: number | undefined;
}>;
export declare const searchSchema: z.ZodObject<{
    tokens: z.ZodArray<z.ZodString, "many">;
    mode: z.ZodDefault<z.ZodEnum<["AND", "SINGLE"]>>;
    limit: z.ZodDefault<z.ZodNumber>;
    cursor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    tokens: string[];
    mode: "AND" | "SINGLE";
    limit: number;
    cursor?: string | null | undefined;
}, {
    tokens: string[];
    mode?: "AND" | "SINGLE" | undefined;
    limit?: number | undefined;
    cursor?: string | null | undefined;
}>;
export declare const shareDocumentSchema: z.ZodObject<{
    recipientUserId: z.ZodString;
    encryptedDek: z.ZodString;
    permission: z.ZodDefault<z.ZodEnum<["READ", "OWNER"]>>;
}, "strip", z.ZodTypeAny, {
    recipientUserId: string;
    encryptedDek: string;
    permission: "OWNER" | "READ";
}, {
    recipientUserId: string;
    encryptedDek: string;
    permission?: "OWNER" | "READ" | undefined;
}>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type ShareDocumentInput = z.infer<typeof shareDocumentSchema>;
