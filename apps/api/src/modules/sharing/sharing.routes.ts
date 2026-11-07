import { Router } from 'express';
import * as sharingController from './sharing.controller.js';
import { requireAuth } from '../../middleware/auth.js';

export const sharingRouter = Router();

sharingRouter.use(requireAuth);

sharingRouter.post('/documents/:id/share', sharingController.share);
sharingRouter.delete('/documents/:id/access/:userId', sharingController.revoke);
sharingRouter.get('/documents/:id/access', sharingController.listAccess);
sharingRouter.get('/documents/shared-with-me', sharingController.listShared);
