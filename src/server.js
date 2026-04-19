const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");

const config = require("./config");
const { uiText } = require("./services/translation");
const {
  listSchemes,
  verifiedSchemesOnly,
  filterByRegion,
  saveSchemes,
  appendAudit,
  listAudit,
  getAvailableStates,
} = require("./services/schemeRepository");
const {
  decideSchemeVerification,
  verificationReport,
} = require("./services/verificationStore");
const {
  buildAdminUsers,
  resolveAdminFromKey,
  hasRequiredRole,
} = require("./services/adminAuth");
const { recommend } = require("./engine/recommendation");
const { extractAadhaarFromBuffer, SUPPORTED_IMAGE_TYPES } = require("./services/aadhaarExtractor");
const { scanDocumentFromBuffer } = require("./services/documentScanner");
const { extractLandDetailsFromBuffer } = require("./services/landRecordExtractor");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const type = String(file?.mimetype || "").toLowerCase();
    const isPdf = type.includes("pdf");
    const isImage = SUPPORTED_IMAGE_TYPES.includes(type);

    if (isPdf || isImage) {
      cb(null, true);
      return;
    }

    cb(new Error("Unsupported document type. Upload PDF, JPG, PNG, or WEBP."));
  },
});
const adminUsers = buildAdminUsers({
  adminUsers: config.adminUsers,
  fallbackAdminKey: config.adminKey,
});

function getRegionsForState(stateCode) {
  try {
    const regionsPath = path.join(__dirname, "data", "states", stateCode, `regions.${stateCode}.json`);
    return require(regionsPath);
  } catch (error) {
    // Fallback to default regions if state-specific file doesn't exist
    return require("./data/states/jharkhand/regions.jharkhand.json");
  }
}

function getStateCodeFromName(stateName) {
  const states = getAvailableStates();
  const state = states.find(s => s.name.English.toLowerCase() === stateName.toLowerCase() || s.name.Hindi === stateName);
  return state ? state.code : "jharkhand";
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/favicon.ico", (_req, res) => {
  res.sendStatus(204);
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, product: "farmassist-jharkhand-pilot" });
});

app.get("/api/languages", (_req, res) => {
  res.json({ languages: Object.keys(uiText) });
});

app.post("/api/extract/aadhaar", (req, res, next) => {
  upload.single("document")(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ ok: false, error: "File too large. Max size is 10 MB." });
      return;
    }

    res.status(400).json({ ok: false, error: err.message || "Invalid upload" });
  });
}, async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ ok: false, error: "No document uploaded" });
    }

    const result = await extractAadhaarFromBuffer({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      fileName: req.file.originalname,
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    const status = Number(err?.statusCode) || 500;
    const extractionSoftFailCodes = new Set(["IMAGE_OCR_FAILED", "PDF_PARSE_FAILED"]);

    if (extractionSoftFailCodes.has(err?.code)) {
      res.json({
        ok: true,
        aadhaar: null,
        checksum_valid: false,
        candidates: [],
        text_preview: "",
        warning: err.message,
        warning_code: err.code,
      });
      return;
    }

    const message = status >= 500
      ? "Could not extract Aadhaar from document"
      : err.message;

    if (status >= 500) {
      console.error("Aadhaar extraction error:", err);
    }

    res.status(status).json({
      ok: false,
      error: message,
      code: err?.code || "AADHAAR_EXTRACTION_FAILED",
    });
  }
});

app.post("/api/extract/land-record", (req, res, next) => {
  upload.single("document")(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ ok: false, error: "File too large. Max size is 10 MB." });
      return;
    }

    res.status(400).json({ ok: false, error: err.message || "Invalid upload" });
  });
}, async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ ok: false, error: "No document uploaded" });
    }

    const result = await extractLandDetailsFromBuffer({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      fileName: req.file.originalname,
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    const status = Number(err?.statusCode) || 500;
    const message = status >= 500
      ? "Could not extract land details from document"
      : err.message;

    if (status >= 500) {
      console.error("Land record extraction error:", err);
    }

    res.status(status).json({
      ok: false,
      error: message,
      code: err?.code || "LAND_RECORD_EXTRACTION_FAILED",
    });
  }
});

app.post("/api/extract/document", (req, res, next) => {
  upload.single("document")(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ ok: false, error: "File too large. Max size is 10 MB." });
      return;
    }

    res.status(400).json({ ok: false, error: err.message || "Invalid upload" });
  });
}, async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ ok: false, error: "No document uploaded" });
    }

    const result = await scanDocumentFromBuffer({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    const status = Number(err?.statusCode) || 500;
    const message = status >= 500
      ? "Could not scan document"
      : err.message;

    if (status >= 500) {
      console.error("Document scan error:", err);
    }

    res.status(status).json({
      ok: false,
      error: message,
      code: err?.code || "DOCUMENT_SCAN_FAILED",
    });
  }
});

function toCsvValue(value) {
  const normalized = String(value === null || value === undefined ? "" : value).replace(/\r?\n/g, " ");
  return `"${normalized.replace(/"/g, '""')}"`;
}

function makeCsv(rows, headers) {
  const headerLine = headers.join(",");
  const body = rows
    .map((row) => headers.map((h) => toCsvValue(row[h])).join(","))
    .join("\n");
  return `${headerLine}\n${body}`;
}

