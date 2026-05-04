import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import {
  createOutfitController,
  deleteOutfitController,
  generateOutfitsController,
  listOutfitsController,
} from './outfits.controller';

export const outfitsRouter = Router();

outfitsRouter.post('/outfits', requireAuth, createOutfitController);
outfitsRouter.post('/outfits/generate', requireAuth, generateOutfitsController);
outfitsRouter.get('/outfits', requireAuth, listOutfitsController);
outfitsRouter.delete('/outfits/:id', requireAuth, deleteOutfitController);
