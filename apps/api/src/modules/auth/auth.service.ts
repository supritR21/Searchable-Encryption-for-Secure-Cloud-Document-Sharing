import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma.js';
import { ENV } from '../../config/env.js';
import { RegisterInput, LoginInput } from '@ciphershare/shared';
import { ConflictError, UnauthorizedError, NotFoundError } from '../../utils/errors.js';
import { logAuditEvent } from '../audit/audit.service.js';
import { argon2id, argon2Verify } from 'hash-wasm';

export async function hashPassword(password: string): Promise<string> {
  // Use Argon2id with 16-byte random salt and 3 iterations, 64MB memory
  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);

  return await argon2id({
    password,
    salt,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    parallelism: 1,
    outputType: 'encoded', // standard $argon2id$v=19$... PHC string
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return await argon2Verify({
    password,
    hash,
  });
}

export function generateToken(user: { id: string; email: string }): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    ENV.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (existing) {
    throw new ConflictError('A user with this email address already exists');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash,
      publicKeySpki: Buffer.from(input.publicKeySpki, 'base64'),
      encryptedPrivateKey: Buffer.from(input.encryptedPrivateKey, 'base64'),
      privateKeySalt: Buffer.from(input.privateKeySalt, 'base64'),
      privateKeyNonce: Buffer.from(input.privateKeyNonce, 'base64'),
      privateKeyKdfParams: input.privateKeyKdfParams as any,
      publicKeyAlgorithm: input.publicKeyAlgorithm || 'RSA-OAEP-3072',
    },
  });

  await logAuditEvent(user.id, 'USER_REGISTERED', { email: user.email });

  const token = generateToken(user);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      publicKeySpki: user.publicKeySpki.toString('base64'),
      publicKeyAlgorithm: user.publicKeyAlgorithm,
      createdAt: user.createdAt.toISOString(),
    },
  };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isValid = await verifyPassword(user.passwordHash, input.password);
  if (!isValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = generateToken(user);
  await logAuditEvent(user.id, 'USER_LOGGED_IN', { email: user.email });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      publicKeySpki: user.publicKeySpki.toString('base64'),
      encryptedPrivateKey: user.encryptedPrivateKey.toString('base64'),
      privateKeySalt: user.privateKeySalt.toString('base64'),
      privateKeyNonce: user.privateKeyNonce.toString('base64'),
      privateKeyKdfParams: user.privateKeyKdfParams,
      publicKeyAlgorithm: user.publicKeyAlgorithm,
      createdAt: user.createdAt.toISOString(),
    },
  };
}

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    id: user.id,
    email: user.email,
    publicKeySpki: user.publicKeySpki.toString('base64'),
    encryptedPrivateKey: user.encryptedPrivateKey.toString('base64'),
    privateKeySalt: user.privateKeySalt.toString('base64'),
    privateKeyNonce: user.privateKeyNonce.toString('base64'),
    privateKeyKdfParams: user.privateKeyKdfParams,
    publicKeyAlgorithm: user.publicKeyAlgorithm,
    createdAt: user.createdAt.toISOString(),
  };
}
