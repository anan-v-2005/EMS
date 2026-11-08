
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  ClipboardCheck,
  GitPullRequest,
  History,
  RefreshCw,
  Plus,
  Check,
  X,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-[#DDE5DD] bg-white px-3 py-2.5 text-sm text-[#1F2A1F] outline-none focus:border-[#6B9B6E] focus:ring-2 focus:ring-[#6B9B6E]/15";

const label = "mb-1.5 block text-xs font-semibold text-[#536354]";

const Button = ({ children, ...props }) => (
  <button
    {...props}
    className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#4A7C59] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3F6B4C] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${props.className || ""}`}
  >
    {children}
  </button>
);

const Panel = ({ title, subtitle, children }) => (
  <section className="min-w-0 rounded-2xl border border-[#E3E8E1] bg-white p-4 shadow-sm sm:p-5">
    <div className="mb-4 min-w-0">
      <h2 className="font-semibold text-[#1F2A1F]">{title}</h2>
      {subtitle && (
        <p className="mt-1 break-words text-sm leading-6 text-[#718071]">
          {subtitle}
        </p>
      )}
    </div>
    {children}
  </section>
);

const Table = ({ headers, children }) => (
  <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-xl border border-[#E5EAE3]">
    <table className="w-full min-w-[700px] text-left text-sm">
      <thead className="bg-[#F7F9F6] text-xs uppercase tracking-wide text-[#687768]">
        <tr>
          {headers.map((h) => (
            <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-[#EDF0EB]">{children}</tbody>
    </table>
  </div>
);

const td = "px-4 py-3.5 align-middle text-[#435143]";

const date = (v) =>
  v
    ? new Date(v).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
      })
    : "—";

const empty = (
  <tr>
    <td
      className={`${td} py-10 text-center text-[#829082]`}
      colSpan={8}
    >
      No records found.
    </td>
  </tr>
);

export default function HRMSWorkspace() {
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";

  const tabs = useMemo(
    () => [
      { id: "documents", name: "Documents", icon: FileText },
      { id: "reviews", name: "Performance", icon: ClipboardCheck },
      { id: "approvals", name: "Approvals", icon: GitPullRequest },
      ...(admin
        ? [
            { id: "lifecycle", name: "Lifecycle", icon: Users },
            { id: "audit", name: "HR audit", icon: History },
          ]
        : []),
    ],
    [admin],
  );

  const [tab, setTab] = useState("documents");
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [busy, setBusy] = useState(false);

  // Document verification submission protection
  const [verifyingIds, setVerifyingIds] = useState(() => new Set());
  const verifyingLock = useRef(new Set());

  // Performance review submission protection
  const [savingReview, setSavingReview] = useState(false);
  const reviewSubmitLock = useRef(false);

  const [doc, setDoc] = useState({
    employee: "",
    title: "",
    category: "OTHER",
    expiresAt: "",
    notes: "",
    file: null,
  });

  // ============================================================
  // DOCUMENT UPLOAD DUPLICATE-SUBMISSION PROTECTION
  // ============================================================

  const [uploadingDoc, setUploadingDoc] = useState(false);

  const uploadDocLock = useRef(false);
  const uploadRequestId = useRef(null);

  // Generate a unique ID for one upload operation.
  const createUploadRequestId = () => {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}-${Math.random().toString(36).slice(2)}`;
  };

  // Changing any upload form field starts a new upload operation.
  const updateDocField = (field, value) => {
    uploadRequestId.current = null;

    setDoc((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const [review, setReview] = useState({
    employee: "",
    period: "",
    rating: "",
    strengths: "",
    improvements: "",
    goalsText: "",
  });

  const [approval, setApproval] = useState({
    type: "OTHER",
    title: "",
    description: "",
    leaveApplicationId: "",
    documentId: "",
  });

  const [myPendingLeaves, setMyPendingLeaves] = useState([]);
  const [myDocuments, setMyDocuments] = useState([]);

  const [life, setLife] = useState({
    employee: "",
    eventType: "JOINED",
    effectiveDate: new Date().toISOString().slice(0, 10),
    details: "",
  });

  // Load records for the selected tab
  const load = useCallback(async () => {
    setBusy(true);

    try {
      const endpoint = {
        documents: "/hrms/documents",
        reviews: "/hrms/performance-reviews",
        approvals: "/hrms/approvals",
        lifecycle: null,
        audit: "/hrms/audit",
      }[tab];

      if (tab === "lifecycle") {
        setRows([]);
        return;
      }

      const { data } = await api.get(endpoint, {
        params: { _refresh: Date.now() },
      });

      setRows(data?.data || []);
    } catch (e) {
      toast.error(
        e?.response?.data?.error || "Could not load HRMS records",
      );
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  // Load employee-specific approval information
  useEffect(() => {
    if (tab !== "approvals" || admin) return;

    Promise.all([api.get("/leave"), api.get("/hrms/documents")])
      .then(([leaveRes, docRes]) => {
        setMyPendingLeaves(
          (leaveRes.data?.data || []).filter(
            (x) => x.status === "PENDING",
          ),
        );

        setMyDocuments(docRes.data?.data || []);
      })
      .catch(() => {});
  }, [tab, admin]);

  // Load employees for administrator forms
  useEffect(() => {
    if (!admin) return;

    api
      .get("/employees")
      .then(({ data }) => {
        setEmployees(
          Array.isArray(data)
            ? data.filter((x) => !x.isDeleted)
            : [],
        );
      })
      .catch(() => {});
  }, [admin]);

  // General POST helper
  const send = async (url, body, message, reset) => {
    try {
      await api.post(url, body);

      toast.success(message);
      reset?.();

      await load();
    } catch (e) {
      toast.error(
        e?.response?.data?.error || "Unable to save",
      );
    }
  };

  // ============================================================
  // PERFORMANCE REVIEW SUBMISSION
  // ============================================================

  const handleReviewSubmit = async (e) => {
    e.preventDefault();

    if (reviewSubmitLock.current) return;

    const rating =
      review.rating === "" ? null : Number(review.rating);

    if (
      rating !== null &&
      (!Number.isInteger(rating) || rating < 1 || rating > 5)
    ) {
      toast.error(
        "Rating must be a whole number between 1 and 5.",
      );
      return;
    }

    if (!review.employee) {
      toast.error("Please select an employee.");
      return;
    }

    if (!review.period.trim()) {
      toast.error("Please enter the review period.");
      return;
    }

    reviewSubmitLock.current = true;
    setSavingReview(true);

    try {
      const goals = review.goalsText
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((title) => ({ title }));

      await send(
        "/hrms/performance-reviews",
        {
          employee: review.employee,
          period: review.period.trim(),
          rating,
          strengths: review.strengths,
          improvements: review.improvements,
          goals,
          status: "SUBMITTED",
        },
        "Performance review saved",
        () =>
          setReview({
            employee: "",
            period: "",
            rating: "",
            strengths: "",
            improvements: "",
            goalsText: "",
          }),
      );
    } finally {
      reviewSubmitLock.current = false;
      setSavingReview(false);
    }
  };

  // ============================================================
  // DOCUMENT UPLOAD WITH DUPLICATE-SUBMISSION PROTECTION
  // ============================================================

  const uploadDoc = async (event) => {
    event.preventDefault();

    // Stop a second submission while the first is running.
    if (uploadDocLock.current) return;

    if (!doc.file) {
      toast.error("Choose a PDF, JPG or PNG file first");
      return;
    }

    if (!doc.title.trim()) {
      toast.error("Please enter a document title.");
      return;
    }

    // Reuse the ID when retrying an unchanged failed upload.
    if (!uploadRequestId.current) {
      uploadRequestId.current = createUploadRequestId();
    }

    uploadDocLock.current = true;
    setUploadingDoc(true);

    const body = new FormData();

    Object.entries(doc).forEach(([key, value]) => {
      if (value !== null && value !== "") {
        body.append(
          key,
          key === "title" ? String(value).trim() : value,
        );
      }
    });

    try {
      await api.post("/hrms/documents/upload", body, {
        headers: {
          "Content-Type": "multipart/form-data",
          "Idempotency-Key": uploadRequestId.current,
        },
      });

      toast.success("Document uploaded securely");

      // Clear the request ID only after a successful upload.
      uploadRequestId.current = null;

      setDoc({
        employee: "",
        title: "",
        category: "OTHER",
        expiresAt: "",
        notes: "",
        file: null,
      });

      await load();
    } catch (e) {
      toast.error(
        e?.response?.data?.error || "Document upload failed",
      );

      // Keep the same ID after failure.
      // An unchanged retry will reuse the same request ID.
    } finally {
      uploadDocLock.current = false;
      setUploadingDoc(false);
    }
  };

  // Acknowledge performance review
  const acknowledge = async (id) => {
    const comment =
      window.prompt("Optional acknowledgement comment", "") ?? null;

    if (comment === null) return;

    try {
      await api.patch(
        `/hrms/performance-reviews/${id}/acknowledge`,
        { comment },
      );

      toast.success("Review acknowledged");
      await load();
    } catch (e) {
      toast.error(
        e?.response?.data?.error || "Could not acknowledge review",
      );
    }
  };

  // Secure document opening
  const openDocument = async (id) => {
    const popup = window.open("about:blank", "_blank");

    try {
      const { data } = await api.get(
        `/hrms/documents/${id}/download`,
      );

      if (!data?.url) {
        throw new Error(
          "Secure download link was not returned",
        );
      }

      if (popup) {
        popup.location.href = data.url;
      } else {
        window.location.assign(data.url);
      }
    } catch (e) {
      popup?.close();

      toast.error(
        e?.response?.data?.error ||
          e.message ||
          "Could not open document",
      );
    }
  };

  // Verify or reject documents
  const verify = async (id, status) => {
    if (!id || !["VERIFIED", "REJECTED"].includes(status)) {
      toast.error("Invalid document verification request.");
      return;
    }

    if (verifyingLock.current.has(id)) return;

    let notes = "";

    if (status === "REJECTED") {
      const answer = window.prompt(
        "Enter rejection reason (required)",
        "",
      );

      if (answer === null) return;

      notes = answer.trim();

      if (!notes) {
        toast.error("A rejection reason is required.");
        return;
      }
    }

    verifyingLock.current.add(id);

    setVerifyingIds((previous) => {
      const next = new Set(previous);
      next.add(id);
      return next;
    });

    try {
      await api.patch(
        `/hrms/documents/${id}/verification`,
        { status, notes },
      );

      toast.success(
        status === "VERIFIED"
          ? "Document verified successfully."
          : "Document rejected successfully.",
      );

      await load();
    } catch (e) {
      toast.error(
        e?.response?.data?.error || "Document verification failed.",
      );

      await load();
    } finally {
      verifyingLock.current.delete(id);

      setVerifyingIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
  };

  // Review approval request
  const decide = async (id, status) => {
    const comment =
      window.prompt(
        status === "REJECTED"
          ? "Enter rejection reason (required)"
          : "Optional approval comment",
        "",
      ) ?? null;

    if (
      comment === null ||
      (status === "REJECTED" && !comment.trim())
    ) {
      return;
    }

    try {
      await api.patch(
        `/hrms/approvals/${id}/review`,
        { status, comment },
      );

      toast.success(
        `Request ${status.toLowerCase()}`,
      );

      await load();
    } catch (e) {
      toast.error(
        e?.response?.data?.error || "Review failed",
      );
    }
  };

  return (
    <div className="min-w-0 w-full space-y-4 sm:space-y-6">
      {/* HEADER */}
      <header className="min-w-0 rounded-3xl border border-[#DCE9DE] bg-gradient-to-br from-[#EDF4EE] via-white to-[#F7F8F5] p-4 sm:p-8">
        <div className="flex min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#4A6F52]">
              Human resources
            </p>

            <h1 className="mt-2 text-2xl font-semibold text-[#172019] sm:text-3xl">
              HRMS workspace
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#637066]">
              Employee documents, performance reviews, approvals and
              workforce history.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#DDE5DD] bg-white px-4 py-2.5 text-sm font-semibold text-[#435443] transition hover:bg-[#F7F9F6] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:self-auto"
          >
            <RefreshCw
              size={16}
              className={busy ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </header>

      {/* TABS */}
      <div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-[#E8F3E9] text-[#3E7049] ring-1 ring-[#C9E0CC]"
                : "bg-white text-[#667466] ring-1 ring-[#E5EAE3] hover:bg-[#F7F9F6]"
            }`}
          >
            <t.icon size={16} />
            {t.name}
          </button>
        ))}
      </div>

      {/* DOCUMENTS */}
      {tab === "documents" && (
        <div className="min-w-0 space-y-5">
          <Panel
            title="Upload employee document"
            subtitle="Upload a PDF, JPG or PNG directly to secure document storage. Employees can upload to their own profile; administrators can upload on behalf of an employee."
          >
            <form
              className="grid min-w-0 gap-3 sm:grid-cols-2"
              onSubmit={uploadDoc}
            >
              {admin && (
                <label className="min-w-0">
                  <span className={label}>Employee</span>
                  <select
                    required
                    className={input}
                    value={doc.employee}
                    onChange={(e) =>
                      updateDocField("employee", e.target.value)
                    }
                  >
                    <option value="">Select employee</option>
                    {employees.map((x) => (
                      <option key={x._id} value={x._id}>
                        {x.firstName} {x.lastName}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="min-w-0">
                <span className={label}>Document title</span>
                <input
                  required
                  maxLength={160}
                  className={input}
                  value={doc.title}
                  onChange={(e) =>
                    updateDocField("title", e.target.value)
                  }
                />
              </label>

              <label className="min-w-0">
                <span className={label}>Category</span>
                <select
                  className={input}
                  value={doc.category}
                  onChange={(e) =>
                    updateDocField("category", e.target.value)
                  }
                >
                  {[
                    "OFFER_LETTER",
                    "CONTRACT",
                    "IDENTITY",
                    "EDUCATION",
                    "EXPERIENCE",
                    "SALARY_LETTER",
                    "POLICY",
                    "OTHER",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>

              <label className="min-w-0">
                <span className={label}>
                  Document file (PDF/JPG/PNG, max 10 MB)
                </span>
                <input
                  required
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className={`${input} cursor-pointer file:mr-2 file:rounded-lg file:border-0 file:bg-[#E8F3E9] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#3E7049]`}
                  onChange={(e) =>
                    updateDocField(
                      "file",
                      e.target.files?.[0] || null,
                    )
                  }
                />
              </label>

              <label className="min-w-0">
                <span className={label}>Expiry date (optional)</span>
                <input
                  type="date"
                  className={input}
                  value={doc.expiresAt}
                  onChange={(e) =>
                    updateDocField("expiresAt", e.target.value)
                  }
                />
              </label>

              <label className="min-w-0">
                <span className={label}>Notes</span>
                <input
                  maxLength={1000}
                  className={input}
                  value={doc.notes}
                  onChange={(e) =>
                    updateDocField("notes", e.target.value)
                  }
                />
              </label>

              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={uploadingDoc}
                >
                  {uploadingDoc ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="animate-spin"
                      />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Save document
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Panel>

          <Panel
            title="Document register"
            subtitle="Employees can view their own documents; administrators can securely upload, verify or reject records. Cloudinary credentials must be configured on the server."
          >
            <Table
              headers={[
                "Employee",
                "Document",
                "Category",
                "Uploaded",
                "Expires",
                "Status",
                "File",
                "Action",
              ]}
            >
              {rows.length ? (
                rows.map((r) => (
                  <tr key={r._id}>
                    <td className={td}>
                      {r.employee?.firstName} {r.employee?.lastName}
                    </td>
                    <td className={td}>{r.title}</td>
                    <td className={td}>{r.category}</td>
                    <td className={td}>{date(r.createdAt)}</td>
                    <td className={td}>{date(r.expiresAt)}</td>
                    <td className={td}>
                      {r.verificationStatus}
                    </td>
                    <td className={td}>
                      <button
                        type="button"
                        className="min-h-10 whitespace-nowrap font-semibold text-[#4A7C59] underline"
                        onClick={() => openDocument(r._id)}
                      >
                        Open file
                      </button>
                    </td>
                    <td className={td}>
                      {admin && r.verificationStatus === "PENDING" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            title="Verify"
                            disabled={verifyingIds.has(r._id)}
                            onClick={() => verify(r._id, "VERIFIED")}
                            className="min-h-10 min-w-10 rounded-lg bg-[#E8F3E9] p-2 text-[#3E7049] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {verifyingIds.has(r._id) ? (
                              <RefreshCw
                                size={15}
                                className="animate-spin"
                              />
                            ) : (
                              <Check size={15} />
                            )}
                          </button>

                          <button
                            type="button"
                            title="Reject"
                            disabled={verifyingIds.has(r._id)}
                            onClick={() => verify(r._id, "REJECTED")}
                            className="min-h-10 min-w-10 rounded-lg bg-[#FFF0EE] p-2 text-[#B7473A] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {verifyingIds.has(r._id) ? (
                              <RefreshCw
                                size={15}
                                className="animate-spin"
                              />
                            ) : (
                              <X size={15} />
                            )}
                          </button>
                        </div>
                      )}

                      {admin && r.verificationStatus !== "PENDING" && (
                        <span className="whitespace-nowrap text-xs font-medium text-[#718071]">
                          Reviewed
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                empty
              )}
            </Table>
          </Panel>
        </div>
      )}

      {/* PERFORMANCE REVIEWS */}
      {tab === "reviews" && (
        <div className="min-w-0 space-y-5">
          {admin && (
            <Panel
              title="Create or update performance review"
              subtitle="One review per employee and review period. Submitting locks the review status for employee visibility."
            >
              <form
                className="grid min-w-0 gap-3 sm:grid-cols-2"
                onSubmit={handleReviewSubmit}
              >
                <label className="min-w-0">
                  <span className={label}>Employee</span>
                  <select
                    required
                    className={input}
                    value={review.employee}
                    onChange={(e) =>
                      setReview({
                        ...review,
                        employee: e.target.value,
                      })
                    }
                  >
                    <option value="">Select employee</option>
                    {employees.map((x) => (
                      <option key={x._id} value={x._id}>
                        {x.firstName} {x.lastName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="min-w-0">
                  <span className={label}>Review period</span>
                  <input
                    required
                    maxLength={40}
                    className={input}
                    placeholder="2026 Annual"
                    value={review.period}
                    onChange={(e) =>
                      setReview({
                        ...review,
                        period: e.target.value,
                      })
                    }
                  />
                </label>

                <label className="min-w-0">
                  <span className={label}>Rating (1–5)</span>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="1"
                    inputMode="numeric"
                    placeholder="Enter 1 to 5"
                    className={input}
                    value={review.rating}
                    onChange={(e) =>
                      setReview({
                        ...review,
                        rating: e.target.value,
                      })
                    }
                  />
                  <p className="mt-1 text-xs text-[#829082]">
                    Enter a whole number from 1 to 5.
                  </p>
                </label>

                <label className="min-w-0">
                  <span className={label}>
                    Goals (one per line)
                  </span>
                  <textarea
                    rows={3}
                    className={input}
                    value={review.goalsText}
                    onChange={(e) =>
                      setReview({
                        ...review,
                        goalsText: e.target.value,
                      })
                    }
                  />
                </label>

                <label className="min-w-0">
                  <span className={label}>Strengths</span>
                  <textarea
                    rows={3}
                    className={input}
                    value={review.strengths}
                    onChange={(e) =>
                      setReview({
                        ...review,
                        strengths: e.target.value,
                      })
                    }
                  />
                </label>

                <label className="min-w-0">
                  <span className={label}>
                    Development areas
                  </span>
                  <textarea
                    rows={3}
                    className={input}
                    value={review.improvements}
                    onChange={(e) =>
                      setReview({
                        ...review,
                        improvements: e.target.value,
                      })
                    }
                  />
                </label>

                <div className="sm:col-span-2">
                  <Button
                    type="submit"
                    disabled={savingReview}
                  >
                    {savingReview ? (
                      <>
                        <RefreshCw
                          size={16}
                          className="animate-spin"
                        />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        Save review
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Panel>
          )}

          <Panel title="Performance reviews">
            <Table
              headers={[
                "Employee",
                "Period",
                "Rating",
                "Goals",
                "Strengths",
                "Development",
                "Status",
                "Action",
              ]}
            >
              {rows.length ? (
                rows.map((r) => (
                  <tr key={r._id}>
                    <td className={td}>
                      {r.employee?.firstName} {r.employee?.lastName}
                    </td>
                    <td className={td}>{r.period}</td>
                    <td className={td}>
                      {r.rating ?? "—"} / 5
                    </td>
                    <td className={td}>
                      {r.goals?.length || 0}
                    </td>
                    <td className={td}>
                      {r.strengths || "—"}
                    </td>
                    <td className={td}>
                      {r.improvements || "—"}
                    </td>
                    <td className={td}>{r.status}</td>
                    <td className={td}>
                      {!admin && r.status === "SUBMITTED" ? (
                        <button
                          type="button"
                          onClick={() => acknowledge(r._id)}
                          className="min-h-10 whitespace-nowrap rounded-lg bg-[#E8F3E9] px-3 py-2 text-xs font-semibold text-[#3E7049]"
                        >
                          Acknowledge
                        </button>
                      ) : (
                        r.employeeComments || "—"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                empty
              )}
            </Table>
          </Panel>
        </div>
      )}

      {/* APPROVALS */}
      {tab === "approvals" && (
        <div className="min-w-0 space-y-5">
          {!admin && (
            <Panel
              title="Raise an approval request"
              subtitle="Leave and document verification requests are linked to their original records and update those records when approved or rejected."
            >
              <form
                className="grid min-w-0 gap-3 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();

                  send(
                    "/hrms/approvals",
                    {
                      type: approval.type,
                      title: approval.title,
                      description: approval.description,
                      payload: {
                        ...(approval.type === "LEAVE"
                          ? {
                              leaveApplicationId:
                                approval.leaveApplicationId,
                            }
                          : {}),
                        ...(approval.type ===
                        "DOCUMENT_VERIFICATION"
                          ? {
                              documentId: approval.documentId,
                            }
                          : {}),
                      },
                    },
                    "Approval request submitted",
                    () =>
                      setApproval({
                        type: "OTHER",
                        title: "",
                        description: "",
                        leaveApplicationId: "",
                        documentId: "",
                      }),
                  );
                }}
              >
                <label className="min-w-0">
                  <span className={label}>Request type</span>
                  <select
                    className={input}
                    value={approval.type}
                    onChange={(e) =>
                      setApproval({
                        ...approval,
                        type: e.target.value,
                      })
                    }
                  >
                    {[
                      "LEAVE",
                      "DOCUMENT_VERIFICATION",
                      "OTHER",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>

                {approval.type === "LEAVE" && (
                  <label className="min-w-0">
                    <span className={label}>
                      Pending leave request
                    </span>
                    <select
                      required
                      className={input}
                      value={approval.leaveApplicationId}
                      onChange={(e) =>
                        setApproval({
                          ...approval,
                          leaveApplicationId: e.target.value,
                        })
                      }
                    >
                      <option value="">
                        Select pending leave
                      </option>
                      {myPendingLeaves.map((x) => (
                        <option key={x._id} value={x._id}>
                          {x.type} · {date(x.startDate)} –{" "}
                          {date(x.endDate)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {approval.type ===
                  "DOCUMENT_VERIFICATION" && (
                  <label className="min-w-0">
                    <span className={label}>Document</span>
                    <select
                      required
                      className={input}
                      value={approval.documentId}
                      onChange={(e) =>
                        setApproval({
                          ...approval,
                          documentId: e.target.value,
                        })
                      }
                    >
                      <option value="">Select document</option>
                      {myDocuments.map((x) => (
                        <option key={x._id} value={x._id}>
                          {x.title} · {x.verificationStatus}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="min-w-0">
                  <span className={label}>Title</span>
                  <input
                    required
                    maxLength={160}
                    className={input}
                    value={approval.title}
                    onChange={(e) =>
                      setApproval({
                        ...approval,
                        title: e.target.value,
                      })
                    }
                  />
                </label>

                <label className="min-w-0 sm:col-span-2">
                  <span className={label}>Details</span>
                  <textarea
                    rows={3}
                    maxLength={3000}
                    className={input}
                    value={approval.description}
                    onChange={(e) =>
                      setApproval({
                        ...approval,
                        description: e.target.value,
                      })
                    }
                  />
                </label>

                <div className="sm:col-span-2">
                  <Button type="submit">
                    <Plus size={16} />
                    Submit request
                  </Button>
                </div>
              </form>
            </Panel>
          )}

          <Panel title={admin ? "Approval inbox" : "My requests"}>
            <Table
              headers={[
                "Request",
                "Employee",
                "Type",
                "Submitted",
                "Status",
                "Reviewer",
                "Decision",
              ]}
            >
              {rows.length ? (
                rows.map((r) => (
                  <tr key={r._id}>
                    <td className={td}>
                      <div className="font-semibold">
                        {r.title}
                      </div>
                      <div className="max-w-xs break-words text-xs text-[#829082]">
                        {r.description}
                      </div>
                    </td>
                    <td className={td}>
                      {r.employee?.firstName}{" "}
                      {r.employee?.lastName}
                    </td>
                    <td className={td}>{r.type}</td>
                    <td className={td}>{date(r.createdAt)}</td>
                    <td className={td}>{r.status}</td>
                    <td className={td}>
                      {r.reviewer?.email || "—"}
                    </td>
                    <td className={td}>
                      {admin && r.status === "PENDING" ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              decide(r._id, "APPROVED")
                            }
                            className="min-h-10 whitespace-nowrap rounded-lg bg-[#E8F3E9] px-3 py-2 text-xs font-semibold text-[#3E7049]"
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              decide(r._id, "REJECTED")
                            }
                            className="min-h-10 whitespace-nowrap rounded-lg bg-[#FFF0EE] px-3 py-2 text-xs font-semibold text-[#B7473A]"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        r.reviewComment || "—"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                empty
              )}
            </Table>
          </Panel>
        </div>
      )}

      {/* EMPLOYEE LIFECYCLE */}
      {tab === "lifecycle" && admin && (
        <div className="min-w-0 space-y-5">
          <Panel
            title="Record employee lifecycle event"
            subtitle="Resignation and termination events dated today or earlier deactivate the employee account; reactivation restores access. Future-dated status changes must be applied on their effective date."
          >
            <form
              className="grid min-w-0 gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();

                send(
                  "/hrms/lifecycle",
                  life,
                  "Lifecycle event recorded",
                  () =>
                    setLife({
                      employee: "",
                      eventType: "JOINED",
                      effectiveDate: new Date()
                        .toISOString()
                        .slice(0, 10),
                      details: "",
                    }),
                );
              }}
            >
              <label className="min-w-0">
                <span className={label}>Employee</span>
                <select
                  required
                  className={input}
                  value={life.employee}
                  onChange={(e) =>
                    setLife({
                      ...life,
                      employee: e.target.value,
                    })
                  }
                >
                  <option value="">Select employee</option>
                  {employees.map((x) => (
                    <option key={x._id} value={x._id}>
                      {x.firstName} {x.lastName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="min-w-0">
                <span className={label}>Event</span>
                <select
                  className={input}
                  value={life.eventType}
                  onChange={(e) =>
                    setLife({
                      ...life,
                      eventType: e.target.value,
                    })
                  }
                >
                  {[
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
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>

              <label className="min-w-0">
                <span className={label}>Effective date</span>
                <input
                  required
                  type="date"
                  className={input}
                  value={life.effectiveDate}
                  onChange={(e) =>
                    setLife({
                      ...life,
                      effectiveDate: e.target.value,
                    })
                  }
                />
              </label>

              <label className="min-w-0">
                <span className={label}>Details</span>
                <input
                  maxLength={2000}
                  className={input}
                  value={life.details}
                  onChange={(e) =>
                    setLife({
                      ...life,
                      details: e.target.value,
                    })
                  }
                />
              </label>

              <div className="sm:col-span-2">
                <Button type="submit">
                  <Plus size={16} />
                  Record event
                </Button>
              </div>
            </form>
          </Panel>

          <Panel title="Employee timeline">
            <p className="mb-3 text-sm leading-6 text-[#718071]">
              Choose an employee to load their recorded timeline.
            </p>

            <select
              className={input}
              onChange={async (e) => {
                if (!e.target.value) {
                  setRows([]);
                  return;
                }

                try {
                  const { data } = await api.get(
                    `/hrms/lifecycle/${e.target.value}`,
                  );

                  setRows(data?.data || []);
                } catch (err) {
                  toast.error(
                    err?.response?.data?.error ||
                      "Could not load timeline",
                  );
                }
              }}
            >
              <option value="">Select employee</option>
              {employees.map((x) => (
                <option key={x._id} value={x._id}>
                  {x.firstName} {x.lastName}
                </option>
              ))}
            </select>

            <div className="mt-4 min-w-0 space-y-3">
              {rows.map((r) => (
                <div
                  key={r._id}
                  className="min-w-0 rounded-xl border border-[#E5EAE3] p-3 sm:p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong className="text-sm text-[#314532]">
                      {String(r.eventType || "OTHER").replaceAll("_", " ")}
                    </strong>

                    <span className="text-xs text-[#829082]">
                      {date(r.effectiveDate)}
                    </span>
                  </div>

                  <p className="mt-1 break-words text-sm text-[#697769]">
                    {r.details || "No additional details"}
                  </p>
                </div>
              ))}

              {!rows.length && (
                <p className="py-6 text-center text-sm text-[#829082]">
                  No lifecycle events loaded.
                </p>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* HR AUDIT */}
      {tab === "audit" && admin && (
        <Panel
          title="HR audit trail"
          subtitle="Recent actions recorded by the HRMS feature endpoints."
        >
          <Table
            headers={[
              "When",
              "Actor",
              "Action",
              "Resource",
              "Resource ID",
              "Employee",
            ]}
          >
            {rows.length ? (
              rows.map((r) => (
                <tr key={r._id}>
                  <td className={td}>
                    {new Date(r.createdAt).toLocaleString("en-IN")}
                  </td>
                  <td className={td}>
                    {r.actor?.email || "System"}
                  </td>
                  <td className={td}>{r.action}</td>
                  <td className={td}>{r.resourceType}</td>
                  <td className={td}>
                    {r.resourceId || "—"}
                  </td>
                  <td className={td}>
                    {r.employee
                      ? `${r.employee.firstName || ""} ${r.employee.lastName || ""}`
                      : "—"}
                  </td>
                </tr>
              ))
            ) : (
              empty
            )}
          </Table>
        </Panel>
      )}
    </div>
  );
}
