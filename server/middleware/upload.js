import multer from "multer";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, WEBP, and GIF images are allowed"));
  }
  cb(null, true);
};

export const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter,
});

export const handleUploadError = (error, _req, res, next) => {
  if (!error) return next();
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "Image must be 5 MB or smaller" });
    return res.status(400).json({ error: `Upload failed: ${error.message}` });
  }
  if (error.message?.includes("Only JPG")) return res.status(400).json({ error: error.message });
  return next(error);
};
