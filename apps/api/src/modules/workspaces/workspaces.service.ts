import { prisma } from '../../config/prisma.js';
import { CreateWorkspaceInput, AddWorkspaceMemberInput } from '@ciphershare/shared';
import { ForbiddenError, NotFoundError, ConflictError } from '../../utils/errors.js';
import { logAuditEvent } from '../audit/audit.service.js';

export async function createWorkspace(userId: string, input: CreateWorkspaceInput) {
  const result = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: {
        ownerId: userId,
        encryptedName: Buffer.from(input.encryptedName, 'base64'),
        nameNonce: Buffer.from(input.nameNonce, 'base64'),
        keyVersion: input.keyVersion ?? 1,
      },
    });

    const member = await tx.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId,
        role: 'OWNER',
        wrappedSearchKey: Buffer.from(input.wrappedSearchKey, 'base64'),
        keyVersion: ws.keyVersion,
      },
    });

    return { ws, member };
  });

  await logAuditEvent(userId, 'WORKSPACE_CREATED', {}, result.ws.id);

  return {
    id: result.ws.id,
    ownerId: result.ws.ownerId,
    encryptedName: result.ws.encryptedName.toString('base64'),
    nameNonce: result.ws.nameNonce.toString('base64'),
    keyVersion: result.ws.keyVersion,
    role: result.member.role,
    wrappedSearchKey: result.member.wrappedSearchKey.toString('base64'),
    createdAt: result.ws.createdAt.toISOString(),
  };
}

export async function listUserWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: {
      userId,
      revokedAt: null,
    },
    include: {
      workspace: true,
    },
    orderBy: {
      joinedAt: 'desc',
    },
  });

  return memberships.map((m) => ({
    id: m.workspace.id,
    ownerId: m.workspace.ownerId,
    encryptedName: m.workspace.encryptedName.toString('base64'),
    nameNonce: m.workspace.nameNonce.toString('base64'),
    keyVersion: m.workspace.keyVersion,
    role: m.role,
    wrappedSearchKey: m.wrappedSearchKey.toString('base64'),
    createdAt: m.workspace.createdAt.toISOString(),
  }));
}

export async function getWorkspaceById(workspaceId: string, userId: string) {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    include: {
      workspace: true,
    },
  });

  if (!membership || membership.revokedAt) {
    throw new ForbiddenError('You are not an active member of this workspace');
  }

  return {
    id: membership.workspace.id,
    ownerId: membership.workspace.ownerId,
    encryptedName: membership.workspace.encryptedName.toString('base64'),
    nameNonce: membership.workspace.nameNonce.toString('base64'),
    keyVersion: membership.workspace.keyVersion,
    role: membership.role,
    wrappedSearchKey: membership.wrappedSearchKey.toString('base64'),
    createdAt: membership.workspace.createdAt.toISOString(),
  };
}

export async function addMemberToWorkspace(
  workspaceId: string,
  ownerId: string,
  input: AddWorkspaceMemberInput
) {
  // Check caller role
  const callerMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: ownerId,
      },
    },
  });

  if (!callerMember || callerMember.role !== 'OWNER' || callerMember.revokedAt) {
    throw new ForbiddenError('Only workspace owners can add new members');
  }

  // Check if target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: input.userId },
  });

  if (!targetUser) {
    throw new NotFoundError('Target user does not exist');
  }

  const existingMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: input.userId,
      },
    },
  });

  if (existingMember && !existingMember.revokedAt) {
    throw new ConflictError('User is already an active member of this workspace');
  }

  const member = await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: input.userId,
      },
    },
    update: {
      wrappedSearchKey: Buffer.from(input.wrappedSearchKey, 'base64'),
      keyVersion: input.keyVersion ?? 1,
      revokedAt: null,
      joinedAt: new Date(),
    },
    create: {
      workspaceId,
      userId: input.userId,
      role: 'MEMBER',
      wrappedSearchKey: Buffer.from(input.wrappedSearchKey, 'base64'),
      keyVersion: input.keyVersion ?? 1,
    },
  });

  await logAuditEvent(
    ownerId,
    'WORKSPACE_MEMBER_ADDED',
    { targetUserId: input.userId },
    workspaceId
  );

  return {
    id: member.id,
    workspaceId: member.workspaceId,
    userId: member.userId,
    role: member.role,
    keyVersion: member.keyVersion,
    joinedAt: member.joinedAt.toISOString(),
  };
}

export async function listWorkspaceMembers(workspaceId: string, userId: string) {
  // Verify membership
  const callerMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (!callerMember || callerMember.revokedAt) {
    throw new ForbiddenError('You are not an active member of this workspace');
  }

  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      revokedAt: null,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          publicKeySpki: true,
          publicKeyAlgorithm: true,
        },
      },
    },
  });

  return members.map((m) => ({
    id: m.id,
    workspaceId: m.workspaceId,
    userId: m.userId,
    role: m.role,
    keyVersion: m.keyVersion,
    joinedAt: m.joinedAt.toISOString(),
    user: {
      id: m.user.id,
      email: m.user.email,
      publicKeySpki: m.user.publicKeySpki.toString('base64'),
      publicKeyAlgorithm: m.user.publicKeyAlgorithm,
    },
  }));
}
