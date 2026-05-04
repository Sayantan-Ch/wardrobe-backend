import type { NextFunction, Request, Response } from 'express';
import { generateOutfitsRequestSchema } from './outfit-generation.schemas';
import { createOutfitSchema, outfitsListQuerySchema, outfitIdParamsSchema } from './outfits.schemas';
import {
  createOutfitForUser,
  deleteOutfit,
  generateOutfitsForUser,
  listOutfits,
} from './outfits.service';

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

export const deleteOutfitController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized', message: 'Authentication is required' });
    }

    const parsedParams = outfitIdParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Invalid outfit id',
        details: parsedParams.error.issues,
      });
    }

    const deleted = await deleteOutfit(req.user.id, parsedParams.data.id);

    if (!deleted) {
      return res.status(404).json({ error: 'not_found', message: 'Outfit not found' });
    }

    return res.status(200).json({ message: 'Outfit deleted successfully' });
  } catch (error) {
    return next(error);
  }
};

export const generateOutfitsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized', message: 'Authentication is required' });
    }

    const parsed = generateOutfitsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Invalid outfit generation request',
        details: parsed.error.issues,
      });
    }

    const result = await generateOutfitsForUser(req.user.id, parsed.data);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};
