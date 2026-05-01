import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { outfitsRouter } from './modules/outfits/outfits.routes';
import { uploadRouter } from './modules/upload/upload.routes';
import { wardrobeRouter } from './modules/wardrobe/wardrobe.routes';
import { authRouter } from './routes/auth.routes';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  return res.status(200).json({ ok: true });
});

app.use('/api', authRouter);
app.use('/api', uploadRouter);
app.use('/api', wardrobeRouter);
app.use('/api', outfitsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
