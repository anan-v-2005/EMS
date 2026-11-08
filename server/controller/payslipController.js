import mongoose from "mongoose";
import Payslip, { PUBLISHED } from "../models/Payslip.js";
import Employee from "../models/Employee.js";
import { notifyUsers } from "../utils/notifications.js";
import { sendEmailSafely } from "../config/notmailer.js";
import { payslipEmail } from "../utils/emailTemplates.js";
import { getPayrollSettings, savePayrollSettings } from "../services/payrollSettings.js";
import {
  PayrollError, calculateForEmployee, periodBounds, toPayslipFields, validatePeriod,
} from "../services/payrollData.js";

const EMPLOYEE_FIELDS = "firstName lastName email phone position department joinDate isDeleted employmentStatus";
const isId = (v) => mongoose.isValidObjectId(v);
const pad = (n) => String(n).padStart(2, "0");

const sendError = (res, error) => {
  if (error instanceof PayrollError) return res.status(error.status).json({ error: error.message });
  if (error?.code === 11000) return res.status(409).json({ error: "A payslip already exists for this employee and period" });
  if (error?.name === "ValidationError" || error?.name === "CastError") return res.status(400).json({ error: error.message });
  console.error("Payslip error:", error);
  return res.status(500).json({ error: "Failed" });
};

const publicPayslip = (p, { admin }) => {
  const populated = p.employeeId && typeof p.employeeId === "object" && p.employeeId._id ? p.employeeId : null;
  const out = {
    ...p,
    id: String(p._id),
    status: p.status || "finalized",
    employee: populated || undefined,
    employeeId: String(populated?._id || p.employeeId),
  };
  if (!admin) { delete out.history; delete out.policy; delete out.warnings; delete out.adjustments; delete out.generatedBy; delete out.finalizedBy; }
  return out;
};

const findOwnEmployee = (session) => Employee.findOne({ userId: session.userId }).select("_id").lean();

async function loadActiveEmployee(employeeId) {
  if (!isId(employeeId)) throw new PayrollError("A valid employee is required");
  const employee = await Employee.findById(employeeId).lean();
  if (!employee || employee.isDeleted) throw new PayrollError("Active employee not found", 404);
  return employee;
}

const historyEntry = (action, by, note = "") => ({ action, by, at: new Date(), note });

