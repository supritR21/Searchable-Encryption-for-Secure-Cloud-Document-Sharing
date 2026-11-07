import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const auditRouter = Router();

auditRouter.use(requireAuth);

auditRouter.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        actorId: req.user!.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    res.json({
      success: true,
      data: logs.map((log) => ({
        id: log.id,
        actorId: log.actorId,
        action: log.action,
        documentId: log.documentId,
        workspaceId: log.workspaceId,
        details: log.details,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});
