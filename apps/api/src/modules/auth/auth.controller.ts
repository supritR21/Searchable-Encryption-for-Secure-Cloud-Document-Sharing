import { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from '@ciphershare/shared';
import * as authService from './auth.service.js';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = registerSchema.parse(req.body);
    const result = await authService.registerUser(validated);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = loginSchema.parse(req.body);
    const result = await authService.loginUser(validated);

    // Also set HTTP-only cookie for secure browser sessions
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await authService.getUserProfile(req.user!.id);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}
