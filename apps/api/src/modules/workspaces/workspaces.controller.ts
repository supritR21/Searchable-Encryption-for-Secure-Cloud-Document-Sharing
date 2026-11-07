import { Request, Response, NextFunction } from 'express';
import { createWorkspaceSchema, addWorkspaceMemberSchema } from '@ciphershare/shared';
import * as workspacesService from './workspaces.service.js';

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = createWorkspaceSchema.parse(req.body);
    const result = await workspacesService.createWorkspace(req.user!.id, validated);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await workspacesService.listUserWorkspaces(req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await workspacesService.getWorkspaceById(req.params.id, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = addWorkspaceMemberSchema.parse(req.body);
    const result = await workspacesService.addMemberToWorkspace(
      req.params.id,
      req.user!.id,
      validated
    );
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await workspacesService.listWorkspaceMembers(req.params.id, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
