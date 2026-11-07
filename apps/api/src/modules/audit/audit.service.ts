import { prisma } from '../../config/prisma.js';

export async function logAuditEvent(
  actorId: string,
  action: string,
  details: Record<string, unknown> = {},
  workspaceId?: string,
  documentId?: string
): Promise<void> {
  try {
    // Ensure no passwords, tokens, or plaintext are ever stored in audit logs
    const sanitizedDetails: Record<string, unknown> = { ...details };
    delete sanitizedDetails.password;
    delete sanitizedDetails.token;
    delete sanitizedDetails.tokens;
    delete sanitizedDetails.key;
    delete sanitizedDetails.searchTokens;
    delete sanitizedDetails.plaintext;

    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        workspaceId: workspaceId || null,
        documentId: documentId || null,
        details: sanitizedDetails as any,
      },
    });
  } catch (err) {
    // Non-blocking error for audit logs
    console.warn('[Audit Log Warning]:', (err as Error).message);
  }
}
