import { Router } from 'express';
import multer from 'multer';
import * as documentsController from './documents.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { CRYPTO_CONSTANTS } from '@ciphershare/shared';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CRYPTO_CONSTANTS.LIMITS.MAX_UPLOAD_SIZE_BYTES, // 10 MB
  },
});

export const documentsRouter = Router();

documentsRouter.use(requireAuth);

// Workspace-scoped document endpoints
documentsRouter.post('/workspaces/:workspaceId/documents', upload.single('file'), documentsController.upload);
documentsRouter.get('/workspaces/:workspaceId/documents', documentsController.list);

// Document-level endpoints
documentsRouter.get('/documents/:id', documentsController.getById);
documentsRouter.get('/documents/:id/content', documentsController.getContent);
documentsRouter.delete('/documents/:id', documentsController.remove);
