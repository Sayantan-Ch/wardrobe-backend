import { Router } from 'express';
import multer from 'multer';
import { logger } from '../../lib/logger';
import { requireAuth } from '../../middleware/auth.middleware';
import { imageUpload } from '../upload/upload.middleware';
import { extractImageController } from './extract.controller';

export const extractRouter = Router();

const extractSingleImage = imageUpload.single('image');

extractRouter.post('/extract', requireAuth, (req, res, next) => {
  extractSingleImage(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      logger.warn('multipart_upload_failed', {
        event: 'multipart_upload_failed',
        request_id: req.requestId,
        method: req.method,
        path: req.originalUrl,
        error_code: error.code,
        error: error.message,
        user_id: req.user?.id,
      });

      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'bad_request', message: 'Image must be 5MB or smaller' });
        return;
      }

      res.status(400).json({ error: 'bad_request', message: error.message });
      return;
    }

    logger.warn('multipart_upload_failed', {
      event: 'multipart_upload_failed',
      request_id: req.requestId,
      method: req.method,
      path: req.originalUrl,
      error: error.message,
      user_id: req.user?.id,
    });

    res.status(400).json({ error: 'bad_request', message: error.message });
  });
}, extractImageController);
