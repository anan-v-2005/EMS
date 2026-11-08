import { Router } from "express";
import { protect, protectAdmin } from "../middleware/auth.js";
import multer from "multer";
import {
  listDocuments,
  downloadDocument,
  uploadDocument,
  verifyDocument,
  listReviews,
  saveReview,
  acknowledgeReview,
  addApproval,
  listApprovals,
  reviewApproval,
  listLifecycle,
  addLifecycle,
  listAudit,
} from "../controller/hrmsController.js";
const r = Router();
r.use(protect);
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    cb(
      null,
      ["application/pdf", "image/jpeg", "image/png"].includes(file.mimetype),
    ),
});
r.get("/documents", listDocuments);
r.get("/documents/:id/download", downloadDocument);
r.post(
  "/documents/upload",
  documentUpload.single("file"),
  (req, res, next) => {
    if (!req.file)
      return res.status(400).json({
        success: false,
        error: "Only PDF, JPG and PNG files up to 10 MB are allowed.",
      });
    next();
  },
  uploadDocument,
);
r.patch("/documents/:id/verification", protectAdmin, verifyDocument);
r.get("/performance-reviews", listReviews);
r.post("/performance-reviews", protectAdmin, saveReview);
r.patch("/performance-reviews/:id/acknowledge", acknowledgeReview);
r.get("/approvals", listApprovals);
r.post("/approvals", addApproval);
r.patch("/approvals/:id/review", protectAdmin, reviewApproval);
r.get("/lifecycle/:employeeId", listLifecycle);
r.post("/lifecycle", protectAdmin, addLifecycle);
r.get("/audit", protectAdmin, listAudit);
export default r;
