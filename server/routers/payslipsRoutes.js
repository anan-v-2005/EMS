import { Router } from "express";
import { protect, protectAdmin } from "../middleware/auth.js";
import {
  bulkFinalize, bulkGenerate, createPayslips, deletePayslip, finalizePayslip, getPayslipById, getPayslips,
  getSettings, previewPayslip, reopenPayslip, updateSettings,
} from "../controller/payslipController.js";

const payslipRouter = Router();

payslipRouter.get("/", protect, getPayslips);

// Fixed paths must be declared before "/:id".
payslipRouter.get("/settings", protect, protectAdmin, getSettings);
payslipRouter.put("/settings", protect, protectAdmin, updateSettings);
payslipRouter.post("/preview", protect, protectAdmin, previewPayslip);
payslipRouter.post("/bulk", protect, protectAdmin, bulkGenerate);
payslipRouter.post("/bulk-finalize", protect, protectAdmin, bulkFinalize);

payslipRouter.post("/", protect, protectAdmin, createPayslips);
payslipRouter.get("/:id", protect, getPayslipById);
payslipRouter.post("/:id/finalize", protect, protectAdmin, finalizePayslip);
payslipRouter.post("/:id/reopen", protect, protectAdmin, reopenPayslip);
payslipRouter.delete("/:id", protect, protectAdmin, deletePayslip);

export default payslipRouter;
