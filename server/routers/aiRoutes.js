import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { chatWithAI, getAIInsight } from "../controller/aiController.js";

const aiRouter = Router();

aiRouter.post("/chat", protect, chatWithAI);
aiRouter.get("/insights", protect, getAIInsight);

export default aiRouter;
