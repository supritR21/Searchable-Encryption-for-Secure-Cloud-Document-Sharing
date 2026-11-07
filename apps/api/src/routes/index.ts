import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { usersRouter } from '../modules/users/users.routes.js';
import { workspacesRouter } from '../modules/workspaces/workspaces.routes.js';
import { documentsRouter } from '../modules/documents/documents.routes.js';
import { searchRouter } from '../modules/search/search.routes.js';
import { sharingRouter } from '../modules/sharing/sharing.routes.js';
import { auditRouter } from '../modules/audit/audit.routes.js';

export const apiV1Router = Router();

apiV1Router.use('/auth', authRouter);
apiV1Router.use('/users', usersRouter);
apiV1Router.use('/workspaces', workspacesRouter);
apiV1Router.use('/', documentsRouter);
apiV1Router.use('/', searchRouter);
apiV1Router.use('/', sharingRouter);
apiV1Router.use('/audit', auditRouter);
