import Attendance from "../models/Attendance.js";
import { withCurrentSalary } from "../services/salaryService.js";
import Employee from "../models/Employee.js";
import LeaveApplication from "../models/LeaveApplication.js";
import Payslip, { PUBLISHED } from "../models/Payslip.js";
import Holiday from "../models/Holiday.js";
import { getWeeklyOffDays } from "../services/workPolicy.js";
import { DEPARTMENTS } from "../constants/department.js";
import {
  getIndiaDayRange,
  getIndiaMonthRange,
  getIndiaMonthRangeForOffset,
  getIndiaWeekday,
} from "../utils/date.js";

const round = (value, digits = 2) =>
  Number(Number(value || 0).toFixed(digits));

const indiaDateKey = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));

const monthLabel = (date) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    month: "short",
    year: "numeric",
  }).format(new Date(date));

const monthKey = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(date));

const eachDay = (start, end) => {
  const days = [];

  const startDate = new Date(start);
  const endDate = new Date(end);

  for (
    let cursor = new Date(startDate);
    cursor < endDate;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    days.push({
      date: new Date(cursor),
      key: indiaDateKey(cursor),
      weekday: getIndiaWeekday(cursor),
    });
  }

  return days;
};

const isWorkday = (day, holidayKeys, weeklyOffDays = [0]) =>
  !weeklyOffDays.includes(day.weekday) &&
  !holidayKeys.has(day.key);

const dateInRange = (value, start, end) => {
  const date = new Date(value);
  const rangeStart = new Date(start);
  const rangeEnd = new Date(end);

  return date >= rangeStart && date < rangeEnd;
};

/*
 * Returns a Set containing the dates on which an employee
 * has an approved leave.
 *
 * Important:
 * start/end are explicitly converted to Date objects.
 * This prevents:
 *
 * TypeError: end.getTime is not a function
 */
const leaveDays = (leaves, start, end) => {
  const set = new Set();

  const rangeStart = new Date(start);
  const rangeEnd = new Date(end);

  if (
    Number.isNaN(rangeStart.getTime()) ||
    Number.isNaN(rangeEnd.getTime())
  ) {
    return set;
  }

  leaves
    .filter((leave) => leave.status === "APPROVED")
    .forEach((leave) => {
      const leaveStart = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate);

      if (
        Number.isNaN(leaveStart.getTime()) ||
        Number.isNaN(leaveEnd.getTime())
      ) {
        return;
      }

      const from = new Date(
        Math.max(leaveStart.getTime(), rangeStart.getTime())
      );

      const to = new Date(
        Math.min(leaveEnd.getTime(), rangeEnd.getTime() - 1)
      );

      if (from > to) {
        return;
      }

      for (
        let cursor = new Date(
          `${indiaDateKey(from)}T00:00:00+05:30`
        );
        cursor <= to;
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      ) {
        set.add(indiaDateKey(cursor));
      }
    });

  return set;
};

const monthDefinitions = (count = 12) =>
  Array.from({ length: count }, (_, index) => {
    const { start, end } =
      getIndiaMonthRangeForOffset(-(count - 1 - index));

    return {
      start,
      end,
      key: monthKey(start),
      label: monthLabel(start),
    };
  });

