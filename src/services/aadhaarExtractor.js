const pdfParse = require("pdf-parse");
const { createWorker } = require("tesseract.js");

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

function isValidAadhaarFormat(number) {
  if (!/^\d{12}$/.test(number)) return false;
  if (number[0] === "0" || number[0] === "1") return false;
  return true;
}

function extractAadhaarCandidates(text) {
  const input = String(text || "");
  const candidates = new Set();

  const patterns = [
    /\d{4}\s\d{4}\s\d{4}/g,
    /\d{4}\s+\d{4}\s+\d{4}/g,
    /\d{4}-\d{4}-\d{4}/g,
    /(?<!\d)\d{12}(?!\d)/g,
  ];

  patterns.forEach((pattern) => {
    const matches = input.match(pattern) || [];
    matches.forEach((match) => {
      const digits = match.replace(/\D/g, "");
      if (isValidAadhaarFormat(digits)) candidates.add(digits);
    });
  });

  return [...candidates];
}

function extractNameFromText(text) {
  const input = String(text || "").trim();
  if (!input.length || input.length > 20000) return null;

  const badParts = [
    "government",
    "govt",
    "india",
    "authority",
    "uidai",
    "aadhaar",
    "enrol",
    "enroll",
    "dob",
    "birth",
    "male",
    "female",
    "address",
  ];

  const toTitleCase = (value) => value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");

  const isLikelyPersonName = (value) => {
    const candidate = String(value || "").replace(/[^A-Za-z\s]/g, " ").replace(/\s+/g, " ").trim();
    if (!candidate) return false;

    const lower = candidate.toLowerCase();
    if (badParts.some((p) => lower.includes(p))) return false;

    const words = candidate.split(" ");
    if (words.length < 2 || words.length > 4) return false;
    if (words.some((w) => w.length < 2 || w.length > 24)) return false;

    // Avoid noisy OCR fragments with too many tiny words.
    const shortWords = words.filter((w) => w.length <= 2).length;
    if (shortWords > 1) return false;

    return true;
  };

  const labelMatch = input.match(/(?:name|naam|नाम)\s*[:\-]?\s*([A-Za-z][A-Za-z\s]{3,60})/i);
  if (labelMatch && labelMatch[1] && isLikelyPersonName(labelMatch[1])) {
    return toTitleCase(labelMatch[1].replace(/\s+/g, " ").trim());
  }

  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const candidates = [];

  for (let i = 0; i < Math.min(lines.length, 40); i += 1) {
    const line = lines[i];
    const prev = String(lines[i - 1] || "");
    const next = String(lines[i + 1] || "");

    // Prefer two-to-four word name patterns.
    const direct = line.match(/\b([A-Za-z]{2,24}(?:\s+[A-Za-z]{2,24}){1,3})\b/);
    if (!direct || !direct[1]) continue;

    const rawCandidate = direct[1].replace(/\s+/g, " ").trim();
    if (!isLikelyPersonName(rawCandidate)) continue;

    let score = 0;
    const hasNameAnchor = /(name|naam|नाम)/i.test(line) || /(name|naam|नाम)/i.test(prev);
    const hasProfileAnchor = /(dob|year\s*of\s*birth|male|female)/i.test(next);

    if (hasNameAnchor) score += 5;
    if (hasProfileAnchor) score += 3;
    if (/(government|authority|india|uidai|aadhaar)/i.test(line)) score -= 4;

    // Reject free-floating text that lacks Aadhaar profile anchors.
    if (!hasNameAnchor && !hasProfileAnchor) continue;

    candidates.push({ name: rawCandidate, score, idx: i });
  }

  if (candidates.length) {
    candidates.sort((a, b) => b.score - a.score || a.idx - b.idx);
    if (candidates[0].score >= 4) {
      return toTitleCase(candidates[0].name);
    }
  }

  return null;
}

