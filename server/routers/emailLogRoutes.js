import { Router } from "express";
import { protect, protectAdmin } from "../middleware/auth.js";
import EmailLog from "../models/EmailLog.js";

const router = Router();

// Admin-only delivery log: GET /api/email-logs?status=FAILED&limit=50
router.get("/", protect, protectAdmin, async (req, res) => {
  try {
    const where = {};
    if (["SENT", "FAILED", "SKIPPED"].includes(req.query.status)) where.status = req.query.status;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const data = await EmailLog.find(where).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({ data });
  } catch (error) {
    console.error("Email log error:", error);
    return res.status(500).json({ error: "Failed to load email log" });
  }
});

export default router;
