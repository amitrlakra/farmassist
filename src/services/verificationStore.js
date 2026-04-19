const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");
const STATES_FILE = path.join(DATA_DIR, "states.json");

function getStateDataPath(stateCode) {
  return path.join(DATA_DIR, "states", stateCode);
}

function getSeedFile(stateCode) {
  return path.join(getStateDataPath(stateCode), `schemes.${stateCode}.seed.json`);
}

function getRuntimeFile(stateCode) {
  return path.join(getStateDataPath(stateCode), `schemes.${stateCode}.runtime.json`);
}

function getAuditFile(stateCode) {
  return path.join(getStateDataPath(stateCode), `verification.audit.${stateCode}.json`);
}

function ensureStateFiles(stateCode) {
  const runtimeFile = getRuntimeFile(stateCode);
  const auditFile = getAuditFile(stateCode);

  if (!fs.existsSync(runtimeFile)) {
    const seedFile = getSeedFile(stateCode);
    if (fs.existsSync(seedFile)) {
      const seed = fs.readFileSync(seedFile, "utf8");
      fs.writeFileSync(runtimeFile, seed, "utf8");
    } else {
      // Create empty schemes file if no seed exists
      fs.writeFileSync(runtimeFile, "[]", "utf8");
    }
  }

  if (!fs.existsSync(auditFile)) {
    fs.writeFileSync(auditFile, "[]", "utf8");
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function listSchemes(stateCode = "jharkhand") {
  ensureStateFiles(stateCode);
  const runtimeFile = getRuntimeFile(stateCode);
  return readJson(runtimeFile);
}

function saveSchemes(schemes, stateCode = "jharkhand") {
  ensureStateFiles(stateCode);
  const runtimeFile = getRuntimeFile(stateCode);
  writeJson(runtimeFile, schemes);
}

function appendAudit(entry, stateCode = "jharkhand") {
  ensureStateFiles(stateCode);
  const auditFile = getAuditFile(stateCode);
  const log = readJson(auditFile);
  log.push(entry);
  writeJson(auditFile, log);
}

function listAudit(stateCode = "jharkhand", limit = 100) {
  ensureStateFiles(stateCode);
  const auditFile = getAuditFile(stateCode);
  const log = readJson(auditFile);
  return log.slice(Math.max(0, log.length - limit)).reverse();
}

function getAvailableStates() {
  return readJson(STATES_FILE);
}

function decideSchemeVerification({ id, decision, reviewer, notes, reasonCode, allowedReasonCodes = [], stateCode = "jharkhand" }) {
  const allowed = ["verified", "pending", "rejected"];
  if (!allowed.includes(decision)) {
    throw new Error("Invalid decision");
  }

  const normalizedReasonCode = String(reasonCode || "").trim();

  // Reject decisions must have a reason code
  if (decision === "rejected" && !normalizedReasonCode) {
    throw new Error("Rejection reason required");
  }

  if (
    decision === "rejected" &&
    Array.isArray(allowedReasonCodes) &&
    allowedReasonCodes.length > 0 &&
    !allowedReasonCodes.includes(normalizedReasonCode)
  ) {
    throw new Error("Invalid rejection reason code");
  }

  const schemes = listSchemes(stateCode);
  const idx = schemes.findIndex((s) => s.id === id);
  if (idx < 0) {
    throw new Error("Scheme not found");
  }

  const now = new Date().toISOString().slice(0, 10);
  const before = schemes[idx].verification_status;

  schemes[idx].verification_status = decision;
  schemes[idx].verified_by = reviewer || "Admin";
  schemes[idx].verified_on = decision === "verified" ? now : null;
  schemes[idx].verification_notes = notes || "";
  schemes[idx].rejection_reason = decision === "rejected" ? normalizedReasonCode : null;

  saveSchemes(schemes, stateCode);

  appendAudit({
    ts: new Date().toISOString(),
    scheme_id: id,
    before,
    after: decision,
    reviewer: reviewer || "Admin",
    notes: notes || "",
    reason_code: decision === "rejected" ? normalizedReasonCode : null,
  });

  return schemes[idx];
}

function verificationReport() {
  const schemes = listSchemes();
  const verified = schemes.filter((s) => s.verification_status === "verified");
  const pending = schemes.filter((s) => s.verification_status === "pending");
  const rejected = schemes.filter((s) => s.verification_status === "rejected");

  return {
    total: schemes.length,
    verified: verified.length,
    pending: pending.length,
    rejected: rejected.length,
    pending_items: pending.map((p) => ({
      id: p.id,
      name: p.name.English,
      scope: p.scope,
      source_url: p.source_url,
    })),
  };
}

module.exports = {
  listSchemes,
  decideSchemeVerification,
  listAudit,
  verificationReport,
  getAvailableStates,
};
