import { Router } from "express";
import { protect, protectAdmin } from "../middleware/auth.js";
import { listBalances, previewLeave, listSalaryStructures, saveSalaryStructure, runAutoCheckout, editCheckout, convertAbsenceToLeave, listAttendanceAudit } from "../controller/enterpriseController.js";

// People Operations API: leave balances, salary structures, attendance review.
// (Recruitment and the legacy payroll-snapshot endpoints were removed; payroll lives in /api/payslips.)
const r = Router();
r.use(protect);

r.get("/leave-balances", listBalances);
r.get("/leave-preview", previewLeave);

r.get("/salary-structures", protectAdmin, listSalaryStructures);
r.post("/salary-structures", protectAdmin, saveSalaryStructure);
r.patch("/salary-structures/:id", protectAdmin, saveSalaryStructure);

r.post("/attendance/run-auto-checkout", protectAdmin, runAutoCheckout);
r.patch("/attendance/:id/checkout", protectAdmin, editCheckout);
r.post("/attendance/:id/convert-absence-to-leave", protectAdmin, convertAbsenceToLeave);
r.get("/attendance/:id/audit", protectAdmin, listAttendanceAudit);

export default r;
