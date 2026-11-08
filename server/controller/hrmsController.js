import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { sendEmailSafely } from "../config/notmailer.js";
import { performanceReviewAssignedEmail } from "../utils/emailTemplates.js";
import Employee from "../models/Employee.js";
import HRDocument from "../models/HRDocument.js";
import PerformanceReview from "../models/PerformanceReview.js";
import ApprovalRequest from "../models/ApprovalRequest.js";
import HRLifecycleEvent from "../models/HRLifecycleEvent.js";
import HRAuditEvent from "../models/HRAuditEvent.js";
import LeaveApplication from "../models/LeaveApplication.js";

import { releaseLeaveBalance } from "../services/leaveBalances.js";
import { invalidateAuthCache } from "../middleware/auth.js";
import { notifyUsers } from "../utils/notifications.js";

const validId = (v) => mongoose.Types.ObjectId.isValid(v);

const fail = (res, message, status = 400) =>
  res.status(status).json({ success: false, error: message });

const ownEmployee = async (userId) =>
  Employee.findOne({ userId, isDeleted: { $ne: true } })
    .select("_id")
    .lean();

const audit = (req, action, resourceType, resourceId = "", metadata = {}) =>
  HRAuditEvent.create({
    actor: req.session.userId,
    employee: validId(metadata?.employee) ? metadata.employee : null,
    action,
    resourceType,
    resourceId: String(resourceId || ""),
    metadata,
    ip: req.ip,
  }).catch((e) => console.error("HR audit write failed:", e.message));

export async function listDocuments(req, res) {
  try {
    const filter = {};

    if (req.session.role !== "ADMIN") {
      const emp = await ownEmployee(req.session.userId);

      if (!emp) {
        return fail(res, "Employee profile not found", 404);
      }

      filter.employee = emp._id;
    } else if (req.query.employee) {
      if (!validId(req.query.employee)) {
        return fail(res, "Invalid employee ID");
      }

      filter.employee = req.query.employee;
    }

    const data = await HRDocument.find(filter)
      .populate("employee", "firstName lastName department")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({ data });
  } catch (e) {
    console.error("Document list failed:", e);
    return fail(res, "Unable to load documents.", 500);
  }
}

/**
 * Upload an HR document.
 *
 * Idempotency:
 * - The frontend sends an Idempotency-Key header.
 * - A retry with the same key returns the already-created document.
 * - HRDocument's unique sparse index prevents duplicate records for the key.
 * - A duplicate-key race is handled by returning the existing document.
 */