function requireAdmin(allowedRoles = ["superadmin"]) {
  return (req, res, next) => {
    const key = req.headers["x-admin-key"];
    const admin = resolveAdminFromKey(adminUsers, key);
    if (!admin) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!hasRequiredRole(admin, allowedRoles)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.admin = admin;
    next();
  };
}

app.get("/api/admin/me", requireAdmin(["auditor", "reviewer", "superadmin"]), (req, res) => {
  res.json({ admin: req.admin });
});

app.get("/api/admin/rejection-reasons", (req, res) => {
  res.json({ reasons: config.rejectionReasons });
});

app.get("/api/regions", (req, res) => {
  const { district, state: stateCode = "jharkhand" } = req.query;
  const stateRegions = getRegionsForState(stateCode);

  if (!district) {
    return res.json({
      state: stateRegions.state,
      districts: stateRegions.districts.map((d) => d.name),
    });
  }

  const row = stateRegions.districts.find((d) => d.name === district);
  return res.json({
    district,
    blocks: row ? row.blocks : [],
  });
});

app.get("/api/states", (req, res) => {
  const states = getAvailableStates();
  res.json({ states });
});

app.post("/api/recommend", (req, res) => {
  const profile = req.body || {};
  const language = profile.language || config.defaultLanguage;
  const state = profile.state || config.defaultState;
  const stateCode = getStateCodeFromName(state);
  const district = profile.district || "";
  const block = profile.block || "";
  const verifiedOnly =
    typeof profile.verifiedOnly === "boolean"
      ? profile.verifiedOnly
      : config.verifiedOnlyByDefault;
  const enforceVerifiedOnly = config.strictVerifiedMode ? true : verifiedOnly;

  let schemes = listSchemes(stateCode);
  schemes = filterByRegion(schemes, state, district, block);
  if (enforceVerifiedOnly) schemes = verifiedSchemesOnly(schemes);

  const recommendations = recommend({
    profile,
    schemes,
    language,
  });

  res.json({
    state: state,
    state_code: stateCode,
    language,
    verified_only: enforceVerifiedOnly,
    strict_verified_mode: config.strictVerifiedMode,
    results: recommendations,
    total: recommendations.length,
  });
});

app.get("/api/verification/report", (_req, res) => {
  res.json(verificationReport());
});

app.get("/api/admin/verification/queue", requireAdmin(["reviewer", "superadmin"]), (req, res) => {
  const { state: stateCode = "jharkhand" } = req.query;
  const schemes = listSchemes(stateCode);
  const queue = schemes
    .filter((s) => s.verification_status !== "verified")
    .map((s) => ({
      id: s.id,
      name: s.name.English,
      scope: s.scope,
      status: s.verification_status,
      source_url: s.source_url,
      verified_by: s.verified_by || "",
      verified_on: s.verified_on || "",
      verification_notes: s.verification_notes || "",
    }));
  res.json({ total: queue.length, items: queue, admin: req.admin });
});

app.get("/api/admin/verification/queue.csv", requireAdmin(["reviewer", "superadmin"]), (_req, res) => {
  const schemes = listSchemes();
  const rows = schemes
    .filter((s) => s.verification_status !== "verified")
    .map((s) => ({
      id: s.id,
      name: s.name.English,
      scope: s.scope,
      status: s.verification_status,
      source_url: s.source_url,
      verified_by: s.verified_by || "",
      verified_on: s.verified_on || "",
      verification_notes: s.verification_notes || "",
    }));

  const headers = [
    "id",
    "name",
    "scope",
    "status",
    "source_url",
    "verified_by",
    "verified_on",
    "verification_notes",
  ];

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=verification-queue.csv");
  res.send(makeCsv(rows, headers));
});

app.post("/api/admin/verification/:id/decision", requireAdmin(["reviewer", "superadmin"]), (req, res) => {
  try {
    const { state: stateCode = "jharkhand" } = req.query;
    const allowedReasonCodes = (config.rejectionReasons || []).map((r) => r.code);
    const updated = decideSchemeVerification({
      id: req.params.id,
      decision: req.body.decision,
      reviewer: req.body.reviewer || req.admin.name,
      notes: req.body.notes,
      reasonCode: req.body.reasonCode,
      allowedReasonCodes,
      stateCode,
    });
    res.json({ ok: true, updated, admin: req.admin });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get("/api/admin/audit", requireAdmin(["auditor", "reviewer", "superadmin"]), (req, res) => {
  const limit = Number(req.query.limit || 100);
  const { state: stateCode = "jharkhand" } = req.query;
  res.json({ items: listAudit(stateCode, limit), admin: req.admin });
});

app.get("/api/admin/audit.csv", requireAdmin(["auditor", "reviewer", "superadmin"]), (req, res) => {
  const limit = Number(req.query.limit || 100);
  const { state: stateCode = "jharkhand" } = req.query;
  const rows = listAudit(stateCode, limit).map((row) => ({
    ts: row.ts,
    scheme_id: row.scheme_id,
    before: row.before,
    after: row.after,
    reviewer: row.reviewer,
    notes: row.notes,
    reason_code: row.reason_code || "",
  }));

  const headers = ["ts", "scheme_id", "before", "after", "reviewer", "notes", "reason_code"];

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=verification-audit.csv");
  res.send(makeCsv(rows, headers));
});

app.listen(config.port, () => {
  console.log(`FarmAssist Jharkhand pilot running on port ${config.port}`);
});
