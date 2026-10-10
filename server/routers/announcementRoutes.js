import { Router } from "express";
import { protect, protectAdmin } from "../middleware/auth.js";
import { createAnnouncement, getAnnouncements, toggleAnnouncement } from "../controller/announcementController.js";

const router = Router();
router.get("/", protect, getAnnouncements);
router.post("/", protect, protectAdmin, createAnnouncement);
router.patch("/:id/toggle", protect, protectAdmin, toggleAnnouncement);
export default router;
