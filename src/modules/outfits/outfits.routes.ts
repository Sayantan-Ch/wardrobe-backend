import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { createOutfitController, listOutfitsController } from './outfits.controller';

export const outfitsRouter = Router();

outfitsRouter.post('/outfits', requireAuth, createOutfitController);
outfitsRouter.get('/outfits', requireAuth, listOutfitsController);
