import { Request, Response, NextFunction } from 'express';
import { uploadDocumentSchema } from '@ciphershare/shared';
import * as documentsService from './documents.service.js';
import { BadRequestError } from '../../utils/errors.js';

export async function upload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      throw new BadRequestError('Encrypted file payload is required');
    }

    // In multipart/form-data, json arrays may arrive as JSON strings
    let searchTokens = req.body.searchTokens;
    if (typeof searchTokens === 'string') {
      try {
        searchTokens = JSON.parse(searchTokens);
      } catch {
        searchTokens = [searchTokens];
      }
    }

    const validated = uploadDocumentSchema.parse({
      ...req.body,
      workspaceId: req.params.workspaceId || req.body.workspaceId,
      searchTokens: searchTokens || [],
    });

    const result = await documentsService.uploadDocument({
      documentId: validated.documentId,
      workspaceId: validated.workspaceId,
      userId: req.user!.id,
      fileBuffer: req.file.buffer,
      encryptedMetadata: validated.encryptedMetadata,
      fileNonce: validated.fileNonce,
      metadataNonce: validated.metadataNonce,
      wrappedDek: validated.wrappedDek,
      cryptoVersion: validated.cryptoVersion,
      keyVersion: validated.keyVersion,
      searchTokens: validated.searchTokens,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const workspaceId = req.params.workspaceId;
    const result = await documentsService.listWorkspaceDocuments(workspaceId, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await documentsService.getDocumentById(req.params.id, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getContent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await documentsService.getDocumentContent(req.params.id, req.user!.id);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-File-Nonce', result.fileNonce);
    res.send(result.fileBuffer);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await documentsService.deleteDocument(req.params.id, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
