import { Router } from "express";
import { changePassword, forgotPassword, login, resetPassword, session } from "../controller/authController.js";
import { protect } from "../middleware/auth.js";
import { loginLimiter, passwordResetLimiter } from "../middleware/security.js";
const authRouter = Router();

authRouter.post("/login", loginLimiter, login);
authRouter.post("/forgot-password", passwordResetLimiter, forgotPassword);
authRouter.post("/reset-password", passwordResetLimiter, resetPassword);
authRouter.get("/session", protect, session);
authRouter.post("/change-password", protect, changePassword);

export default authRouter;
