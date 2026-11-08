import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../controller/notificationController.js";

const router = Router();
router.get("/", protect, getNotifications);
router.patch("/read-all", protect, markAllNotificationsRead);
router.patch("/:id/read", protect, markNotificationRead);
export default router;