export async function uploadDocument(req, res) {
  let uploaded = null;

  try {
    const {
      employee,
      title,
      category = "OTHER",
      expiresAt,
      notes = "",
    } = req.body || {};

    if (!title || !String(title).trim() || !req.file) {
      return fail(res, "Document title and a file are required.");
    }

    // The frontend already sends this header.
    // Supporting the body field also helps older clients migrate.
    const uploadRequestId = String(
      req.get("Idempotency-Key") ||
        req.body?.uploadRequestId ||
        "",
    ).trim();

    if (
      uploadRequestId.length < 8 ||
      uploadRequestId.length > 128 ||
      !/^[a-zA-Z0-9._:-]+$/.test(uploadRequestId)
    ) {
      return fail(
        res,
        "A valid Idempotency-Key is required. Please refresh the upload form and try again.",
        400,
      );
    }

    let targetEmployee = employee;

    if (req.session.role !== "ADMIN") {
      const own = await ownEmployee(req.session.userId);

      if (!own) {
        return fail(res, "Employee profile not found", 404);
      }

      targetEmployee = own._id;
    }

    if (!validId(targetEmployee)) {
      return fail(res, "Select a valid employee.");
    }

    // Check the idempotency key before uploading to Cloudinary.
    const existingUpload = await HRDocument.findOne({
      uploadRequestId,
    }).lean();

    if (existingUpload) {
      // Do not allow a request ID belonging to another employee
      // to disclose or return another employee's document.
      if (
        String(existingUpload.employee) !== String(targetEmployee)
      ) {
        return fail(
          res,
          "This upload request ID has already been used.",
          409,
        );
      }

      return res.status(200).json({
        data: existingUpload,
        duplicate: true,
        message: "This document upload was already completed.",
      });
    }

    // Validate the employee before contacting Cloudinary.
    const employeeExists = await Employee.exists({
      _id: targetEmployee,
      isDeleted: { $ne: true },
    });

    if (!employeeExists) {
      return fail(res, "Employee not found", 404);
    }

    // Validate file buffer and size.
    if (!req.file.buffer || !Buffer.isBuffer(req.file.buffer)) {
      return fail(
        res,
        "The uploaded file could not be read. Please try again.",
        400,
      );
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    if (req.file.size > MAX_FILE_SIZE) {
      return fail(res, "File size must not exceed 10 MB.", 413);
    }

    const bytes = req.file.buffer;

    const isPdf =
      req.file.mimetype === "application/pdf" &&
      bytes.subarray(0, 5).toString() === "%PDF-";

    const isJpeg =
      req.file.mimetype === "image/jpeg" &&
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;

    const isPng =
      req.file.mimetype === "image/png" &&
      bytes.length >= 8 &&
      bytes
        .subarray(0, 8)
        .equals(
          Buffer.from([
            137, 80, 78, 71, 13, 10, 26, 10,
          ]),
        );

    if (!isPdf && !isJpeg && !isPng) {
      return fail(
        res,
        "File content does not match an allowed PDF, JPG or PNG format.",
        415,
      );
    }

    const allowedCategories = [
      "OFFER_LETTER",
      "CONTRACT",
      "IDENTITY",
      "EDUCATION",
      "EXPERIENCE",
      "SALARY_LETTER",
      "POLICY",
      "OTHER",
    ];

    if (!allowedCategories.includes(category)) {
      return fail(res, "Invalid document category.");
    }

    let parsedExpiry = null;

    if (expiresAt) {
      parsedExpiry = new Date(expiresAt);

      if (Number.isNaN(parsedExpiry.getTime())) {
        return fail(res, "Invalid document expiry date.");
      }
    }

    const cleanNotes = String(notes || "").trim().slice(0, 1000);
    const cleanTitle = String(title).trim().slice(0, 160);

    const {
      CLOUDINARY_CLOUD_NAME: cloud,
      CLOUDINARY_API_KEY: key,
      CLOUDINARY_API_SECRET: secret,
    } = process.env;

    if (!cloud || !key || !secret) {
      return fail(
        res,
        "Document storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
        503,
      );
    }

    // Cloudinary authenticated upload.
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = "ems/hr-documents";

    const params = `folder=${folder}&timestamp=${timestamp}&type=authenticated${secret}`;

    const signature = createHash("sha1")
      .update(params)
      .digest("hex");

    const form = new FormData();

    form.append(
      "file",
      new Blob([bytes], { type: req.file.mimetype }),
      req.file.originalname || "document",
    );

    form.append("api_key", key);
    form.append("timestamp", timestamp);
    form.append("folder", folder);
    form.append("type", "authenticated");
    form.append("signature", signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`,
      {
        method: "POST",
        body: form,
      },
    );

    uploaded = await response.json();

    if (!response.ok || !uploaded.public_id) {
      console.error(
        "Cloudinary upload failed:",
        uploaded.error?.message || response.status,
      );

      return fail(
        res,
        "Secure document upload failed. Please retry.",
        502,
      );
    }

    let doc;

    try {
      doc = await HRDocument.create({
        employee: targetEmployee,
        title: cleanTitle,
        category,
        publicId: uploaded.public_id,
        resourceType: uploaded.resource_type || "raw",
        format: uploaded.format || "",
        expiresAt: parsedExpiry,
        notes: cleanNotes,
        uploadedBy: req.session.userId,
        uploadRequestId,
      });
    } catch (createError) {
      // Another request with the same key may have completed
      // between our initial lookup and this database insert.
      if (createError?.code === 11000) {
        const duplicate = await HRDocument.findOne({
          uploadRequestId,
        }).lean();

        if (duplicate) {
          if (
            String(duplicate.employee) !== String(targetEmployee)
          ) {
            return fail(
              res,
              "This upload request ID has already been used.",
              409,
            );
          }

          return res.status(200).json({
            data: duplicate,
            duplicate: true,
            message: "This document upload was already completed.",
          });
        }
      }

      throw createError;
    }

    await audit(
      req,
      "DOCUMENT_UPLOADED",
      "HRDocument",
      doc._id,
      {
        employee: targetEmployee,
        publicId: uploaded.public_id,
        uploadRequestId,
      },
    );

    const employeeRecord = await Employee.findById(targetEmployee)
      .select("userId")
      .lean();

    if (employeeRecord?.userId) {
      await notifyUsers({
        userIds: [employeeRecord.userId],
        type: "DOCUMENT",
        title: "Document uploaded",
        message: `${cleanTitle} has been added to your employee documents.`,
        link: "/hrms",
      }).catch((e) =>
        console.error(
          "Document upload notification failed:",
          e.message,
        ),
      );
    }

    return res.status(201).json({
      data: doc,
      duplicate: false,
    });
  } catch (e) {
    console.error("HR document upload failed:", e);

    return fail(
      res,
      "Document upload failed. Please try again.",
      500,
    );
  }
}

export async function downloadDocument(req, res) {
  try {
    const doc = await HRDocument.findById(req.params.id).lean();

    if (!doc) {
      return fail(res, "Document not found", 404);
    }

    if (req.session.role !== "ADMIN") {
      const emp = await ownEmployee(req.session.userId);

      if (!emp || String(emp._id) !== String(doc.employee)) {
        return fail(res, "Access denied", 403);
      }
    }

    const {
      CLOUDINARY_CLOUD_NAME: cloud,
      CLOUDINARY_API_KEY: key,
      CLOUDINARY_API_SECRET: secret,
    } = process.env;

    if (!cloud || !key || !secret) {
      return fail(res, "Document storage is not configured.", 503);
    }

    if (!doc.publicId || !doc.format) {
      return fail(
        res,
        "This document has no secure storage reference. Please ask an administrator to upload it again.",
        410,
      );
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 60;

    const resourceType = [
      "image",
      "raw",
      "video",
    ].includes(doc.resourceType)
      ? doc.resourceType
      : "raw";

    const params = {
      expires_at: expiresAt,
      format: doc.format,
      public_id: doc.publicId,
      timestamp: Math.floor(Date.now() / 1000),
      type: "authenticated",
    };

    const canonical = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");

    const signature = createHash("sha1")
      .update(canonical + secret)
      .digest("hex");

    const query = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [
          k,
          String(v),
        ]),
      ),
      api_key: key,
      signature,
    });

    const url = `https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/download?${query.toString()}`;

    res.set("Cache-Control", "no-store");

    return res.json({ url, expiresAt });
  } catch (e) {
    console.error("Document download failed:", e);
    return fail(res, "Unable to generate document download link.", 502);
  }
}

export async function verifyDocument(req, res) {
  try {
    const { status, notes = "" } = req.body || {};

    if (!["VERIFIED", "REJECTED", "PENDING"].includes(status)) {
      return fail(res, "Invalid verification status");
    }

    const reason = String(notes).trim().slice(0, 1000);

    if (status === "REJECTED" && !reason) {
      return fail(res, "A rejection reason is required.");
    }

    const doc = await HRDocument.findByIdAndUpdate(
      req.params.id,
      {
        verificationStatus: status,
        notes: reason,
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    if (!doc) {
      return fail(res, "Document not found", 404);
    }

    await audit(
      req,
      "DOCUMENT_" + status,
      "HRDocument",
      doc._id,
      {
        employee: doc.employee,
        reason,
      },
    );

    const employee = await Employee.findById(doc.employee)
      .select("userId")
      .lean();

    if (employee?.userId) {
      await notifyUsers({
        userIds: [employee.userId],
        type: "DOCUMENT",
        title: `Document ${status.toLowerCase()}`,
        message: `Your document "${doc.title}" was ${status.toLowerCase()}.${reason ? ` Reason: ${reason}` : ""}`,
        link: "/hrms",
      }).catch((e) =>
        console.error(
          "Document verification notification failed:",
          e.message,
        ),
      );
    }

    return res.json({ data: doc });
  } catch (e) {
    console.error("Document verification failed:", e);
    return fail(res, "Unable to update document verification.", 500);
  }
}

export async function listReviews(req, res) {
  try {
    const filter = {};

    if (req.session.role !== "ADMIN") {
      const emp = await ownEmployee(req.session.userId);

      if (!emp) {
        return fail(res, "Employee profile not found", 404);
      }

      filter.employee = emp._id;
    } else if (req.query.employee) {
      if (!validId(req.query.employee)) {
        return fail(res, "Invalid employee ID");
      }

      filter.employee = req.query.employee;
    }

    const data = await PerformanceReview.find(filter)
      .populate("employee", "firstName lastName department position")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({ data });
  } catch (e) {
    return fail(res, e.message, 500);
  }
}

export async function acknowledgeReview(req, res) {
  try {
    const emp = await ownEmployee(req.session.userId);

    if (!emp) {
      return fail(res, "Employee profile not found", 404);
    }

    const { comment = "" } = req.body || {};

    const doc = await PerformanceReview.findOneAndUpdate(
      {
        _id: req.params.id,
        employee: emp._id,
        status: "SUBMITTED",
      },
      {
        $set: {
          status: "ACKNOWLEDGED",
          employeeComments: String(comment).slice(0, 3000),
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    if (!doc) {
      return fail(
        res,
        "Submitted review not found or already acknowledged.",
        404,
      );
    }

    await audit(
      req,
      "PERFORMANCE_REVIEW_ACKNOWLEDGED",
      "PerformanceReview",
      doc._id,
      { employee: emp._id },
    );

    return res.json({ data: doc });
  } catch (e) {
    return fail(res, e.message);
  }
}

export async function saveReview(req, res) {
  try {
    const b = req.body || {};

    if (!validId(b.employee) || !b.period?.trim()) {
      return fail(res, "Employee and review period are required.");
    }

    if (
      b.rating !== null &&
      b.rating !== undefined &&
      b.rating !== ""
    ) {
      const rating = Number(b.rating);

      if (
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      ) {
        return fail(
          res,
          "Rating must be a whole number between 1 and 5.",
        );
      }

      b.rating = rating;
    }

    const employeeExists = await Employee.exists({
      _id: b.employee,
      isDeleted: { $ne: true },
    });

    if (!employeeExists) {
      return fail(res, "Employee not found.", 404);
    }

    const period = b.period.trim();

    const update = {
      employee: b.employee,
      period,
      reviewer: req.session.userId,
      goals: Array.isArray(b.goals)
        ? b.goals.slice(0, 30)
        : [],
      rating: b.rating === "" ? null : (b.rating ?? null),
      strengths: String(b.strengths || "").slice(0, 3000),
      improvements: String(b.improvements || "").slice(0, 3000),
      status: b.status === "SUBMITTED" ? "SUBMITTED" : "DRAFT",
    };

    const existing = await PerformanceReview.findOne({
      employee: b.employee,
      period,
    });

    if (existing?.status === "ACKNOWLEDGED") {
      return fail(
        res,
        "This review has already been acknowledged and cannot be edited.",
        409,
      );
    }

    let doc;
    let created = false;

    if (existing) {
      doc = await PerformanceReview.findOneAndUpdate(
        {
          _id: existing._id,
          status: { $ne: "ACKNOWLEDGED" },
        },
        { $set: update },
        {
          returnDocument: "after",
          runValidators: true,
        },
      );

      if (!doc) {
        return fail(
          res,
          "This review has already been acknowledged and cannot be edited.",
          409,
        );
      }
    } else {
      try {
        doc = await PerformanceReview.create(update);
        created = true;
      } catch (error) {
        if (error.code !== 11000) {
          throw error;
        }

        const duplicate = await PerformanceReview.findOne({
          employee: b.employee,
          period,
        });

        if (!duplicate) {
          throw error;
        }

        if (duplicate.status === "ACKNOWLEDGED") {
          return fail(
            res,
            "This review has already been acknowledged and cannot be edited.",
            409,
          );
        }

        return res.status(200).json({
          data: duplicate,
          duplicate: true,
          message: "A review already exists for this employee and period.",
        });
      }
    }

    await audit(
  req,
  "PERFORMANCE_REVIEW_SAVED",
  "PerformanceReview",
  doc._id,
  { employee: b.employee },
);

// Send notifications only when a NEW review is created
if (created) {
  try {
    const targetEmployee = await Employee.findById(b.employee)
      .select("userId firstName email");

    if (targetEmployee) {
      // In-app notification
      if (targetEmployee.userId) {
        await notifyUsers({
          userIds: [targetEmployee.userId],
          type: "PERFORMANCE",
          title: "New performance review assigned",
          message: `A new performance review has been assigned to you for ${period}.`,
          link: "/hrms",
        });
      }

      // Email notification
      if (targetEmployee.email) {
        await sendEmailSafely({
          to: targetEmployee.email,
          ...performanceReviewAssignedEmail({
            firstName: targetEmployee.firstName,
            period,
          }),
        });
      }
    }
  } catch (notificationError) {
    // Notification failure should not prevent saving the review
    console.error(
      "Performance review notification failed:",
      notificationError,
    );
  }
}

return res.status(created ? 201 : 200).json({
  data: doc,
  duplicate: false,
});
    return res.status(created ? 201 : 200).json({
      data: doc,
      duplicate: false,
    });
  } catch (e) {
    console.error("Performance review save failed:", e);

    return fail(
      res,
      e.code === 11000
        ? "A review already exists for this employee and period."
        : "Unable to save performance review.",
      e.code === 11000 ? 409 : 500,
    );
  }
}

export async function addApproval(req, res) {
  try {
    const b = req.body || {};

    if (
      !["LEAVE", "DOCUMENT_VERIFICATION", "OTHER"].includes(b.type) ||
      !b.title?.trim()
    ) {
      return fail(res, "A valid request type and title are required");
    }

    let employee = null;

    if (
      req.session.role === "ADMIN" &&
      b.employee &&
      validId(b.employee)
    ) {
      employee = b.employee;
    } else {
      const emp = await ownEmployee(req.session.userId);

      if (!emp) {
        return fail(res, "Employee profile not found", 404);
      }

      employee = emp._id;
    }

    const payload =
      b.payload &&
      typeof b.payload === "object" &&
      !Array.isArray(b.payload)
        ? b.payload
        : {};

    if (b.type === "LEAVE") {
      if (!validId(payload.leaveApplicationId)) {
        return fail(res, "Select a valid pending leave application.");
      }

      const leave = await LeaveApplication.findOne({
        _id: payload.leaveApplicationId,
        employeeId: employee,
        status: "PENDING",
      })
        .select("_id")
        .lean();

      if (!leave) {
        return fail(
          res,
          "Pending leave application not found for this employee.",
          404,
        );
      }
    }

    if (b.type === "DOCUMENT_VERIFICATION") {
      if (!validId(payload.documentId)) {
        return fail(
          res,
          "Select a valid document to request verification.",
        );
      }

      const doc = await HRDocument.findOne({
        _id: payload.documentId,
        employee,
      })
        .select("_id")
        .lean();

      if (!doc) {
        return fail(
          res,
          "Document not found for this employee.",
          404,
        );
      }
    }

    const doc = await ApprovalRequest.create({
      requester: req.session.userId,
      employee,
      type: b.type,
      title: b.title.trim(),
      description: String(b.description || "").slice(0, 3000),
      payload,
    });

    await audit(
      req,
      "APPROVAL_REQUEST_CREATED",
      "ApprovalRequest",
      doc._id,
      { employee },
    );

    return res.status(201).json({ data: doc });
  } catch (e) {
    return fail(res, e.message);
  }
}

export async function listApprovals(req, res) {
  try {
    const filter =
      req.session.role === "ADMIN"
        ? {}
        : { requester: req.session.userId };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const data = await ApprovalRequest.find(filter)
      .populate("employee", "firstName lastName department")
      .populate("requester", "email")
      .populate("reviewer", "email")
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();

    return res.json({ data });
  } catch (e) {
    return fail(res, e.message, 500);
  }
}

export async function reviewApproval(req, res) {
  try {
    const { status, comment = "" } = req.body || {};

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return fail(res, "Status must be APPROVED or REJECTED");
    }

    const approval = await ApprovalRequest.findOne({
      _id: req.params.id,
      status: "PENDING",
    });

    if (!approval) {
      return fail(
        res,
        "Pending approval request not found; it may already have been reviewed.",
        409,
      );
    }

    if (String(approval.requester) === String(req.session.userId)) {
      return fail(res, "You cannot review your own request.", 403);
    }

    const note = String(comment).trim().slice(0, 1000);

    if (status === "REJECTED" && !note) {
      return fail(res, "A rejection reason is required.");
    }

    if (approval.type === "LEAVE") {
      const leave = await LeaveApplication.findOne({
        _id: approval.payload?.leaveApplicationId,
        employeeId: approval.employee,
        status: "PENDING",
      });

      if (!leave) {
        return fail(
          res,
          "The linked leave request is no longer pending.",
          409,
        );
      }

      const year = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
        }).format(leave.startDate),
      );

      await releaseLeaveBalance(
        leave.employeeId,
        year,
        leave.type,
        leave.paidDays,
        status === "APPROVED" ? "APPROVE" : "RELEASE",
      );

      leave.status = status;
      leave.reviewedBy = req.session.userId;
      leave.reviewedAt = new Date();
      leave.reviewNote =
        note ||
        (status === "REJECTED"
          ? "Rejected through HRMS approval centre"
          : "Approved through HRMS approval centre");

      await leave.save();

      await notifyUsers({
        userIds: [approval.requester],
        type: "LEAVE",
        title: `Leave ${status.toLowerCase()}`,
        message: `Your ${leave.type.toLowerCase()} leave request has been ${status.toLowerCase()}.${note ? ` ${note}` : ""}`,
        link: "/leave",
      }).catch((e) =>
        console.error(
          "Leave approval notification failed:",
          e.message,
        ),
      );
    } else if (approval.type === "DOCUMENT_VERIFICATION") {
      const document = await HRDocument.findOneAndUpdate(
        {
          _id: approval.payload?.documentId,
          employee: approval.employee,
        },
        {
          $set: {
            verificationStatus:
              status === "APPROVED" ? "VERIFIED" : "REJECTED",
            notes: note,
          },
        },
        { returnDocument: "after" },
      );

      if (!document) {
        return fail(
          res,
          "The linked document no longer exists.",
          404,
        );
      }
    }

    const doc = await ApprovalRequest.findOneAndUpdate(
      {
        _id: approval._id,
        status: "PENDING",
      },
      {
        $set: {
          status,
          reviewer: req.session.userId,
          reviewedAt: new Date(),
          reviewComment: note,
        },
      },
      { returnDocument: "after" },
    );

    if (!doc) {
      return fail(
        res,
        "This request was reviewed by another administrator.",
        409,
      );
    }

    await audit(
      req,
      "APPROVAL_" + status,
      "ApprovalRequest",
      doc._id,
      { employee: approval.employee },
    );

    return res.json({ data: doc });
  } catch (e) {
    console.error("Approval review failed:", e);
    return fail(res, "Unable to review approval request.", 500);
  }
}

export async function listLifecycle(req, res) {
  try {
    if (!validId(req.params.employeeId)) {
      return fail(res, "Invalid employee ID");
    }

    if (req.session.role !== "ADMIN") {
      const emp = await ownEmployee(req.session.userId);

      if (!emp || String(emp._id) !== req.params.employeeId) {
        return fail(res, "Access denied", 403);
      }
    }

    const data = await HRLifecycleEvent.find({
      employee: req.params.employeeId,
    })
      .sort({ effectiveDate: -1 })
      .populate("createdBy", "email")
      .lean();

    return res.json({ data });
  } catch (e) {
    return fail(res, e.message, 500);
  }
}

export async function addLifecycle(req, res) {
  let dedupeKey = "";

  try {
    const b = req.body || {};

    const allowed = [
      "JOINED",
      "PROBATION_STARTED",
      "CONFIRMED",
      "PROMOTED",
      "TRANSFERRED",
      "SALARY_REVISED",
      "RESIGNED",
      "NOTICE_STARTED",
      "TERMINATED",
      "CONTRACT_RENEWED",
      "REACTIVATED",
      "OTHER",
    ];

    const employeeId = String(b.employee || "").trim();
    const eventType = String(b.eventType || "").trim();
    const details = String(b.details || "").trim().slice(0, 2000);

    if (
      !validId(employeeId) ||
      !allowed.includes(eventType) ||
      !b.effectiveDate ||
      Number.isNaN(new Date(b.effectiveDate).getTime())
    ) {
      return fail(
        res,
        "Employee, supported event type and valid effective date are required.",
        400,
      );
    }

    const effectiveDate = new Date(b.effectiveDate);

    const fingerprint = JSON.stringify({
      employee: employeeId,
      eventType,
      effectiveDate: effectiveDate.toISOString(),
      details,
    });

    dedupeKey = createHash("sha256")
      .update(fingerprint)
      .digest("hex");

    const existingEvent = await HRLifecycleEvent.findOne({
      dedupeKey,
    });

    if (existingEvent) {
      return res.status(200).json({
        data: existingEvent,
        duplicate: true,
        message: "This lifecycle event has already been recorded.",
      });
    }

    const employee = await Employee.findOne({
      _id: employeeId,
      isDeleted: { $ne: true },
    });

    if (!employee) {
      return fail(res, "Active employee record not found.", 404);
    }

    const immediateEvents = [
      "RESIGNED",
      "TERMINATED",
      "REACTIVATED",
    ];

    if (
      immediateEvents.includes(eventType) &&
      effectiveDate.getTime() > Date.now()
    ) {
      return fail(
        res,
        "Future-dated employment status changes must be applied on their effective date.",
        400,
      );
    }

    const previousValue = {
      employmentStatus: employee.employmentStatus,
    };

    if (["RESIGNED", "TERMINATED"].includes(eventType)) {
      employee.employmentStatus = "INACTIVE";
    } else if (eventType === "REACTIVATED") {
      employee.employmentStatus = "ACTIVE";
    }

    const newValue = {
      employmentStatus: employee.employmentStatus,
    };

    const doc = await HRLifecycleEvent.create({
      employee: employeeId,
      eventType,
      effectiveDate,
      details,
      dedupeKey,
      previousValue,
      newValue,
      createdBy: req.session.userId,
    });

    try {
      if (employee.isModified("employmentStatus")) {
        await employee.save();
      }
    } catch (saveError) {
      await HRLifecycleEvent.deleteOne({
        _id: doc._id,
      }).catch(() => {});

      throw saveError;
    }

    if (immediateEvents.includes(eventType)) {
      invalidateAuthCache(String(employee.userId));
    }

    await audit(
      req,
      "LIFECYCLE_EVENT_CREATED",
      "HRLifecycleEvent",
      doc._id,
      {
        employee: employeeId,
        eventType,
        previousValue,
        newValue,
      },
    );

    return res.status(201).json({
      data: doc,
      employeeStatus: employee.employmentStatus,
      duplicate: false,
    });
  } catch (e) {
    if (e.code === 11000 && dedupeKey) {
      const existingEvent = await HRLifecycleEvent.findOne({
        dedupeKey,
      }).catch(() => null);

      if (existingEvent) {
        return res.status(200).json({
          data: existingEvent,
          duplicate: true,
          message: "This lifecycle event has already been recorded.",
        });
      }
    }

    console.error("Lifecycle event creation failed:", e);

    return fail(
      res,
      "Unable to record lifecycle event. Please try again.",
      500,
    );
  }
}

export async function listAudit(req, res) {
  try {
    const filter = {};

    if (req.query.employee) {
      if (!validId(req.query.employee)) {
        return fail(res, "Invalid employee ID");
      }

      filter.employee = req.query.employee;
    }

    if (req.query.action) {
      filter.action = String(req.query.action).slice(0, 100);
    }

    const limit = Math.min(
      Math.max(Number(req.query.limit) || 100, 1),
      300,
    );

    const data = await HRAuditEvent.find(filter)
      .populate("actor", "email")
      .populate("employee", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ data });
  } catch (e) {
    return fail(res, e.message, 500);
  }
}