function extractNameFromFileName(fileName) {
  const raw = String(fileName || "").trim();
  if (!raw) return null;

  const withoutExt = raw.replace(/\.[^.]+$/, "");
  const normalized = withoutExt
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  const noise = new Set([
    "aadhaar", "aadhar", "adhar", "adhaar", "uid", "uidai", "card", "front", "back", "scan", "copy", "doc", "document", "pdf", "jpg", "jpeg", "png", "webp",
  ]);

  const tokens = normalized
    .split(" ")
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !noise.has(t.toLowerCase()) && /^[A-Za-z]{2,24}$/.test(t));

  if (!tokens.length) return null;
  if (tokens.length > 4) return null;

  return tokens
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function extractDobFromText(text) {
  const input = String(text || "").trim();
  const patterns = [
    /\b(\d{1,2})[-\/\s](\d{1,2})[-\/\s](\d{4})\b/,
    /\b(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\b/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (!match) continue;

    const [, p1, p2, p3] = match;
    if (p1.length <= 2 && p2.length <= 2 && p3.length === 4) {
      return `${p3}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
    }
    if (p1.length === 4) {
      return `${p1}-${p2.padStart(2, "0")}-${p3.padStart(2, "0")}`;
    }
  }

  return null;
}

async function extractTextFromImage(buffer) {
  let workerError = null;
  const worker = await createWorker("eng", 1, {
    errorHandler: (err) => {
      workerError = err;
    },
  });
  try {
    const { data } = await worker.recognize(buffer);
    const text = String(data?.text || "");
    if (workerError && !text.trim()) {
      throw new Error("Image OCR failed");
    }
    return text;
  } finally {
    await worker.terminate().catch(() => {});
  }
}

async function extractTextFromPdf(buffer) {
  try {
    const parsed = await pdfParse(buffer);
    const text = String(parsed?.text || "");
    if (text.trim().length > 0) {
      return {
        text,
        extraction_method: "pdf_text",
        warning: "",
        warning_code: "",
      };
    }
  } catch (_err) {
    // Intentionally do not run Tesseract directly on PDF buffers.
    // On Render/Linux this can throw "Pdf reading is not supported" and crash the process.
  }

  return {
    text: "",
    extraction_method: "none",
    warning: "Could not read this PDF on server. Upload JPG/PNG/WEBP image for reliable Aadhaar extraction.",
    warning_code: "PDF_TEXT_UNAVAILABLE",
  };
}

async function extractTextFromBuffer({ buffer, mimeType }) {
  const type = String(mimeType || "").toLowerCase();

  if (!type) {
    const err = new Error("Document type is missing");
    err.statusCode = 400;
    err.code = "MIME_TYPE_MISSING";
    throw err;
  }

  if (type.includes("pdf")) {
    const pdfResult = await extractTextFromPdf(buffer);
    return {
      text: pdfResult.text,
      source: "pdf",
      extraction_method: pdfResult.extraction_method,
      warning: pdfResult.warning,
      warning_code: pdfResult.warning_code,
    };
  }

  if (SUPPORTED_IMAGE_TYPES.includes(type)) {
    try {
      const text = await extractTextFromImage(buffer);
      return {
        text,
        source: "image",
        extraction_method: text.trim() ? "image_ocr" : "image_ocr_empty",
        warning: text.trim() ? "" : "Image OCR produced no readable text.",
        warning_code: text.trim() ? "" : "IMAGE_TEXT_UNAVAILABLE",
      };
    } catch (_err) {
      return {
        text: "",
        source: "image",
        extraction_method: "none",
        warning: "Image OCR failed. Upload a clearer JPG, PNG, or WEBP image.",
        warning_code: "IMAGE_OCR_FAILED",
      };
    }
  }

  const err = new Error("Unsupported document type. Upload PDF, JPG, PNG, or WEBP.");
  err.statusCode = 400;
  err.code = "UNSUPPORTED_DOCUMENT_TYPE";
  throw err;
}

async function extractAadhaarFromBuffer({ buffer, mimeType, fileName = "" }) {
  if (!buffer || buffer.length === 0) {
    const err = new Error("Empty document buffer");
    err.statusCode = 400;
    err.code = "EMPTY_DOCUMENT";
    throw err;
  }

  const extracted = await extractTextFromBuffer({ buffer, mimeType });
  const ocrText = String(extracted.text || "");
  const aadhaarCandidates = extractAadhaarCandidates(ocrText);
  const aadhaar = aadhaarCandidates.length > 0 ? aadhaarCandidates[0] : null;
  const name = extractNameFromText(ocrText) || extractNameFromFileName(fileName);
  const dob = extractDobFromText(ocrText);

  let confidence = 0;
  if (aadhaar) confidence += 0.6;
  if (name) confidence += 0.2;
  if (dob) confidence += 0.2;

  return {
    aadhaar,
    name: name || null,
    dob: dob || null,
    checksum_valid: Boolean(aadhaar),
    candidates: aadhaarCandidates,
    extraction_method: extracted.extraction_method || "none",
    text_preview: ocrText.slice(0, 500),
    warning: extracted.warning || "",
    fields: {
      aadhaar: aadhaar || null,
      name: name || null,
      dob: dob || null,
      candidates: aadhaarCandidates,
      checksum_valid: Boolean(aadhaar),
    },
    detected_type: aadhaar ? "aadhaar" : "unknown",
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

function extractAadhaarSignalsFromText(text) {
  const candidates = extractAadhaarCandidates(text);
  return {
    aadhaar: candidates[0] || null,
    checksum_valid: Boolean(candidates[0]),
    candidates,
    name: extractNameFromText(text),
  };
}

module.exports = {
  extractAadhaarFromBuffer,
  extractTextFromBuffer,
  extractAadhaarSignalsFromText,
  SUPPORTED_IMAGE_TYPES,
};
