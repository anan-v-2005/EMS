import { Router } from "express";
import { protect, protectAdmin } from "../middleware/auth.js";
import { createHoliday, deleteHoliday, getHolidays, updateHoliday } from "../controller/holidayController.js";
const router = Router();
router.get("/", protect, getHolidays);
router.post("/", protect, protectAdmin, createHoliday);
router.patch("/:id", protect, protectAdmin, updateHoliday);
router.delete("/:id", protect, protectAdmin, deleteHoliday);
export default router;