// Creates a draft, or refreshes the existing draft. A finalized payslip is never touched.
async function saveDraft({ employee, month, year, mode, adjustments, manual, allowEarly, settings, actorId }) {
  const existing = await Payslip.findOne({ employeeId: employee._id, month, year }).select("_id status").lean();
  if (existing && (existing.status || "finalized") !== "draft") {
    throw new PayrollError("A finalized payslip already exists for this period. Reopen it first if it needs to change.", 409);
  }
  const calc = await calculateForEmployee({ employee, month, year, mode, settings, adjustments, manual, allowEarly });
  const fields = toPayslipFields({ result: calc.result, adjustments: calc.adjustments, mode, settings });

  if (existing) {
    const doc = await Payslip.findOneAndUpdate(
      { _id: existing._id, status: "draft" },
      { $set: { ...fields, generatedAt: new Date(), generatedBy: actorId }, $push: { history: historyEntry("REGENERATED", actorId, mode) } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!doc) throw new PayrollError("This payslip was finalized by someone else while you were editing it.", 409);
    return { action: "updated", doc, warnings: calc.result.warnings };
  }
  const created = await Payslip.create({
    ...fields, employeeId: employee._id, month, year, status: "draft",
    generatedAt: new Date(), generatedBy: actorId, history: [historyEntry("GENERATED", actorId, mode)],
  });
  return { action: "created", doc: created.toObject(), warnings: calc.result.warnings };
}

async function finalizeOne(id, actorId) {
  const current = await Payslip.findById(id).select("employeeId month year status").lean();
  if (!current) throw new PayrollError("Payslip not found", 404);
  const doc = await Payslip.findOneAndUpdate(
    { _id: id, status: "draft" },
    {
      $set: {
        status: "finalized", finalizedAt: new Date(), finalizedBy: actorId,
        payslipNumber: `PS-${current.year}${pad(current.month)}-${String(current.employeeId).slice(-6).toUpperCase()}`,
      },
      $push: { history: historyEntry("FINALIZED", actorId) },
    },
    { returnDocument: "after" },
  ).lean();
  if (!doc) throw new PayrollError("Only draft payslips can be finalized", 409);

  // Tell the employee only now that the payslip is real (drafts are invisible to them).
  const employee = await Employee.findById(doc.employeeId).select("userId firstName email").lean();
  if (employee?.userId) {
    try {
      await notifyUsers({
        userIds: [employee.userId], type: "PAYSLIP", title: "New payslip available",
        message: `Your payslip for ${pad(doc.month)}/${doc.year} is now available.`, link: "/payslips",
      });
    } catch (error) { console.error("Payslip notification failed:", error.message); }
    void sendEmailSafely({ to: employee.email, ...payslipEmail({ firstName: employee.firstName, month: doc.month, year: doc.year, payslipNumber: doc.payslipNumber }) });
  }
  return doc;
}

const readGenerateBody = (body = {}) => {
  const { month, year } = validatePeriod(body.month, body.year);
  const mode = String(body.mode || (body.basicSalary !== undefined ? "MANUAL" : "AUTO")).toUpperCase();
  if (!["AUTO", "MANUAL"].includes(mode)) throw new PayrollError("Mode must be AUTO or MANUAL");
  if (mode === "MANUAL" && (body.basicSalary === undefined || body.basicSalary === null || body.basicSalary === "")) {
    throw new PayrollError("Basic salary is required for a manual payslip");
  }
  return {
    month, year, mode,
    adjustments: body.adjustments || {},
    manual: { basicSalary: body.basicSalary, allowances: body.allowances, deductions: body.deductions },
    allowEarly: body.allowEarly === true || body.allowEarly === "true",
  };
};

/* ------------------------------------------------------------------ list / detail */

export const getPayslips = async (req, res) => {
  try {
    const admin = req.session.role === "ADMIN";
    const filter = {};
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.month) filter.month = Number(req.query.month);

    if (!admin) {
      const employee = await findOwnEmployee(req.session);
      if (!employee) return res.status(404).json({ error: "Not Found" });
      const rows = await Payslip.find({ ...filter, employeeId: employee._id, ...PUBLISHED }).sort({ year: -1, month: -1 }).lean();
      return res.json({ data: rows.map((p) => publicPayslip(p, { admin: false })) });
    }

    if (req.query.status === "draft") filter.status = "draft";
    else if (req.query.status === "finalized") Object.assign(filter, PUBLISHED);
    if (req.query.employeeId && isId(req.query.employeeId)) filter.employeeId = req.query.employeeId;

    let rows = await Payslip.find(filter)
      .populate("employeeId", EMPLOYEE_FIELDS)
      .sort({ year: -1, month: -1, createdAt: -1 })
      .limit(2000)
      .lean();
    const q = String(req.query.search || "").trim().toLowerCase();
    if (q) rows = rows.filter((p) => `${p.employeeId?.firstName || ""} ${p.employeeId?.lastName || ""} ${p.employeeId?.email || ""}`.toLowerCase().includes(q));

    const data = rows.map((p) => publicPayslip(p, { admin: true }));
    const sum = (list, f) => list.reduce((s, p) => s + Math.round(Number(f(p) || 0) * 100), 0) / 100;
    const drafts = data.filter((p) => p.status === "draft"), final = data.filter((p) => p.status !== "draft");
    return res.json({
      data,
      summary: {
        total: data.length, drafts: drafts.length, finalized: final.length,
        finalizedNet: sum(final, (p) => p.netSalary), draftNet: sum(drafts, (p) => p.netSalary),
        finalizedGross: sum(final, (p) => p.breakdown?.earnings?.total ?? (p.basicSalary + p.allowances)),
        withWarnings: drafts.filter((p) => p.warnings?.length).length,
      },
    });
  } catch (error) { return sendError(res, error); }
};

export const getPayslipById = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: "Not Found" });
    const admin = req.session.role === "ADMIN";
    const payslip = await Payslip.findById(req.params.id).populate("employeeId", EMPLOYEE_FIELDS).lean();
    if (!payslip) return res.status(404).json({ error: "Not Found" });
    if (!admin) {
      const employee = await findOwnEmployee(req.session);
      const ownerId = String(payslip.employeeId?._id || payslip.employeeId);
      if (!employee || ownerId !== String(employee._id)) return res.status(403).json({ error: "You are not allowed to access this payslip" });
      // Drafts are invisible to employees (404, not 403, so their existence is not leaked).
      if (payslip.status === "draft") return res.status(404).json({ error: "Not Found" });
    }
    const settings = await getPayrollSettings();
    return res.json({ ...publicPayslip(payslip, { admin }), company: { name: settings.companyName, address: settings.companyAddress } });
  } catch (error) { return sendError(res, error); }
};

/* ------------------------------------------------------------------ generate / preview */

export const previewPayslip = async (req, res) => {
  try {
    const input = readGenerateBody(req.body);
    const employee = await loadActiveEmployee(req.body?.employeeId);
    const settings = await getPayrollSettings();
    const calc = await calculateForEmployee({ employee, ...input, settings, allowEarly: true });
    const existing = await Payslip.findOne({ employeeId: employee._id, month: input.month, year: input.year }).select("status").lean();
    return res.json({ data: { ...calc.result, monthOver: calc.monthOver }, existing: existing ? { status: existing.status || "finalized" } : null });
  } catch (error) { return sendError(res, error); }
};

export const createPayslips = async (req, res) => {
  try {
    const input = readGenerateBody(req.body);
    const employee = await loadActiveEmployee(req.body?.employeeId);
    const settings = await getPayrollSettings();
    const saved = await saveDraft({ employee, ...input, settings, actorId: req.session.userId });
    let doc = saved.doc;
    if (req.body?.finalizeNow === true) doc = await finalizeOne(doc._id, req.session.userId);
    return res.status(saved.action === "created" ? 201 : 200).json({
      success: true, action: saved.action, data: publicPayslip(doc, { admin: true }), warnings: saved.warnings,
    });
  } catch (error) { return sendError(res, error); }
};

