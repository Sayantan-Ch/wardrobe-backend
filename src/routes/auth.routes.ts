import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

export const authRouter = Router();

authRouter.get('/auth-test', requireAuth, (req, res) => {
  return res.status(200).json({
    message: 'Authenticated request',
    user: {
      id: req.user?.id,
      email: req.user?.email ?? null,
      role: req.userRole,
    },
  });
});

authRouter.get('/admin-test', requireAuth, requireRole(['admin']), (req, res) => {
  return res.status(200).json({
    message: 'Authorized as admin',
    user: {
      id: req.user?.id,
      role: req.userRole,
    },
  });
});
