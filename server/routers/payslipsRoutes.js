import { Router } from "express";
import { protect, protectAdmin } from "../middleware/auth.js";
import {
  createPayslips,
  getPayslipById,
  getPayslips,
} from "../controller/payslipController.js";

const payslipRouter = Router();

payslipRouter.post("/", protect, protectAdmin, createPayslips);
payslipRouter.get("/", protect, getPayslips);
payslipRouter.get("/:id", protect, getPayslipById);



export default payslipRouter