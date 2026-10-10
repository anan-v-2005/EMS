import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { getAnalytics } from "../controller/analyticsController.js";

const router = Router();
router.get("/", protect, getAnalytics);
export default router;
