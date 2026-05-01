import type { NextFunction, Request, Response } from 'express';
import {
  createWardrobeItemSchema,
  updateWardrobeItemSchema,
  wardrobeItemIdParamsSchema,
  wardrobeListQuerySchema,
} from './wardrobe.schemas';
import {
  createWardrobeItem,
  deleteWardrobeItem,
  listWardrobeItems,
  updateWardrobeItem,
} from './wardrobe.service';

export const createWardrobeItemController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized', message: 'Authentication is required' });
    }

    const parsed = createWardrobeItemSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Invalid wardrobe item payload',
        details: parsed.error.issues,
      });
    }

    const item = await createWardrobeItem(req.user.id, parsed.data);
    return res.status(201).json({ item });
  } catch (error) {
    return next(error);
  }
};

export const listWardrobeItemsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized', message: 'Authentication is required' });
    }

    const parsed = wardrobeListQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Invalid list query',
        details: parsed.error.issues,
      });
    }

    const items = await listWardrobeItems(req.user.id, parsed.data);
    return res.status(200).json({ items });
  } catch (error) {
    return next(error);
  }
};

export const updateWardrobeItemController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized', message: 'Authentication is required' });
    }

    const parsedParams = wardrobeItemIdParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Invalid item id',
        details: parsedParams.error.issues,
      });
    }

    const parsedBody = updateWardrobeItemSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Invalid wardrobe update payload',
        details: parsedBody.error.issues,
      });
    }

    if (Object.keys(parsedBody.data).length === 0) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'At least one field must be provided for update',
      });
    }

    const item = await updateWardrobeItem(req.user.id, parsedParams.data.id, parsedBody.data);

    if (!item) {
      return res.status(404).json({ error: 'not_found', message: 'Item not found' });
    }

    return res.status(200).json({ item });
  } catch (error) {
    return next(error);
  }
};

export const deleteWardrobeItemController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized', message: 'Authentication is required' });
    }

    const parsedParams = wardrobeItemIdParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Invalid item id',
        details: parsedParams.error.issues,
      });
    }

    const deleted = await deleteWardrobeItem(req.user.id, parsedParams.data.id);

    if (!deleted) {
      return res.status(404).json({ error: 'not_found', message: 'Item not found' });
    }

    return res.status(200).json({ message: 'Item deleted successfully' });
  } catch (error) {
    return next(error);
  }
};
