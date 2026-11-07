import { prisma } from '../../config/prisma.js';
import { NotFoundError } from '../../utils/errors.js';

export async function searchUsersByEmail(emailQuery: string, currentUserId: string) {
  if (!emailQuery || emailQuery.trim().length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      email: {
        contains: emailQuery.toLowerCase(),
      },
      id: {
        not: currentUserId,
      },
    },
    select: {
      id: true,
      email: true,
      publicKeySpki: true,
      publicKeyAlgorithm: true,
      createdAt: true,
    },
    take: 10,
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    publicKeySpki: u.publicKeySpki.toString('base64'),
    publicKeyAlgorithm: u.publicKeyAlgorithm,
    createdAt: u.createdAt.toISOString(),
  }));
}

export async function getUserPublicKey(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      publicKeySpki: true,
      publicKeyAlgorithm: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    id: user.id,
    email: user.email,
    publicKeySpki: user.publicKeySpki.toString('base64'),
    publicKeyAlgorithm: user.publicKeyAlgorithm,
  };
}
