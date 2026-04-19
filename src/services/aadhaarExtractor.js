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

  const labelMatch = input.match(/(?:name|naam|नाम)[:\s-]*([A-Z][A-Za-z\s]{3,50})/i);
  if (labelMatch && labelMatch[1]) {
    const name = labelMatch[1].trim().split(/\s+/).slice(0, 5).join(" ");
    if (/^[A-Za-z\s]{3,50}$/.test(name)) return name;
  }

  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines.slice(0, 20)) {
    const match = line.match(/^([A-Z][A-Za-z\s]{3,50})$/);
    if (match && !/^(YOUR|THE|GOVERNMENT|AUTHORITY|INDIA|AADHAAR)/i.test(match[1])) {
      return match[1].trim();
    }
  }

  return null;
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

async function extractAadhaarFromBuffer({ buffer, mimeType }) {
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
  const name = extractNameFromText(ocrText);
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
