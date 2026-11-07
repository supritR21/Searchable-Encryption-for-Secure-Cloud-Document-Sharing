import { prisma } from '../../config/prisma.js';
import { CRYPTO_CONSTANTS, base64UrlToUint8Array } from '@ciphershare/shared';
import { ForbiddenError, NotFoundError, BadRequestError } from '../../utils/errors.js';
import { logAuditEvent } from '../audit/audit.service.js';

export interface UploadDocumentParams {
  documentId?: string;
  workspaceId: string;
  userId: string;
  fileBuffer: Buffer;
  encryptedMetadata: string;
  fileNonce: string;
  metadataNonce: string;
  wrappedDek: string;
  cryptoVersion?: number;
  keyVersion?: number;
  searchTokens: string[]; // Base64URL encoded
}

export async function uploadDocument(params: UploadDocumentParams) {
  const {
    documentId,
    workspaceId,
    userId,
    fileBuffer,
    encryptedMetadata,
    fileNonce,
    metadataNonce,
    wrappedDek,
    cryptoVersion = 1,
    keyVersion = 1,
    searchTokens,
  } = params;

  // 1. Verify caller workspace membership
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (!member || member.revokedAt) {
    throw new ForbiddenError('You are not an active member of this workspace');
  }

  // 2. Validate file size (10 MB limit)
  if (fileBuffer.byteLength > CRYPTO_CONSTANTS.LIMITS.MAX_UPLOAD_SIZE_BYTES) {
    throw new BadRequestError(`File exceeds maximum upload limit of 10 MB`);
  }

  // 3. Insert document, access record, and search index atomically
  const result = await prisma.$transaction(async (tx) => {
    // A. Create document row
    const doc = await tx.document.create({
      data: {
        id: documentId || undefined,
        workspaceId,
        ownerId: userId,
        encryptedFile: fileBuffer,
        fileNonce: Buffer.from(fileNonce, 'base64'),
        encryptedMetadata: Buffer.from(encryptedMetadata, 'base64'),
        metadataNonce: Buffer.from(metadataNonce, 'base64'),
        cryptoVersion,
        keyVersion,
      },
    });

    // B. Create OWNER access entry with wrapped DEK
    await tx.documentAccess.create({
      data: {
        documentId: doc.id,
        userId,
        encryptedDek: Buffer.from(wrappedDek, 'base64'),
        permission: 'OWNER',
        grantedBy: userId,
      },
    });

    // C. Insert inverted index tokens
    if (searchTokens && searchTokens.length > 0) {
      const indexEntries = searchTokens.map((tokenBase64Url) => {
        const rawTokenBytes = base64UrlToUint8Array(tokenBase64Url);
        return {
          workspaceId,
          documentId: doc.id,
          searchToken: Buffer.from(rawTokenBytes),
          keyVersion,
        };
      });

      // Insert search index tokens
      await tx.searchIndex.createMany({
        data: indexEntries,
        skipDuplicates: true,
      });
    }

    return doc;
  });

  await logAuditEvent(
    userId,
    'DOCUMENT_UPLOADED',
    { tokenCount: searchTokens.length, sizeBytes: fileBuffer.byteLength },
    workspaceId,
    result.id
  );

  return {
    id: result.id,
    workspaceId: result.workspaceId,
    ownerId: result.ownerId,
    encryptedMetadata: result.encryptedMetadata.toString('base64'),
    metadataNonce: result.metadataNonce.toString('base64'),
    fileNonce: result.fileNonce.toString('base64'),
    cryptoVersion: result.cryptoVersion,
    keyVersion: result.keyVersion,
    createdAt: result.createdAt.toISOString(),
  };
}

export async function listWorkspaceDocuments(workspaceId: string, userId: string) {
  // Verify workspace membership
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (!member || member.revokedAt) {
    throw new ForbiddenError('You are not an active member of this workspace');
  }

  // Retrieve documents with active user access
  const documents = await prisma.document.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      accessList: {
        some: {
          userId,
          revokedAt: null,
        },
      },
    },
    include: {
      accessList: {
        where: {
          userId,
          revokedAt: null,
        },
        take: 1,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return documents.map((doc) => {
    const access = doc.accessList[0];
    return {
      id: doc.id,
      workspaceId: doc.workspaceId,
      ownerId: doc.ownerId,
      encryptedMetadata: doc.encryptedMetadata.toString('base64'),
      metadataNonce: doc.metadataNonce.toString('base64'),
      fileNonce: doc.fileNonce.toString('base64'),
      cryptoVersion: doc.cryptoVersion,
      keyVersion: doc.keyVersion,
      createdAt: doc.createdAt.toISOString(),
      permission: access?.permission,
      wrappedDek: access?.encryptedDek.toString('base64'),
    };
  });
}

export async function getDocumentById(documentId: string, userId: string) {
  const access = await prisma.documentAccess.findFirst({
    where: {
      documentId,
      userId,
      revokedAt: null,
      document: {
        deletedAt: null,
      },
    },
    include: {
      document: true,
    },
  });

  if (!access) {
    throw new NotFoundError('Document not found or access revoked');
  }

  return {
    id: access.document.id,
    workspaceId: access.document.workspaceId,
    ownerId: access.document.ownerId,
    encryptedMetadata: access.document.encryptedMetadata.toString('base64'),
    metadataNonce: access.document.metadataNonce.toString('base64'),
    fileNonce: access.document.fileNonce.toString('base64'),
    cryptoVersion: access.document.cryptoVersion,
    keyVersion: access.document.keyVersion,
    createdAt: access.document.createdAt.toISOString(),
    permission: access.permission,
    wrappedDek: access.encryptedDek.toString('base64'),
  };
}

export async function getDocumentContent(documentId: string, userId: string) {
  const access = await prisma.documentAccess.findFirst({
    where: {
      documentId,
      userId,
      revokedAt: null,
      document: {
        deletedAt: null,
      },
    },
    include: {
      document: {
        select: {
          id: true,
          encryptedFile: true,
          fileNonce: true,
          workspaceId: true,
        },
      },
    },
  });

  if (!access) {
    throw new NotFoundError('Document not found or access revoked');
  }

  await logAuditEvent(
    userId,
    'DOCUMENT_DOWNLOADED',
    {},
    access.document.workspaceId,
    access.document.id
  );

  return {
    fileBuffer: access.document.encryptedFile,
    fileNonce: access.document.fileNonce.toString('base64'),
  };
}

export async function deleteDocument(documentId: string, userId: string) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!doc || doc.deletedAt) {
    throw new NotFoundError('Document not found');
  }

  if (doc.ownerId !== userId) {
    throw new ForbiddenError('Only the document owner can delete this document');
  }

  await prisma.$transaction(async (tx) => {
    // Delete search tokens
    await tx.searchIndex.deleteMany({
      where: { documentId },
    });

    // Mark document deleted
    await tx.document.update({
      where: { id: documentId },
      data: {
        deletedAt: new Date(),
      },
    });

    // Revoke all access
    await tx.documentAccess.updateMany({
      where: { documentId },
      data: {
        revokedAt: new Date(),
      },
    });
  });

  await logAuditEvent(userId, 'DOCUMENT_DELETED', {}, doc.workspaceId, documentId);

  return { success: true };
}
