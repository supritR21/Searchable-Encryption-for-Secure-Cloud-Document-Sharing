import { prisma } from '../../config/prisma.js';
import { ShareDocumentInput } from '@ciphershare/shared';
import { ForbiddenError, NotFoundError } from '../../utils/errors.js';
import { logAuditEvent } from '../audit/audit.service.js';

export async function shareDocument(
  documentId: string,
  callerUserId: string,
  input: ShareDocumentInput
) {
  // 1. Verify caller has OWNER access to document
  const callerAccess = await prisma.documentAccess.findFirst({
    where: {
      documentId,
      userId: callerUserId,
      permission: 'OWNER',
      revokedAt: null,
    },
    include: {
      document: true,
    },
  });

  if (!callerAccess) {
    throw new ForbiddenError('Only document owners can share documents');
  }

  // 2. Verify recipient user exists
  const recipient = await prisma.user.findUnique({
    where: { id: input.recipientUserId },
  });

  if (!recipient) {
    throw new NotFoundError('Recipient user not found');
  }

  // 3. Verify recipient is a member of the workspace
  const recipientMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: callerAccess.document.workspaceId,
        userId: input.recipientUserId,
      },
    },
  });

  if (!recipientMembership || recipientMembership.revokedAt) {
    throw new ForbiddenError('Recipient must be an active member of this workspace');
  }

  // 4. Upsert document access record with encrypted DEK envelope
  const access = await prisma.documentAccess.upsert({
    where: {
      documentId_userId: {
        documentId,
        userId: input.recipientUserId,
      },
    },
    update: {
      encryptedDek: Buffer.from(input.encryptedDek, 'base64'),
      permission: input.permission || 'READ',
      grantedBy: callerUserId,
      revokedAt: null,
      createdAt: new Date(),
    },
    create: {
      documentId,
      userId: input.recipientUserId,
      encryptedDek: Buffer.from(input.encryptedDek, 'base64'),
      permission: input.permission || 'READ',
      grantedBy: callerUserId,
    },
  });

  await logAuditEvent(
    callerUserId,
    'DOCUMENT_SHARED',
    { recipientUserId: input.recipientUserId, permission: input.permission },
    callerAccess.document.workspaceId,
    documentId
  );

  return {
    id: access.id,
    documentId: access.documentId,
    userId: access.userId,
    permission: access.permission,
    createdAt: access.createdAt.toISOString(),
  };
}

export async function revokeDocumentAccess(
  documentId: string,
  callerUserId: string,
  recipientUserId: string
) {
  // Verify caller is owner
  const callerAccess = await prisma.documentAccess.findFirst({
    where: {
      documentId,
      userId: callerUserId,
      permission: 'OWNER',
      revokedAt: null,
    },
    include: {
      document: true,
    },
  });

  if (!callerAccess) {
    throw new ForbiddenError('Only document owners can revoke access');
  }

  if (callerUserId === recipientUserId) {
    throw new ForbiddenError('Document owners cannot revoke their own access');
  }

  const access = await prisma.documentAccess.findUnique({
    where: {
      documentId_userId: {
        documentId,
        userId: recipientUserId,
      },
    },
  });

  if (!access) {
    throw new NotFoundError('Access record not found');
  }

  // Revoke access
  await prisma.documentAccess.update({
    where: {
      documentId_userId: {
        documentId,
        userId: recipientUserId,
      },
    },
    data: {
      revokedAt: new Date(),
    },
  });

  await logAuditEvent(
    callerUserId,
    'DOCUMENT_ACCESS_REVOKED',
    { revokedUserId: recipientUserId },
    callerAccess.document.workspaceId,
    documentId
  );

  return { success: true };
}

export async function listDocumentAccess(documentId: string, callerUserId: string) {
  // Verify caller has active access
  const callerAccess = await prisma.documentAccess.findFirst({
    where: {
      documentId,
      userId: callerUserId,
      revokedAt: null,
    },
  });

  if (!callerAccess) {
    throw new ForbiddenError('You do not have access to this document');
  }

  const accessList = await prisma.documentAccess.findMany({
    where: {
      documentId,
      revokedAt: null,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          publicKeySpki: true,
        },
      },
    },
  });

  return accessList.map((a) => ({
    id: a.id,
    documentId: a.documentId,
    userId: a.userId,
    permission: a.permission,
    grantedBy: a.grantedBy,
    createdAt: a.createdAt.toISOString(),
    user: {
      id: a.user.id,
      email: a.user.email,
      publicKeySpki: a.user.publicKeySpki.toString('base64'),
    },
  }));
}

export async function listSharedWithMe(userId: string) {
  const sharedDocs = await prisma.documentAccess.findMany({
    where: {
      userId,
      revokedAt: null,
      grantedBy: {
        not: userId, // Only documents shared by someone else
      },
      document: {
        deletedAt: null,
      },
    },
    include: {
      document: true,
      granter: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return sharedDocs.map((entry) => ({
    id: entry.document.id,
    workspaceId: entry.document.workspaceId,
    ownerId: entry.document.ownerId,
    encryptedMetadata: entry.document.encryptedMetadata.toString('base64'),
    metadataNonce: entry.document.metadataNonce.toString('base64'),
    fileNonce: entry.document.fileNonce.toString('base64'),
    cryptoVersion: entry.document.cryptoVersion,
    keyVersion: entry.document.keyVersion,
    createdAt: entry.document.createdAt.toISOString(),
    permission: entry.permission,
    wrappedDek: entry.encryptedDek.toString('base64'),
    sharedBy: entry.granter,
  }));
}
