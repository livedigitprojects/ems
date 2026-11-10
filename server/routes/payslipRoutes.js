import { Router } from "express";
import { createPayslip, exportPayslips, getPayslipById, getPayslips, updatePayslip } from "../controllers/payslipController.js";
import { protect, protectAdmin } from "../middleware/auth.js";

const payslipRouter = Router()

payslipRouter.post("/", protect, protectAdmin, createPayslip)
payslipRouter.get("/", protect, getPayslips)
payslipRouter.get("/export", protect, protectAdmin, exportPayslips)   // must stay above "/:id"
payslipRouter.get("/:id", protect, getPayslipById)
payslipRouter.put("/:id", protect, protectAdmin, updatePayslip)

export default payslipRouter