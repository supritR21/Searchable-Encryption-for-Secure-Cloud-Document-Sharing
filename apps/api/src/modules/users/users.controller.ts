import { Request, Response, NextFunction } from 'express';
import * as usersService from './users.service.js';

export async function search(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const emailQuery = (req.query.email as string) || '';
    const results = await usersService.searchUsersByEmail(emailQuery, req.user!.id);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

export async function getPublicKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userKey = await usersService.getUserPublicKey(req.params.id);
    res.json({ success: true, data: userKey });
  } catch (err) {
    next(err);
  }
}
