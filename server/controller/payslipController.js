import Payslip from "../models/Payslip.js";
import Employee from "../models/Employee.js";
import { notifyUsers } from "../utils/notifications.js";
import { sendEmailSafely } from "../config/notmailer.js";
import { payslipEmail } from "../utils/emailTemplates.js";

export const createPayslips = async (req, res) => {
  try {
    const {
      employeeId,
      month,
      year,
      basicSalary,
      allowances,
      deductions,
    } = req.body;

    if (
      !employeeId ||
      !month ||
      !year ||
      basicSalary === undefined ||
      basicSalary === null
    ) {
      return res.status(400).json({
        error: "Missing Feilds",
      });
    }

    const employee = await Employee.findById(employeeId).lean();
    if (!employee || employee.isDeleted) {
      return res.status(404).json({ error: "Active employee not found" });
    }

    const monthNumber = Number(month);
    const yearNumber = Number(year);
    const basic = Number(basicSalary);
    const extra = Number(allowances || 0);
    const deduction = Number(deductions || 0);

    if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12 ||
        !Number.isInteger(yearNumber) || yearNumber < 2000 || yearNumber > 2200 ||
        !Number.isFinite(basic) || basic < 0 || extra < 0 || deduction < 0) {
      return res.status(400).json({ error: "Invalid payslip values" });
    }

    const existing = await Payslip.findOne({ employeeId, month: monthNumber, year: yearNumber });
    if (existing) {
      return res.status(409).json({ error: "A payslip already exists for this employee and period" });
    }

    const netSalary = basic + extra - deduction;

    const payslip = await Payslip.create({
      employeeId,
      month: monthNumber,
      year: yearNumber,
      basicSalary: basic,
      allowances: extra,
      deductions: deduction,
      netSalary,
    });

    if (employee.userId) {
      await notifyUsers({
        userIds: [employee.userId],
        type: "PAYSLIP",
        title: "New payslip available",
        message: `Your payslip for ${monthNumber}/${yearNumber} is now available.`,
        link: "/payslips",
      });
      void sendEmailSafely({ to: employee.email, ...payslipEmail({ firstName: employee.firstName, month: monthNumber, year: yearNumber }) });
    }

    return res.json({
      success: true,
      data: payslip,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed",
    });
  }
};

export const getPayslips = async (req, res) => {
  try {
    const session = req.session;

    const isAdmin = session.role === "ADMIN";

    if (isAdmin) {
      const payslips = await Payslip.find()
        .populate("employeeId")
        .sort({ createdAt: -1 });

      const data = payslips.map((p) => {
        const obj = p.toObject();

        return {
          ...obj,
          id: obj._id.toString(),
          employee: obj.employeeId,
          employeeId: obj.employeeId?._id?.toString(),
        };
      });

      return res.json({
        data,
      });
    } else {
      const employee = await Employee.findOne({
        userId: session.userId,
      });

      if (!employee) {
        return res.status(404).json({
          error: "Not Found",
        });
      }

      const payslips = await Payslip.find({
        employeeId: employee._id,
      }).sort({
        createdAt: -1,
      });

      return res.json({
        data: payslips,
      });
    }
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed",
    });
  }
};

export const getPayslipById = async (req, res) => {
  try {
    const payslip = await Payslip.findById(req.params.id)
      .populate("employeeId")
      .lean();

    if (req.session.role !== "ADMIN") {
      const employee = await Employee.findOne({ userId: req.session.userId }).lean();
      if (!employee || !payslip || payslip.employeeId?._id?.toString() !== employee._id.toString()) {
        return res.status(403).json({ error: "You are not allowed to access this payslip" });
      }
    }

    if (!payslip) {
      return res.status(404).json({
        error: "Not Found",
      });
    }

    const result = {
      ...payslip,
      id: payslip._id.toString(),
      employee: payslip.employeeId,
    };

    return res.json(result);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed",
    });
  }
};