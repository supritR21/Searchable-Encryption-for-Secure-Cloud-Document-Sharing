import { Router } from 'express';
import * as usersController from './users.controller.js';
import { requireAuth } from '../../middleware/auth.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);
usersRouter.get('/search', usersController.search);
usersRouter.get('/:id/public-key', usersController.getPublicKey);
