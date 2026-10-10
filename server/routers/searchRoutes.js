import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { globalSearch } from "../controller/searchController.js";

const router = Router();
router.get("/", protect, globalSearch);
export default router;
