import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import {
  createWardrobeItemController,
  deleteWardrobeItemController,
  listWardrobeItemsController,
  updateWardrobeItemController,
} from './wardrobe.controller';

export const wardrobeRouter = Router();

wardrobeRouter.post('/items', requireAuth, createWardrobeItemController);
wardrobeRouter.get('/items', requireAuth, listWardrobeItemsController);
wardrobeRouter.patch('/items/:id', requireAuth, updateWardrobeItemController);
wardrobeRouter.delete('/items/:id', requireAuth, deleteWardrobeItemController);
