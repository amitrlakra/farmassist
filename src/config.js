require("dotenv").config();

function parseAdminUsers(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

const defaultRejectionReasons = [
  { code: "invalid_source", label: "Invalid or unverified source" },
  { code: "incomplete_details", label: "Incomplete scheme details" },
  { code: "duplicate_scheme", label: "Duplicate of existing scheme" },
  { code: "ineligible_criteria", label: "Doesn't meet program criteria" },
  { code: "expired_scheme", label: "Scheme expired or outdated" },
  { code: "insufficient_info", label: "Insufficient documentation" },
  { code: "other", label: "Other (see notes)" },
];

module.exports = {
  port: Number(process.env.PORT || 3010),
  defaultLanguage: process.env.DEFAULT_LANGUAGE || "English",
  defaultState: process.env.DEFAULT_STATE || "Jharkhand",
  verifiedOnlyByDefault: parseBoolean(process.env.VERIFIED_ONLY, true),
  strictVerifiedMode: parseBoolean(process.env.STRICT_VERIFIED_MODE, true),
  adminKey: process.env.ADMIN_KEY || "change-me-in-env",
  adminUsers: parseAdminUsers(process.env.ADMIN_USERS_JSON),
  rejectionReasons: defaultRejectionReasons,
  llmAadhaarFallbackEnabled: parseBoolean(process.env.LLM_AADHAAR_FALLBACK, false),
  llmAadhaarApiUrl: process.env.LLM_AADHAAR_API_URL || "https://api.openai.com/v1/chat/completions",
  llmAadhaarApiKey: process.env.LLM_AADHAAR_API_KEY || "",
  llmAadhaarModel: process.env.LLM_AADHAAR_MODEL || "gpt-4.1-mini",
  llmAadhaarRequestTimeoutMs: Number(process.env.LLM_AADHAAR_TIMEOUT_MS || 12000),
};