export const buildEmployeeAnalytics = async (employee) => {
  const months = monthDefinitions();

  const rangeStart = months[0].start;
  const rangeEnd = months.at(-1).end;

  const { start: todayStart, end: todayEnd } =
    getIndiaDayRange();

  const {
    start: currentMonthStart,
    end: currentMonthEnd,
  } = getIndiaMonthRange();

  const [
    attendance,
    leaves,
    payslips,
    holidays,
  ] = await Promise.all([
    Attendance.find({
      employeeId: employee._id,
      date: {
        $gte: rangeStart,
        $lt: rangeEnd,
      },
    })
      .sort({ date: 1 })
      .lean(),

    LeaveApplication.find({
      employeeId: employee._id,
      $or: [
        {
          startDate: { $lt: rangeEnd },
          endDate: { $gte: rangeStart },
        },
        {
          createdAt: {
            $gte: rangeStart,
            $lt: rangeEnd,
          },
        },
      ],
    })
      .sort({ startDate: 1 })
      .lean(),

    Payslip.find({
      employeeId: employee._id,
      ...PUBLISHED,
    })
      .sort({ year: 1, month: 1 })
      .lean(),

    Holiday.find({
      date: {
        $gte: rangeStart,
        $lt: rangeEnd,
      },
      type: { $ne: "OPTIONAL" },
    }).lean(),
  ]);

  const weeklyOffDays = await getWeeklyOffDays();
  const holidayKeys = new Set(
    holidays.map((h) => indiaDateKey(h.date))
  );

  const attendanceByKey = new Map(
    attendance.map((item) => [
      indiaDateKey(item.date),
      item,
    ])
  );

  const approvedLeaves = leaves.filter(
    (leave) => leave.status === "APPROVED"
  );

  const buildMonth = (month) => {
    const days = eachDay(month.start, month.end);

    const effectiveEnd =
      month.key === monthKey(todayStart)
        ? todayStart
        : month.end;

    const employeeJoinDate = new Date(employee.joinDate);

    const expectedDays = days.filter(
      (day) =>
        day.date < effectiveEnd &&
        isWorkday(day, holidayKeys, weeklyOffDays) &&
        day.date >= employeeJoinDate
    ).length;

    const present = days.filter(
      (day) =>
        day.date < effectiveEnd &&
        isWorkday(day, holidayKeys, weeklyOffDays) &&
        attendanceByKey.get(day.key)?.status === "PRESENT"
    ).length;

    const late = days.filter(
      (day) =>
        day.date < effectiveEnd &&
        isWorkday(day, holidayKeys, weeklyOffDays) &&
        attendanceByKey.get(day.key)?.status === "LATE"
    ).length;

    /*
     * FIX:
     * Math.min(Date, Date) returns a number.
     * We explicitly convert the result back to Date.
     */
    const approvedLeaveEnd = new Date(
      Math.min(
        new Date(month.end).getTime(),
        new Date(effectiveEnd).getTime()
      )
    );

    const approvedLeaveSet = leaveDays(
      approvedLeaves,
      month.start,
      approvedLeaveEnd
    );

    const leaveCount = days.filter(
      (day) =>
        day.date < effectiveEnd &&
        isWorkday(day, holidayKeys, weeklyOffDays) &&
        approvedLeaveSet.has(day.key)
    ).length;

    const absent = Math.max(
      0,
      expectedDays - present - late - leaveCount
    );

    const completed = attendance.filter(
      (item) =>
        monthKey(item.date) === month.key &&
        Number.isFinite(item.workingHours)
    );

    const workingHours = completed.reduce(
      (sum, item) =>
        sum + Number(item.workingHours),
      0
    );

    const attendanceRate = expectedDays
      ? round(
          ((present + late) /
            Math.max(1, expectedDays - leaveCount)) *
            100,
          1
        )
      : 0;

    return {
      label: month.label,
      key: month.key,
      present,
      late,
      absent,
      approvedLeaveDays: leaveCount,
      expectedDays,
      totalMarked: present + late + absent,
      workingHours: round(workingHours),
      completedDays: completed.length,
      avgHours: completed.length
        ? round(workingHours / completed.length)
        : 0,
      attendanceRate,
    };
  };

  const attendanceTrend = months.map(buildMonth);

  const current = attendanceTrend.at(-1);

  const previous =
    attendanceTrend.at(-2) || {
      attendanceRate: 0,
      avgHours: 0,
      late: 0,
      present: 0,
    };

  const currentDays = eachDay(
    currentMonthStart,
    currentMonthEnd
  ).filter(
    (day) =>
      day.date < todayStart &&
      isWorkday(day, holidayKeys, weeklyOffDays) &&
      day.date >= new Date(employee.joinDate)
  );

  const currentApprovedLeaveSet = leaveDays(
    approvedLeaves,
    currentMonthStart,
    todayEnd
  );

  const dailyWorkingHours = currentDays.map((day) => {
    const record = attendanceByKey.get(day.key);

    const onLeave = currentApprovedLeaveSet.has(
      day.key
    );

    const status =
      record?.status ||
      (onLeave ? "LEAVE" : "ABSENT");

    return {
      date: day.key,
      day: new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
      }).format(day.date),
      status,
      workingHours: Number.isFinite(
        record?.workingHours
      )
        ? round(record.workingHours)
        : null,
      checkIn: record?.checkIn || null,
      checkOut: record?.checkOut || null,
    };
  });

  const currentAttendance = attendance.filter(
    (item) =>
      dateInRange(
        item.date,
        currentMonthStart,
        currentMonthEnd
      )
  );

  const completed = currentAttendance.filter(
    (item) =>
      Number.isFinite(item.workingHours)
  );

  const totalHours = completed.reduce(
    (sum, item) =>
      sum + Number(item.workingHours),
    0
  );

  const currentLeaves = leaves.filter(
    (leave) =>
      dateInRange(
        leave.createdAt,
        currentMonthStart,
        currentMonthEnd
      ) ||
      (new Date(leave.startDate) < currentMonthEnd &&
        new Date(leave.endDate) >= currentMonthStart)
  );

  const salaryTrend = months
    .map((month) => {
      const monthDate = new Date(month.start);
      const year = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
        }).format(monthDate)
      );
      const monthNumber = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          month: "numeric",
        }).format(monthDate)
      );
      const p = payslips.find(
        (item) => item.year === year && item.month === monthNumber
      );
      return p
        ? {
            label: `${String(p.month).padStart(2, "0")}/${p.year}`,
            month: p.month,
            year: p.year,
            basicSalary: round(p.basicSalary),
            allowances: round(p.allowances),
            deductions: round(p.deductions),
            netSalary: round(p.netSalary),
          }
        : null;
    })
    .filter(Boolean);

  const leaveStats = [
    "SICK",
    "CASUAL",
    "ANNUAL",
  ].map((type) => ({
    type,
    total: leaves.filter(
      (l) => l.type === type
    ).length,
    approved: leaves.filter(
      (l) =>
        l.type === type &&
        l.status === "APPROVED"
    ).length,
    pending: leaves.filter(
      (l) =>
        l.type === type &&
        l.status === "PENDING"
    ).length,
    rejected: leaves.filter(
      (l) =>
        l.type === type &&
        l.status === "REJECTED"
    ).length,
  }));

  const activity = [
    ...attendance.slice(-20).map((item) => ({
      date: item.date,
      type: "attendance",
      title:
        item.status === "LATE"
          ? "Late arrival recorded"
          : "Attendance marked",
      description: Number.isFinite(
        item.workingHours
      )
        ? `${round(
            item.workingHours
          )} hours worked`
        : "Check-in recorded",
      status: item.status,
    })),

    ...leaves.slice(-12).map((leave) => ({
      date:
        leave.updatedAt ||
        leave.createdAt,
      type: "leave",
      title: `${leave.type} leave ${leave.status.toLowerCase()}`,
      description: `${indiaDateKey(
        leave.startDate
      )} – ${indiaDateKey(
        leave.endDate
      )}`,
      status: leave.status,
    })),

    ...payslips.slice(-8).map((p) => ({
      date: p.createdAt,
      type: "payslip",
      title: "Payslip available",
      description: `${String(
        p.month
      ).padStart(2, "0")}/${p.year} · Net $${round(
        p.netSalary
      ).toLocaleString("en-IN")}`,
      status: "AVAILABLE",
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.date) -
        new Date(a.date)
    )
    .slice(0, 15);

  return {
    role: "EMPLOYEE",

    employee: {
      id: employee._id.toString(),
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      position: employee.position,
      department: employee.department,
      employmentStatus:
        employee.employmentStatus,
      joinDate: employee.joinDate,
    },

    summary: {
      month: monthLabel(currentMonthStart),
      attendanceRate:
        current.attendanceRate,
      attendanceDelta: round(
        current.attendanceRate -
          previous.attendanceRate,
        1
      ),
      presentDays: current.present,
      lateArrivals: current.late,
      absentDays: current.absent,
      totalHours: round(totalHours),
      avgHours: completed.length
        ? round(
            totalHours /
              completed.length
          )
        : 0,
      completedDays: completed.length,
      leaveRequests:
        currentLeaves.length,
      approvedLeaves:
        currentLeaves.filter(
          (l) =>
            l.status === "APPROVED"
        ).length,
      pendingLeaves:
        currentLeaves.filter(
          (l) =>
            l.status === "PENDING"
        ).length,
      rejectedLeaves:
        currentLeaves.filter(
          (l) =>
            l.status === "REJECTED"
        ).length,
      latestNetSalary:
        salaryTrend.at(-1)?.netSalary ??
        null,
      averageNetSalary:
        salaryTrend.length
          ? round(
              salaryTrend.reduce(
                (sum, p) =>
                  sum + p.netSalary,
                0
              ) /
                salaryTrend.length
            )
          : null,
    },

    monthlyComparison: {
      current: {
        label: current.label,
        attendanceRate:
          current.attendanceRate,
        avgHours: current.avgHours,
        late: current.late,
      },

      previous: {
        label: previous.label,
        attendanceRate:
          previous.attendanceRate,
        avgHours: previous.avgHours,
        late: previous.late,
      },

      delta: {
        attendancePoints: round(
          current.attendanceRate -
            previous.attendanceRate,
          1
        ),
        avgHours: round(
          current.avgHours -
            previous.avgHours,
          2
        ),
        late:
          current.late -
          previous.late,
      },
    },

    attendanceTrend,

    dailyWorkingHours,

    attendanceRecords:
      attendance
        .filter((item) =>
          dateInRange(
            item.date,
            currentMonthStart,
            currentMonthEnd
          )
        )
        .map((item) => ({
          date: item.date,
          status: item.status,
          checkIn: item.checkIn,
          checkOut: item.checkOut,
          workingHours:
            item.workingHours,
          dayType: item.dayType,
        })),

    leaves: currentLeaves.map(
      (l) => ({
        type: l.type,
        startDate: l.startDate,
        endDate: l.endDate,
        status: l.status,
      })
    ),

    leaveStats,

    salaryTrend,

    activity,

    availability: {
      attritionRisk: null,
      engagementScore: null,
    },
  };
};

export const buildAdminAnalytics =
  async (headcountRange = "1y") => {
    let monthCount = headcountRange === "5m" ? 5 : 12;
    if (headcountRange === "all") {
      const earliest = await Employee.findOne({ isDeleted: { $ne: true }, joinDate: { $type: "date" } }).sort({ joinDate: 1 }).select("joinDate").lean();
      if (earliest?.joinDate) {
        const current = getIndiaMonthRange();
        const first = new Date(earliest.joinDate);
        const currentParts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric", month: "numeric" }).formatToParts(current.start);
        const y = Number(currentParts.find((part) => part.type === "year")?.value);
        const m = Number(currentParts.find((part) => part.type === "month")?.value);
        const fy = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric" }).format(first));
        const fm = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", month: "numeric" }).format(first));
        monthCount = Math.max(1, Math.min(240, (y - fy) * 12 + (m - fm) + 1));
      }
    }
    const months = monthDefinitions(monthCount);

    const rangeStart =
      months[0].start;

    const rangeEnd =
      months.at(-1).end;

    const {
      start: todayStart,
      end: todayEnd,
    } = getIndiaDayRange();

    const [
      employees,
      attendance,
      leaves,
      payslips,
      holidays,
      todayRecords,
    ] = await Promise.all([
      Employee.find({
        isDeleted: { $ne: true },
      })
        .select(
          "firstName lastName department employmentStatus joinDate basicSalary allowance deductions"
        )
        .lean()
        .then((rows) => withCurrentSalary(rows)),

      Attendance.find({
        date: {
          $gte: rangeStart,
          $lt: rangeEnd,
        },
      })
        .populate(
          "employeeId",
          "firstName lastName department joinDate employmentStatus isDeleted"
        )
        .lean(),

      LeaveApplication.find({
        createdAt: {
          $gte: rangeStart,
          $lt: rangeEnd,
        },
      }).lean(),

      Payslip.find({
        ...PUBLISHED,
        createdAt: {
          $gte: rangeStart,
          $lt: rangeEnd,
        },
      }).lean(),

      Holiday.find({
        date: {
          $gte: rangeStart,
          $lt: rangeEnd,
        },
      }).lean(),

      Attendance.find({
        date: {
          $gte: todayStart,
          $lt: todayEnd,
        },
      })
        .populate(
          "employeeId",
          "firstName lastName department"
        )
        .lean(),
    ]);

    const weeklyOffDays = await getWeeklyOffDays();

    const activeEmployees =
      employees.filter(
        (e) =>
          e.employmentStatus ===
          "ACTIVE"
      );

    const holidayKeys = new Set(
      holidays.map((h) =>
        indiaDateKey(h.date)
      )
    );

    const attendanceByEmployeeDay =
      new Map(
        attendance
          .filter(
            (record) =>
              record.employeeId
          )
          .map((record) => [
            `${record.employeeId._id.toString()}-${indiaDateKey(
              record.date
            )}`,
            record,
          ])
      );

    const leaveByEmployee =
      new Map();

    const approvedLeaves =
      await LeaveApplication.find({
        status: "APPROVED",
        startDate: {
          $lt: rangeEnd,
        },
        endDate: {
          $gte: rangeStart,
        },
      })
        .select(
          "employeeId startDate endDate"
        )
        .lean();

    approvedLeaves.forEach(
      (leave) => {
        const key =
          leave.employeeId.toString();

        if (
          !leaveByEmployee.has(key)
        ) {
          leaveByEmployee.set(
            key,
            []
          );
        }

        leaveByEmployee
          .get(key)
          .push(leave);
      }
    );

    const monthStats = months.map(
      (month) => {
        const days = eachDay(
          month.start,
          month.end
        );

        let expected = 0;
        let attended = 0;
        let late = 0;
        let absent = 0;
        let hours = 0;
        let completed = 0;

        activeEmployees.forEach(
          (employee) => {
            const employeeJoinDate =
              new Date(
                employee.joinDate
              );

            days
              .filter(
                (day) =>
                  isWorkday(
                    day,
                    holidayKeys,
                    weeklyOffDays
                  ) &&
                  day.date >=
                    employeeJoinDate &&
                  day.date <
                    (month.key ===
                    monthKey(
                      todayStart
                    )
                      ? todayStart
                      : month.end)
              )
              .forEach((day) => {
                const employeeLeaves =
                  leaveByEmployee.get(
                    employee._id.toString()
                  ) || [];

                const onLeave =
                  employeeLeaves.some(
                    (leave) =>
                      day.key >=
                        indiaDateKey(
                          leave.startDate
                        ) &&
                      day.key <=
                        indiaDateKey(
                          leave.endDate
                        )
                  );

                if (onLeave) {
                  return;
                }

                expected += 1;

                const record =
                  attendanceByEmployeeDay.get(
                    `${employee._id.toString()}-${day.key}`
                  );

                if (
                  record?.status ===
                  "LATE"
                ) {
                  attended += 1;
                  late += 1;
                } else if (
                  record?.status ===
                  "PRESENT"
                ) {
                  attended += 1;
                } else {
                  absent += 1;
                }

                if (
                  Number.isFinite(
                    record?.workingHours
                  )
                ) {
                  hours += Number(
                    record.workingHours
                  );
                  completed += 1;
                }
              });
          }
        );

        return {
          label: month.label,
          expected,
          attended,
          late,
          absent,
          attendanceRate: expected
            ? round(
                (attended /
                  expected) *
                  100,
                1
              )
            : 0,
          avgHours: completed
            ? round(
                hours /
                  completed
              )
            : 0,
        };
      }
    );

    const departmentDistribution =
      DEPARTMENTS.map(
        (department) => {
          const members =
            employees.filter(
              (e) =>
                e.department ===
                department
            );

          return {
            department,
            count: members.length,
            percentage:
              employees.length
                ? round(
                    (members.length /
                      employees.length) *
                      100,
                    1
                  )
                : 0,

            payrollBase: round(
              members.reduce(
                (sum, e) =>
                  sum +
                  Number(
                    e.basicSalary ||
                      0
                  ) +
                  Number(
                    e.allowance ||
                      0
                  ) -
                  Number(
                    e.deductions ||
                      0
                  ),
                0
              )
            ),
          };
        }
      ).filter(
        (item) => item.count
      );

    const leaveTrend =
      months.map((month) => {
        const rows = leaves.filter(
          (leave) =>
            dateInRange(
              leave.createdAt,
              month.start,
              month.end
            )
        );

        return {
          label: month.label,
          total: rows.length,
          approved: rows.filter(
            (l) =>
              l.status ===
              "APPROVED"
          ).length,
          pending: rows.filter(
            (l) =>
              l.status ===
              "PENDING"
          ).length,
          rejected: rows.filter(
            (l) =>
              l.status ===
              "REJECTED"
          ).length,
        };
      });

    const payrollTrend =
      months.map((month) => {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "numeric",
        }).formatToParts(new Date(month.start));
        const year = Number(parts.find((p) => p.type === "year")?.value);
        const monthNumber = Number(parts.find((p) => p.type === "month")?.value);
        const rows = payslips.filter(
          (p) => Number(p.year) === year && Number(p.month) === monthNumber
        );

        const total = rows.reduce(
          (sum, p) =>
            sum +
            Number(
              p.netSalary || 0
            ),
          0
        );

        return {
          label: month.label,
          totalNet: round(total),
          averageNet: rows.length
            ? round(
                total /
                  rows.length
              )
            : 0,
          payslips: rows.length,
        };
      });

    const todayKey =
      indiaDateKey(todayStart);

    const todayDay = {
      weekday: new Date(
        `${todayKey}T12:00:00+05:30`
      ).getDay(),
      key: todayKey,
    };

    const todayWorkingEmployees =
      activeEmployees.filter(
        (employee) =>
          new Date(
            employee.joinDate
          ) <= todayStart &&
          isWorkday(
            todayDay,
            holidayKeys,
            weeklyOffDays
          )
      );

    const todayPresent =
      todayRecords.filter(
        (record) =>
          [
            "PRESENT",
            "LATE",
          ].includes(record.status)
      ).length;

    const todayLate =
      todayRecords.filter(
        (record) =>
          record.status ===
          "LATE"
      ).length;

    const todayOnLeave =
      approvedLeaves.filter(
        (leave) =>
          todayKey >=
            indiaDateKey(
              leave.startDate
            ) &&
          todayKey <=
            indiaDateKey(
              leave.endDate
            )
      ).length;

    const newHiresThisMonth =
      employees.filter(
        (employee) =>
          dateInRange(
            employee.joinDate,
            getIndiaMonthRange()
              .start,
            getIndiaMonthRange()
              .end
          )
      ).length;

    const pendingLeaves =
      await LeaveApplication.find({
        status: "PENDING",
      })
        .populate(
          "employeeId",
          "firstName lastName department"
        )
        .sort({ createdAt: -1 })
        .limit(8)
        .lean();

    const recentEmployees =
      await Employee.find({
        isDeleted: {
          $ne: true,
        },
      })
        .sort({ updatedAt: -1 })
        .limit(6)
        .select(
          "firstName lastName department employmentStatus updatedAt"
        )
        .lean();

    const activity = [
      ...recentEmployees.map(
        (employee) => ({
          type: "employee",
          date: employee.updatedAt,
          title: `${employee.firstName} ${employee.lastName} updated`,
          description: `${
            employee.department ||
            "Employee"
          } · ${
            employee.employmentStatus
          }`,
        })
      ),

      ...pendingLeaves
        .slice(0, 5)
        .map((leave) => ({
          type: "leave",
          date: leave.createdAt,
          title: `${
            leave.employeeId
              ?.firstName ||
            "Employee"
          } submitted leave`,
          description: `${
            leave.type
          } · ${indiaDateKey(
            leave.startDate
          )} – ${indiaDateKey(
            leave.endDate
          )}`,
        })),
    ]
      .sort(
        (a, b) =>
          new Date(b.date) -
          new Date(a.date)
      )
      .slice(0, 10);

    return {
      role: "ADMIN",

      summary: {
        headcount:
          employees.length,

        activeEmployees:
          activeEmployees.length,

        inactiveEmployees:
          employees.length -
          activeEmployees.length,

        departments:
          departmentDistribution.length,

        newHiresThisMonth,

        todayAttendance:
          todayPresent,

        todayLate,

        todayOnLeave,

        attendanceRateToday:
          todayWorkingEmployees.length
            ? round(
                (todayPresent /
                  Math.max(
                    1,
                    todayWorkingEmployees.length -
                      todayOnLeave
                  )) *
                  100,
                1
              )
            : 0,

        pendingLeaves:
          pendingLeaves.length,

        leaveRequests12Months:
          leaves.length,

        leaveApprovalRate:
          leaves.length
            ? round(
                (leaves.filter(
                  (leave) =>
                    leave.status ===
                    "APPROVED"
                ).length /
                  leaves.length) *
                  100,
                1
              )
            : 0,

        payroll12Months: round(
          payslips.reduce(
            (sum, payslip) =>
              sum +
              Number(
                payslip.netSalary ||
                  0
              ),
            0
          )
        ),

        attritionRate: null,
      },

      headcountTrend:
        months.map((month) => ({
          label: month.label,
          count: employees.filter(
            (employee) =>
              new Date(employee.joinDate) < month.end &&
              (month.key !== monthKey(todayStart) || new Date(employee.joinDate) <= todayStart)
          ).length,
        })),

      departmentDistribution,

      attendanceTrend:
        monthStats.slice(-5),

      leaveTrend,

      payrollTrend: payrollTrend.slice(-5),

      today: todayRecords.map(
        (item) => ({
          employee:
            item.employeeId
              ? `${item.employeeId.firstName} ${item.employeeId.lastName}`
              : "Unknown",

          department:
            item.employeeId
              ?.department || "—",

          status: item.status,

          workingHours:
            item.workingHours,
        })
      ),

      pendingLeaveRequests:
        pendingLeaves.map(
          (leave) => ({
            id: leave._id.toString(),

            employee:
              leave.employeeId
                ? `${leave.employeeId.firstName} ${leave.employeeId.lastName}`
                : "Unknown",

            department:
              leave.employeeId
                ?.department || "—",

            type: leave.type,

            startDate:
              leave.startDate,

            endDate:
              leave.endDate,

            status:
              leave.status,
          })
        ),

      activity,

      availability: {
        attritionRate: null,
        engagementScore: null,

        reason:
          "The current EMS does not yet store recruitment or engagement datasets, so these metrics are not fabricated.",
      },
    };
  };

export const getAnalytics = async (
  req,
  res
) => {
  try {
    if (
      req.session.role ===
      "ADMIN"
    ) {
      const headcountRange = String(req.query.headcountRange || "1y");
      if (!["5m", "1y", "all"].includes(headcountRange)) return res.status(400).json({ error: "Unsupported headcount range" });
      return res.json(
        await buildAdminAnalytics(headcountRange)
      );
    }

    const employee =
      await Employee.findOne({
        userId: req.session.userId,
        isDeleted: {
          $ne: true,
        },
      }).lean();

    if (!employee) {
      return res
        .status(404)
        .json({
          error:
            "Employee not found",
        });
    }

    return res.json(
      await buildEmployeeAnalytics(
        employee
      )
    );
  } catch (error) {
    console.error(
      "Analytics error:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          "Failed to load analytics",
      });
  }
};