import { prisma } from '../../config/prisma.js';
import { SearchInput, base64UrlToUint8Array, SearchResultItem } from '@ciphershare/shared';
import { ForbiddenError } from '../../utils/errors.js';
import { logAuditEvent } from '../audit/audit.service.js';

export async function searchDocuments(
  workspaceId: string,
  userId: string,
  input: SearchInput
): Promise<{ documents: SearchResultItem[]; totalMatches: number; searchDurationMs: number }> {
  const startTime = performance.now();

  // 1. Verify caller is an active workspace member
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

  // Deduplicate query tokens
  const uniqueTokensBase64Url = Array.from(new Set(input.tokens));
  const tokenBuffers = uniqueTokensBase64Url.map((t) => Buffer.from(base64UrlToUint8Array(t)));
  const requiredTokenCount = uniqueTokensBase64Url.length;

  // 2. Query search index with authorization join
  // For AND mode, require COUNT(DISTINCT si.search_token) = requiredTokenCount
  // For SINGLE mode, require COUNT(DISTINCT si.search_token) >= 1
  let matchingDocIds: string[] = [];

  if (input.mode === 'AND') {
    const rows = await prisma.searchIndex.groupBy({
      by: ['documentId'],
      where: {
        workspaceId,
        searchToken: { in: tokenBuffers },
        document: {
          deletedAt: null,
          accessList: {
            some: {
              userId,
              revokedAt: null,
            },
          },
        },
      },
      _count: {
        searchToken: true,
      },
      having: {
        searchToken: {
          _count: {
            equals: requiredTokenCount,
          },
        },
      },
      orderBy: {
        documentId: 'asc',
      },
      take: input.limit ?? 20,
    });
    matchingDocIds = rows.map((r) => r.documentId);
  } else {
    const rows = await prisma.searchIndex.groupBy({
      by: ['documentId'],
      where: {
        workspaceId,
        searchToken: { in: tokenBuffers },
        document: {
          deletedAt: null,
          accessList: {
            some: {
              userId,
              revokedAt: null,
            },
          },
        },
      },
      orderBy: {
        documentId: 'asc',
      },
      take: input.limit ?? 20,
    });
    matchingDocIds = rows.map((r) => r.documentId);
  }

  // 3. Retrieve document metadata and envelopes for matching IDs
  const matchedDocs = await prisma.document.findMany({
    where: {
      id: { in: matchingDocIds },
      deletedAt: null,
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
  });

  const durationMs = performance.now() - startTime;

  // Log audit event without logging the search tokens
  await logAuditEvent(
    userId,
    'DOCUMENT_SEARCH_EXECUTED',
    { mode: input.mode, resultCount: matchedDocs.length, durationMs },
    workspaceId
  );

  const results: SearchResultItem[] = matchedDocs.map((doc) => {
    const access = doc.accessList[0];
    return {
      id: doc.id,
      workspaceId: doc.workspaceId,
      ownerId: doc.ownerId,
      encryptedMetadata: doc.encryptedMetadata.toString('base64'),
      metadataNonce: doc.metadataNonce.toString('base64'),
      cryptoVersion: doc.cryptoVersion,
      keyVersion: doc.keyVersion,
      createdAt: doc.createdAt.toISOString(),
      permission: access?.permission || 'READ',
      wrappedDek: access ? access.encryptedDek.toString('base64') : '',
    };
  });

  return {
    documents: results,
    totalMatches: results.length,
    searchDurationMs: Math.round(durationMs * 100) / 100,
  };
}
