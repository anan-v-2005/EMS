import Employee from "../models/Employee.js";
import LeaveApplication from "../models/LeaveApplication.js";
import Payslip from "../models/Payslip.js";

export const globalSearch = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ employees: [], leaves: [], payslips: [] });
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const limit = 8;
    if (req.session.role === "ADMIN") {
      const [employees, leaves, payslips] = await Promise.all([
        Employee.find({ isDeleted: { $ne: true }, $or: [{ firstName: regex }, { lastName: regex }, { email: regex }, { position: regex }, { department: regex }] }).limit(limit).lean(),
        LeaveApplication.find({ reason: regex }).populate("employeeId", "firstName lastName").limit(limit).sort({ createdAt: -1 }).lean(),
        Payslip.find({}).populate("employeeId", "firstName lastName").sort({ createdAt: -1 }).limit(50).lean(),
      ]);
      return res.json({ employees, leaves, payslips: payslips.filter((p) => `${p.employeeId?.firstName || ""} ${p.employeeId?.lastName || ""} ${p.month}/${p.year}`.match(regex)).slice(0, limit) });
    }
    const employee = await Employee.findOne({ userId: req.session.userId, isDeleted: { $ne: true } }).lean();
    if (!employee) return res.json({ employees: [], leaves: [], payslips: [] });
    const [leaves, payslips] = await Promise.all([
      LeaveApplication.find({ employeeId: employee._id, reason: regex }).limit(limit).sort({ createdAt: -1 }).lean(),
      Payslip.find({ employeeId: employee._id }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);
    return res.json({ employees: [], leaves, payslips: payslips.filter((p) => `${p.month}/${p.year} ${p.netSalary}`.match(regex)).slice(0, limit) });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({ error: "Search failed" });
  }
};
