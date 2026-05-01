import type { NextFunction, Request, Response } from 'express';
import { uploadImageAndCreateItem } from './upload.service';
import { uploadMetadataSchema } from './upload.schemas';

export const uploadImageController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized', message: 'Authentication is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'bad_request', message: 'image file is required' });
    }

    const parseResult = uploadMetadataSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Invalid upload metadata',
        details: parseResult.error.issues,
      });
    }

    const result = await uploadImageAndCreateItem({
      userId: req.user.id,
      fileBuffer: req.file.buffer,
      originalMimeType: req.file.mimetype,
      metadata: parseResult.data,
    });

    return res.status(201).json({
      message: 'Image uploaded and wardrobe item created',
      item: result.item,
      storage: result.storage,
    });
  } catch (error) {
    return next(error);
  }
};
