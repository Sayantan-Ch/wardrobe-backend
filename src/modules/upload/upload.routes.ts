import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/auth.middleware';
import { uploadImageController } from './upload.controller';
import { uploadSingleImage } from './upload.middleware';

export const uploadRouter = Router();

uploadRouter.post('/upload', requireAuth, (req, res, next) => {
  uploadSingleImage(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'bad_request', message: 'Image must be 5MB or smaller' });
        return;
      }

      res.status(400).json({ error: 'bad_request', message: error.message });
      return;
    }

    res.status(400).json({ error: 'bad_request', message: error.message });
  });
}, uploadImageController);
