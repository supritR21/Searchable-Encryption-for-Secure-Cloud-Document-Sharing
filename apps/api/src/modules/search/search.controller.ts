import { Request, Response, NextFunction } from 'express';
import { searchSchema } from '@ciphershare/shared';
import * as searchService from './search.service.js';

export async function search(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const workspaceId = req.params.workspaceId;
    const validated = searchSchema.parse(req.body);

    const result = await searchService.searchDocuments(workspaceId, req.user!.id, validated);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