export const bulkGenerate = async (req, res) => {
  try {
    const { month, year } = validatePeriod(req.body?.month, req.body?.year);
    const { nextKey } = periodBounds(year, month);
    const periodEnd = new Date(`${nextKey}T00:00:00+05:30`);
    const filter = { isDeleted: { $ne: true }, employmentStatus: "ACTIVE" };
    if (Array.isArray(req.body?.employeeIds) && req.body.employeeIds.length) filter._id = { $in: req.body.employeeIds.filter(isId) };
    if (req.body?.department) filter.department = String(req.body.department);
    const employees = await Employee.find(filter).sort({ firstName: 1 }).lean();
    const settings = await getPayrollSettings({ force: true });
    const allowEarly = req.body?.allowEarly === true;

    const results = [];
    for (const employee of employees) {
      const base = { employeeId: String(employee._id), name: `${employee.firstName} ${employee.lastName}` };
      try {
        if (employee.joinDate && employee.joinDate >= periodEnd) { results.push({ ...base, status: "skipped", reason: "Joined after this period" }); continue; }
        const saved = await saveDraft({ employee, month, year, mode: "AUTO", adjustments: {}, manual: {}, allowEarly, settings, actorId: req.session.userId });
        if (!(saved.doc.salary?.gross > 0)) {
          // Never leave a zero-salary draft behind: a brand-new one is removed again.
          if (saved.action === "created") await Payslip.deleteOne({ _id: saved.doc._id, status: "draft" });
          results.push({ ...base, status: "skipped", reason: "No salary configured" });
          continue;
        }
        results.push({ ...base, status: saved.action, net: saved.doc.netSalary, warnings: saved.warnings.length });
      } catch (error) {
        results.push({ ...base, status: error instanceof PayrollError && error.status === 409 ? "skipped" : "error", reason: error.message });
      }
    }
    const count = (s) => results.filter((r) => r.status === s).length;
    return res.json({ success: true, summary: { created: count("created"), updated: count("updated"), skipped: count("skipped"), errors: count("error") }, results });
  } catch (error) { return sendError(res, error); }
};

/* ------------------------------------------------------------------ workflow */

export const finalizePayslip = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: "Not Found" });
    const doc = await finalizeOne(req.params.id, req.session.userId);
    return res.json({ success: true, data: publicPayslip(doc, { admin: true }) });
  } catch (error) { return sendError(res, error); }
};

export const bulkFinalize = async (req, res) => {
  try {
    const { month, year } = validatePeriod(req.body?.month, req.body?.year);
    const filter = { month, year, status: "draft" };
    if (Array.isArray(req.body?.ids) && req.body.ids.length) filter._id = { $in: req.body.ids.filter(isId) };
    const drafts = await Payslip.find(filter).select("_id").lean();
    let finalized = 0; const errors = [];
    for (const d of drafts) {
      try { await finalizeOne(d._id, req.session.userId); finalized++; }
      catch (error) { errors.push({ id: String(d._id), reason: error.message }); }
    }
    return res.json({ success: true, finalized, errors });
  } catch (error) { return sendError(res, error); }
};

export const reopenPayslip = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: "Not Found" });
    const reason = String(req.body?.reason || "").trim();
    if (reason.length < 3) return res.status(400).json({ error: "Please give a reason for reopening this payslip" });
    const doc = await Payslip.findOneAndUpdate(
      { _id: req.params.id, ...PUBLISHED },
      { $set: { status: "draft", finalizedAt: null, finalizedBy: null }, $push: { history: historyEntry("REOPENED", req.session.userId, reason.slice(0, 500)) } },
      { returnDocument: "after" },
    ).lean();
    if (!doc) return res.status(409).json({ error: "Only finalized payslips can be reopened" });
    return res.json({ success: true, data: publicPayslip(doc, { admin: true }) });
  } catch (error) { return sendError(res, error); }
};

export const deletePayslip = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: "Not Found" });
    const result = await Payslip.deleteOne({ _id: req.params.id, status: "draft" });
    if (!result.deletedCount) {
      const exists = await Payslip.exists({ _id: req.params.id });
      return res.status(exists ? 409 : 404).json({ error: exists ? "Finalized payslips cannot be deleted. Reopen the payslip first." : "Not Found" });
    }
    return res.json({ success: true });
  } catch (error) { return sendError(res, error); }
};

/* ------------------------------------------------------------------ settings */

export const getSettings = async (_req, res) => {
  try { return res.json({ data: await getPayrollSettings({ force: true }) }); }
  catch (error) { return sendError(res, error); }
};

export const updateSettings = async (req, res) => {
  try { return res.json({ success: true, data: await savePayrollSettings(req.body || {}, req.session.userId) }); }
  catch (error) {
    // validateSettingsInput throws plain Errors with user-readable messages.
    if (error && error.name === "Error" && !error.code) return res.status(400).json({ error: error.message });
    return sendError(res, error);
  }
};
