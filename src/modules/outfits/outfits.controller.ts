import type { NextFunction, Request, Response } from 'express';
import { createOutfitSchema, outfitsListQuerySchema } from './outfits.schemas';
import { createOutfitForUser, listOutfits } from './outfits.service';

export const createOutfitController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized', message: 'Authentication is required' });
    }

    const parsed = createOutfitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Invalid outfit payload',
        details: parsed.error.issues,
      });
    }

    const result = await createOutfitForUser(req.user.id, parsed.data);

    if (!result.ok && result.reason === 'missing') {
      return res.status(400).json({
        error: 'bad_request',
        message: 'One or more referenced clothing items are missing or not owned by user',
        missing_item_ids: result.missing,
      });
    }

    if (!result.ok && result.reason === 'category_mismatch') {
      return res.status(400).json({
        error: 'bad_request',
        message: 'One or more referenced clothing items do not match expected outfit slots',
        category_mismatch: result.category_mismatch,
      });
    }

    return res.status(201).json({ outfit: result.outfit });
  } catch (error) {
    return next(error);
  }
};

export const listOutfitsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized', message: 'Authentication is required' });
    }

    const parsed = outfitsListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Invalid outfits query',
        details: parsed.error.issues,
      });
    }

    const outfits = await listOutfits(req.user.id, parsed.data);
    return res.status(200).json({ outfits });
  } catch (error) {
    return next(error);
  }
};
