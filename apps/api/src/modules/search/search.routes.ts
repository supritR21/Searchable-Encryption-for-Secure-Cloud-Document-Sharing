import { Router } from 'express';
import * as searchController from './search.controller.js';
import { requireAuth } from '../../middleware/auth.js';

export const searchRouter = Router();

searchRouter.use(requireAuth);
searchRouter.post('/workspaces/:workspaceId/search', searchController.search);
