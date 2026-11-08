import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { chatWithAI, getAIInsight } from "../controller/aiController.js";

const aiRouter = Router();

// The assistant is optional. AI_ENABLED=false turns the whole feature off (the client hides it too).
const requireAiEnabled = (_req, res, next) => {
  if (String(process.env.AI_ENABLED ?? "true").toLowerCase() === "false") {
    return res.status(404).json({ error: "AI assistant is disabled" });
  }
  return next();
};

aiRouter.post("/chat", protect, requireAiEnabled, chatWithAI);
aiRouter.get("/insights", protect, requireAiEnabled, getAIInsight);

export default aiRouter;
