import { vi } from 'vitest';

export interface InMemoryDb {
  users: Map<string, any>;
  workspaces: Map<string, any>;
  workspaceMembers: Map<string, any>;
  documents: Map<string, any>;
  searchIndex: any[];
  documentAccess: Map<string, any>;
  auditLogs: any[];
}

export function createMockPrisma() {
  const db: InMemoryDb = {
    users: new Map(),
    workspaces: new Map(),
    workspaceMembers: new Map(),
    documents: new Map(),
    searchIndex: [],
    documentAccess: new Map(),
    auditLogs: [],
  };

  const mockPrisma = {
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      return await cb(mockPrisma);
    }),

    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id) return db.users.get(where.id) || null;
        if (where.email) {
          for (const u of db.users.values()) {
            if (u.email === where.email) return u;
          }
        }
        return null;
      }),
      findMany: vi.fn(async ({ where }: { where: any }) => {
        const results = [];
        for (const u of db.users.values()) {
          if (where.id?.not && u.id === where.id.not) continue;
          if (where.email?.contains && !u.email.includes(where.email.contains)) continue;
          results.push(u);
        }
        return results;
      }),
      create: vi.fn(async ({ data }: { data: any }) => {
        const id = data.id || crypto.randomUUID();
        const record = {
          ...data,
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        db.users.set(id, record);
        return record;
      }),
    },

    workspace: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return db.workspaces.get(where.id) || null;
      }),
      create: vi.fn(async ({ data }: { data: any }) => {
        const id = data.id || crypto.randomUUID();
        const record = {
          ...data,
          id,
          createdAt: new Date(),
        };
        db.workspaces.set(id, record);
        return record;
      }),
    },

    workspaceMember: {
      findUnique: vi.fn(async ({ where }: { where: { workspaceId_userId?: { workspaceId: string; userId: string } } }) => {
        if (where.workspaceId_userId) {
          const key = `${where.workspaceId_userId.workspaceId}_${where.workspaceId_userId.userId}`;
          const m = db.workspaceMembers.get(key);
          if (!m) return null;
          const ws = db.workspaces.get(m.workspaceId);
          const u = db.users.get(m.userId);
          return { ...m, workspace: ws, user: u };
        }
        return null;
      }),
      findMany: vi.fn(async ({ where }: { where: { userId?: string; workspaceId?: string; revokedAt?: null } }) => {
        const results = [];
        for (const m of db.workspaceMembers.values()) {
          if (where.userId && m.userId !== where.userId) continue;
          if (where.workspaceId && m.workspaceId !== where.workspaceId) continue;
          if (where.revokedAt === null && m.revokedAt !== null) continue;
          const ws = db.workspaces.get(m.workspaceId);
          const u = db.users.get(m.userId);
          results.push({ ...m, workspace: ws, user: u });
        }
        return results;
      }),
      create: vi.fn(async ({ data }: { data: any }) => {
        const id = data.id || crypto.randomUUID();
        const key = `${data.workspaceId}_${data.userId}`;
        const record = {
          ...data,
          id,
          joinedAt: new Date(),
          revokedAt: null,
        };
        db.workspaceMembers.set(key, record);
        return record;
      }),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const key = `${where.workspaceId_userId.workspaceId}_${where.workspaceId_userId.userId}`;
        const existing = db.workspaceMembers.get(key);
        if (existing) {
          const updated = { ...existing, ...update };
          db.workspaceMembers.set(key, updated);
          return updated;
        } else {
          const id = crypto.randomUUID();
          const created = { ...create, id, joinedAt: new Date(), revokedAt: null };
          db.workspaceMembers.set(key, created);
          return created;
        }
      }),
    },

    document: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return db.documents.get(where.id) || null;
      }),
      findMany: vi.fn(async ({ where }: { where: any }) => {
        const results = [];
        for (const doc of db.documents.values()) {
          if (where.workspaceId && doc.workspaceId !== where.workspaceId) continue;
          if (where.deletedAt === null && doc.deletedAt !== null) continue;
          if (where.id?.in && !where.id.in.includes(doc.id)) continue;

          // Check accessList filter
          if (where.accessList?.some) {
            const userId = where.accessList.some.userId;
            const accessKey = `${doc.id}_${userId}`;
            const access = db.documentAccess.get(accessKey);
            if (!access || access.revokedAt !== null) continue;
          }

          // Attach user accessList if requested
          let accessList: any[] = [];
          if (where.accessList?.where) {
            const userId = where.accessList.where.userId;
            const accessKey = `${doc.id}_${userId}`;
            const access = db.documentAccess.get(accessKey);
            if (access && access.revokedAt === null) {
              accessList.push(access);
            }
          }

          results.push({ ...doc, accessList });
        }
        return results;
      }),
      create: vi.fn(async ({ data }: { data: any }) => {
        const id = data.id || crypto.randomUUID();
        const record = {
          ...data,
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };
        db.documents.set(id, record);
        return record;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        const doc = db.documents.get(where.id);
        if (doc) {
          const updated = { ...doc, ...data };
          db.documents.set(where.id, updated);
          return updated;
        }
        return null;
      }),
    },

    searchIndex: {
      createMany: vi.fn(async ({ data }: { data: any[] }) => {
        for (const item of data) {
          const id = crypto.randomUUID();
          db.searchIndex.push({ ...item, id, createdAt: new Date() });
        }
        return { count: data.length };
      }),
      deleteMany: vi.fn(async ({ where }: { where: { documentId: string } }) => {
        db.searchIndex = db.searchIndex.filter((item) => item.documentId !== where.documentId);
        return { count: 1 };
      }),
      groupBy: vi.fn(async ({ by, where, having }: any) => {
        const matchedDocMap = new Map<string, Set<string>>();

        for (const item of db.searchIndex) {
          if (item.workspaceId !== where.workspaceId) continue;

          // Check token match
          const tokenMatches = where.searchToken.in.some((tb: Buffer) =>
            tb.equals(item.searchToken)
          );
          if (!tokenMatches) continue;

          // Check document is not deleted and user has access
          const doc = db.documents.get(item.documentId);
          if (!doc || doc.deletedAt !== null) continue;

          const userId = where.document?.accessList?.some?.userId;
          if (userId) {
            const accessKey = `${item.documentId}_${userId}`;
            const access = db.documentAccess.get(accessKey);
            if (!access || access.revokedAt !== null) continue;
          }

          if (!matchedDocMap.has(item.documentId)) {
            matchedDocMap.set(item.documentId, new Set());
          }
          matchedDocMap.get(item.documentId)!.add(item.searchToken.toString('hex'));
        }

        const rows: any[] = [];
        for (const [docId, tokenSet] of matchedDocMap.entries()) {
          if (having?.searchToken?._count?.equals) {
            if (tokenSet.size === having.searchToken._count.equals) {
              rows.push({ documentId: docId });
            }
          } else {
            rows.push({ documentId: docId });
          }
        }
        return rows;
      }),
    },

    documentAccess: {
      findFirst: vi.fn(async ({ where }: { where: any }) => {
        for (const a of db.documentAccess.values()) {
          if (where.documentId && a.documentId !== where.documentId) continue;
          if (where.userId && a.userId !== where.userId) continue;
          if (where.permission && a.permission !== where.permission) continue;
          if (where.revokedAt === null && a.revokedAt !== null) continue;

          const doc = db.documents.get(a.documentId);
          if (where.document?.deletedAt === null && doc?.deletedAt !== null) continue;

          return { ...a, document: doc };
        }
        return null;
      }),
      findUnique: vi.fn(async ({ where }: { where: { documentId_userId: { documentId: string; userId: string } } }) => {
        const key = `${where.documentId_userId.documentId}_${where.documentId_userId.userId}`;
        return db.documentAccess.get(key) || null;
      }),
      findMany: vi.fn(async ({ where }: { where: any }) => {
        const results = [];
        for (const a of db.documentAccess.values()) {
          if (where.documentId && a.documentId !== where.documentId) continue;
          if (where.userId && a.userId !== where.userId) continue;
          if (where.grantedBy?.not && a.grantedBy === where.grantedBy.not) continue;
          if (where.revokedAt === null && a.revokedAt !== null) continue;

          const doc = db.documents.get(a.documentId);
          if (where.document?.deletedAt === null && doc?.deletedAt !== null) continue;

          const user = db.users.get(a.userId);
          const granter = db.users.get(a.grantedBy);

          results.push({ ...a, document: doc, user, granter });
        }
        return results;
      }),
      create: vi.fn(async ({ data }: { data: any }) => {
        const id = data.id || crypto.randomUUID();
        const key = `${data.documentId}_${data.userId}`;
        const record = {
          ...data,
          id,
          createdAt: new Date(),
          revokedAt: null,
        };
        db.documentAccess.set(key, record);
        return record;
      }),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const key = `${where.documentId_userId.documentId}_${where.documentId_userId.userId}`;
        const existing = db.documentAccess.get(key);
        if (existing) {
          const updated = { ...existing, ...update };
          db.documentAccess.set(key, updated);
          return updated;
        } else {
          const id = crypto.randomUUID();
          const created = { ...create, id, createdAt: new Date(), revokedAt: null };
          db.documentAccess.set(key, created);
          return created;
        }
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const key = `${where.documentId_userId.documentId}_${where.documentId_userId.userId}`;
        const existing = db.documentAccess.get(key);
        if (existing) {
          const updated = { ...existing, ...data };
          db.documentAccess.set(key, updated);
          return updated;
        }
        return null;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        for (const [key, a] of db.documentAccess.entries()) {
          if (where.documentId && a.documentId === where.documentId) {
            db.documentAccess.set(key, { ...a, ...data });
          }
        }
        return { count: 1 };
      }),
    },

    auditLog: {
      create: vi.fn(async ({ data }: { data: any }) => {
        const id = crypto.randomUUID();
        const record = { ...data, id, createdAt: new Date() };
        db.auditLogs.push(record);
        return record;
      }),
      findMany: vi.fn(async ({ where }: { where: { actorId: string } }) => {
        return db.auditLogs.filter((a) => a.actorId === where.actorId);
      }),
    },
  };

  return { mockPrisma, db };
}
