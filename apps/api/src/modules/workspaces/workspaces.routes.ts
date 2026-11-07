import { Router } from 'express';
import * as workspacesController from './workspaces.controller.js';
import { requireAuth } from '../../middleware/auth.js';

export const workspacesRouter = Router();

workspacesRouter.use(requireAuth);
workspacesRouter.post('/', workspacesController.create);
workspacesRouter.get('/', workspacesController.list);
workspacesRouter.get('/:id', workspacesController.getById);
workspacesRouter.post('/:id/members', workspacesController.addMember);
workspacesRouter.get('/:id/members', workspacesController.listMembers);
