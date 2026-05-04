import multer from 'multer';

const ONE_MB = 1024 * 1024;
const MAX_FILE_SIZE = 5 * ONE_MB;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, and WEBP images are allowed'));
      return;
    }

    cb(null, true);
  },
});

export const uploadSingleImage = imageUpload.single('image');
