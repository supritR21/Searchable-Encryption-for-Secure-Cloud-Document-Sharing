import { Request, Response, NextFunction } from 'express';
import { shareDocumentSchema } from '@ciphershare/shared';
import * as sharingService from './sharing.service.js';

export async function share(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const documentId = req.params.id;
    const validated = shareDocumentSchema.parse(req.body);

    const result = await sharingService.shareDocument(documentId, req.user!.id, validated);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function revoke(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const documentId = req.params.id;
    const recipientUserId = req.params.userId;

    const result = await sharingService.revokeDocumentAccess(
      documentId,
      req.user!.id,
      recipientUserId
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const documentId = req.params.id;
    const result = await sharingService.listDocumentAccess(documentId, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listShared(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await sharingService.listSharedWithMe(req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
