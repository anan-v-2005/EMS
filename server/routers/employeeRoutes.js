import { Router } from "express";
import { createEmployee, deleteEmployee, getArchivedEmployees, getEmployee, getEmployeeById, restoreEmployee, updateEmployee, uploadEmployeePhoto, deleteEmployeePhoto } from "../controller/employeeController.js";
import { protect, protectAdmin } from "../middleware/auth.js";
import { uploadImage } from "../middleware/upload.js";

const employeeRouter = Router();
employeeRouter.get("/archived", protect, protectAdmin, getArchivedEmployees);
employeeRouter.get("/:id", protect, protectAdmin, getEmployeeById);
employeeRouter.get("/", protect, protectAdmin, getEmployee);
employeeRouter.post("/", protect, protectAdmin, uploadImage.single("photo"), createEmployee);
employeeRouter.put("/:id", protect, protectAdmin, uploadImage.single("photo"), updateEmployee);
employeeRouter.post("/:id/photo", protect, protectAdmin, uploadImage.single("photo"), uploadEmployeePhoto);
employeeRouter.delete("/:id/photo", protect, protectAdmin, deleteEmployeePhoto);
employeeRouter.patch("/:id/restore", protect, protectAdmin, restoreEmployee);
employeeRouter.delete("/:id", protect, protectAdmin, deleteEmployee);
export default employeeRouter;
