const pdfParse = require("pdf-parse");
const { createWorker } = require("tesseract.js");
const config = require("../config");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// Simple Aadhaar validation - 12 digits, no leading 0 or 1
function isValidAadhaarFormat(number) {
  if (!/^\d{12}$/.test(number)) return false;
  if (number[0] === "0" || number[0] === "1") return false;
  return true;
}

// Extract all 12-digit Aadhaar candidates from text
function extractAadhaarCandidates(text) {
  const input = String(text || "");
  const candidates = new Set();

  // Pattern 1: XXXX XXXX XXXX (most common)
  const spaced = input.match(/\d{4}\s\d{4}\s\d{4}/g) || [];
  spaced.forEach(match => {
    const digits = match.replace(/\D/g, "");
    if (isValidAadhaarFormat(digits)) candidates.add(digits);
  });

  // Pattern 2: XXXX  XXXX  XXXX (multiple spaces/tabs)
  const wideSpaced = input.match(/\d{4}\s+\d{4}\s+\d{4}/g) || [];
  wideSpaced.forEach(match => {
    const digits = match.replace(/\D/g, "");
    if (isValidAadhaarFormat(digits)) candidates.add(digits);
  });

  // Pattern 3: XXXX-XXXX-XXXX (dash separated)
  const dashed = input.match(/\d{4}-\d{4}-\d{4}/g) || [];
  dashed.forEach(match => {
    const digits = match.replace(/\D/g, "");
    if (isValidAadhaarFormat(digits)) candidates.add(digits);
  });

  // Pattern 4: 12 consecutive digits (not part of longer sequence)
  const consecutive = input.match(/(?<!\d)\d{12}(?!\d)/g) || [];
  consecutive.forEach(match => {
    if (isValidAadhaarFormat(match)) candidates.add(match);
  });

  return [...candidates];
}



// Extract name from OCR text
function extractNameFromText(text) {
  const input = String(text || "").trim();
  if (!input.length || input.length > 10000) return null;

  // Look for labeled name pattern
  const labelMatch = input.match(/(?:name|naam|नाम)[:\s-]*([A-Z][A-Za-z\s]{3,50})/i);
  if (labelMatch && labelMatch[1]) {
    const name = labelMatch[1].trim().split(/\s+/).slice(0, 5).join(' ');
    if (/^[A-Za-z\s]{3,50}$/.test(name)) return name;
  }

  // Find capitalized names (likely candidates)
  const lines = input.split(/\r?\n/).filter(l => l.trim().length > 3);
  for (const line of lines.slice(0, 15)) {
    const match = line.match(/^([A-Z][A-Za-z\s]{3,50})$/);
    if (match && !/^(YOUR|THE|GOVERNMENT|AUTHORITY|INDIA|AADHAAR)/.test(match[1])) {
      return match[1].trim();
    }
  }

  return null;
}

// Extract DOB from OCR text
function extractDobFromText(text) {
  const input = String(text || "").trim();
  
  // Patterns: DD/MM/YYYY, DD-MM-YYYY, DD MM YYYY
  const patterns = [
    /\b(\d{1,2})[-\/\s](\d{1,2})[-\/\s](\d{4})\b/,
    /\b(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\b/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      const [, p1, p2, p3] = match;
      // Assume first pattern is DD/MM/YYYY
      if (p1.length <= 2 && p2.length <= 2 && p3.length === 4) {
        return `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
      } else if (p1.length === 4) {
        // YYYY-MM-DD format
        return `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
      }
    }
  }
  
  return null;
}

// Extract text from image using OCR
async function extractTextFromImage(buffer) {
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(buffer);
    const text = data?.text || "";
    
    if (!text.trim()) {
      throw new Error("OCR failed to extract text from image");
    }
    
    return text;
  } finally {
    await worker.terminate().catch(() => {});
  }
}

// Convert PDF buffer to image and extract text
async function extractTextFromPdf(buffer) {
  try {
    // First try to extract text directly from PDF
    const pdfData = await pdfParse(buffer);
    const pdfText = pdfData?.text || "";
    
    // If PDF text extraction worked and has content, use it
    if (pdfText.trim().length > 50) {
      return pdfText;
    }
    
    // Otherwise, convert PDF to image and use OCR
    throw new Error("PDF text extraction failed, will use OCR");
  } catch (_err) {
    // Convert PDF pages to images and run OCR
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "aadhaar-"));
    try {
      // Use ImageMagick to convert first page of PDF to image
      const imagePath = path.join(tmpDir, "page.jpg");
      await execFileAsync("convert", [
        "-density", "150",
        `${buffer.length === 0 ? "-" : "-[0]"}`,  // First page only
        imagePath
      ], { input: buffer, maxBuffer: 10 * 1024 * 1024 });
      
      const imageBuffer = await fs.readFile(imagePath);
      return await extractTextFromImage(imageBuffer);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }
}

// Main Aadhaar extraction function
async function extractAadhaarFromBuffer({ buffer, mimeType, fileName }) {
  if (!buffer || buffer.length === 0) {
    throw new Error("Empty document buffer");
  }

  let ocrText = "";
  let extractionMethod = "none";

  try {
    // Extract text based on file type
    if (String(mimeType || "").toLowerCase().includes("pdf")) {
      ocrText = await extractTextFromPdf(buffer);
      extractionMethod = "pdf_ocr";
    } else if (SUPPORTED_IMAGE_TYPES.includes(String(mimeType || "").toLowerCase())) {
      ocrText = await extractTextFromImage(buffer);
      extractionMethod = "image_ocr";
    } else {
      throw new Error("Unsupported document type");
    }

    // Extract Aadhaar number
    const aadhaarCandidates = extractAadhaarCandidates(ocrText);
    const aadhaar = aadhaarCandidates.length > 0 ? aadhaarCandidates[0] : null;

    // Extract additional data
    const name = extractNameFromText(ocrText);
    const dob = extractDobFromText(ocrText);

    // Calculate confidence
    let confidence = 0;
    if (aadhaar) confidence += 0.5;
    if (name) confidence += 0.25;
    if (dob) confidence += 0.25;

    return {
      aadhaar,
      name: name || null,
      dob: dob || null,
      extraction_method: extractionMethod,
      text_preview: ocrText.slice(0, 500),
      fields: {
        aadhaar: aadhaar || null,
        name: name || null,
        dob: dob || null,
      },
      detected_type: "aadhaar",
      confidence: Math.max(0, Math.min(1, confidence)),
    };
  } catch (error) {
    const message = String(error?.message || "Failed to extract Aadhaar");
    const code = ocrText.length === 0 ? "OCR_FAILED" : "AADHAAR_EXTRACTION_FAILED";
    
    throw {
      ok: false,
      error: message,
      code,
      statusCode: 422,
      detected_type: "unknown",
      confidence: 0,
    };
  }
}

// Export main functions
module.exports = {
  extractAadhaarFromBuffer,
  extractAadhaarSignalsFromText: (text) => {
    const candidates = extractAadhaarCandidates(text);
    return {
      aadhaar: candidates[0] || null,
      candidates,
      name: extractNameFromText(text),
    };
  },
  SUPPORTED_IMAGE_TYPES,
};
