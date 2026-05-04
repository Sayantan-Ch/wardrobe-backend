import type { NextFunction, Request, Response } from 'express';
import { logger } from '../../lib/logger';
import { extractWardrobeItemsFromImage, ExtractionFailedError } from './extract.service';

export const extractImageController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized', message: 'Authentication is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'bad_request', message: 'image file is required' });
    }

    const items = await extractWardrobeItemsFromImage({
      fileBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });

    return res.status(200).json({ items });
  } catch (error) {
    if (error instanceof ExtractionFailedError) {
      logger.warn('extraction_failed_response', {
        event: 'extraction_failed_response',
        request_id: req.requestId,
        method: req.method,
        path: req.originalUrl,
        status: 502,
        user_id: req.user?.id,
      });

      return res.status(502).json({
        error: 'extraction_failed',
        message: 'Unable to extract wardrobe metadata from image',
      });
    }

    return next(error);
  }
};
