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

const DEVANAGARI_TO_ASCII = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9",
};

const OCR_DIGIT_ALIASES = {
  O: "0",
  o: "0",
  Q: "0",
  D: "0",
  I: "1",
  l: "1",
  "|": "1",
  S: "5",
  B: "8",
};

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

function isValidAadhaar(number) {
  if (!/^\d{12}$/.test(number)) return false;
  if (number[0] === "0" || number[0] === "1") return false;

  let c = 0;
  const arr = number.split("").reverse().map((n) => Number(n));
  for (let i = 0; i < arr.length; i += 1) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][arr[i]]];
  }
  return c === 0;
}

function extractCandidates(text) {
  // Step 1: normalise the whole string — Devanagari digits and OCR look-alike
  // characters become real ASCII digits BEFORE we run pattern matching.
  // This prevents greedy regex from sweeping alias chars (O, I, D, S…) that
  // appear in surrounding text into a longer false-positive match that then
  // consumes the real Aadhaar number region.
  const normalized = [...String(text || "")]
    .map((ch) => DEVANAGARI_TO_ASCII[ch] || OCR_DIGIT_ALIASES[ch] || ch)
    .join("");

  const candidates = new Set();

  // Step 2: Aadhaar-specific patterns on the normalised string.
  // XXXX XXXX XXXX — one space between each group (most common on cards/PDFs)
  const spaced = /\b\d{4}[ \t]\d{4}[ \t]\d{4}\b/g;
  // XXXX  XXXX  XXXX — multiple spaces / tab as separator
  const wideSpaced = /\b\d{4}\s+\d{4}\s+\d{4}\b/g;
  // XXXX-XXXX-XXXX — dash separator
  const dashed = /\b\d{4}-\d{4}-\d{4}\b/g;
  // 12 consecutive digits not part of a longer number
  const consecutive = /(?<!\d)\d{12}(?!\d)/g;

  for (const pattern of [spaced, wideSpaced, dashed, consecutive]) {
    const matches = normalized.match(pattern) || [];
    for (const m of matches) {
      const digits = m.replace(/\D/g, "");
      if (digits.length === 12) candidates.add(digits);
    }
  }

  // Step 3: relaxed OCR chunk scan.
  // Handles patterns like "1234 56 78 9012" or "12 34 56 78 90 12" where
  // OCR breaks grouping inconsistently across spaces/newlines/symbols.
  const relaxedChunks = normalized.match(/(?:\d\D{0,3}){12,16}/g) || [];
  for (const chunk of relaxedChunks) {
    const digitsOnly = chunk.replace(/\D/g, "");
    if (digitsOnly.length < 12) continue;

    if (digitsOnly.length === 12) {
      candidates.add(digitsOnly);
      continue;
    }

    // For overlong chunks, slide a 12-digit window and keep unique candidates.
    for (let i = 0; i <= digitsOnly.length - 12; i += 1) {
      candidates.add(digitsOnly.slice(i, i + 12));
    }
  }

  return [...candidates];
}

function extractNameFromAadhaarText(text) {
  const input = String(text || "").trim();
  if (!input) return null;

  // Prefer explicit labels first.
  const labeledPatterns = [
    /(?:name|naam|नाम)\s*[:\-]?\s*([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,3})/,
    /(?:name|naam|नाम)\s*[:\-]?\s*([A-Z]{2,}(?:\s+[A-Z]{2,}){1,3})/,
  ];

  for (const pattern of labeledPatterns) {
    const match = input.match(pattern);
    if (match && match[1]) return match[1].replace(/\s+/g, " ").trim();
  }

  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30);

  const anchorLines = [];
  lines.forEach((line, idx) => {
    if (/(dob|date\s*of\s*birth|year\s*of\s*birth|male|female|aadhaar|आधार|enrolment|uid)/i.test(line)) {
      anchorLines.push(idx);
    }
  });

  const badWords = new Set([
    "government", "india", "authority", "information", "office", "post",
    "district", "state", "letter", "generated", "your", "aadhaar", "uid",
  ]);

  const candidates = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const matches = [
      ...line.matchAll(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,3})\b/g),
      ...line.matchAll(/\b([A-Z]{2,}(?:\s+[A-Z]{2,}){1,3})\b/g),
    ];

    for (const m of matches) {
      const candidate = (m[1] || "").replace(/\s+/g, " ").trim();
      const words = candidate.split(" ").filter(Boolean);
      if (words.length < 2 || words.length > 4) continue;
      if (words.some((w) => badWords.has(w.toLowerCase()))) continue;

      let score = 0;
      if (anchorLines.some((a) => Math.abs(a - i) <= 4)) score += 4;
      if (i <= 12) score += 2;
      if (!/\d/.test(line)) score += 1;
      if (/(post|office|district|road|village|pin|ps\b|po\b)/i.test(line)) score -= 3;
      if (candidate.length >= 8 && candidate.length <= 40) score += 2;

      candidates.push({ candidate, score, idx: i });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.idx - b.idx);
  if (!candidates.length || candidates[0].score < 4) return null;
  return candidates[0].candidate;
}

function extractNameFromFilename(fileName) {
  // Extract name from filename like "Amit_adhar.pdf" or "Amit Kumar_aadhaar.jpg"
  // Keep full multi-word names before Aadhaar-related suffix tokens.
  if (!fileName || typeof fileName !== 'string') return null;

  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
  const normalizedSeparators = nameWithoutExt.replace(/[_-]+/g, ' ').trim();

  // Remove known non-name suffixes from the tail repeatedly.
  const tailNoise = new Set([
    'aadhaar', 'aadhar', 'adhar', 'adhaar', 'aadhara',
    'document', 'doc', 'card', 'proof', 'scan', 'copy',
    'front', 'back', 'final', 'new', 'updated', 'img', 'image',
  ]);

  const parts = normalizedSeparators.split(/\s+/).filter(Boolean);
  while (parts.length > 1 && tailNoise.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }

  const cleaned = parts.join(' ')
    .replace(/[^A-Za-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned && /^[A-Za-z\s]{3,100}$/.test(cleaned)) {
    const capitalized = cleaned
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    return capitalized;
  }

  return null;
}

function pickBetterName(ocrName, fileNameName) {
  const a = String(ocrName || '').trim();
  const b = String(fileNameName || '').trim();
  if (!a) return b || null;
  if (!b) return a;

  const aWords = a.split(/\s+/).filter(Boolean).length;
  const bWords = b.split(/\s+/).filter(Boolean).length;

  // Prefer the candidate with more words; if equal, prefer longer string.
  if (bWords > aWords) return b;
  if (aWords > bWords) return a;
  return b.length > a.length ? b : a;
}

function createExtractionError(message, statusCode = 400, code = "EXTRACTION_ERROR") {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function normalizeDigits(input) {
  return [...String(input || "")]
    .map((ch) => {
      if (DEVANAGARI_TO_ASCII[ch]) return DEVANAGARI_TO_ASCII[ch];
      if (OCR_DIGIT_ALIASES[ch]) return OCR_DIGIT_ALIASES[ch];
      return ch;
    })
    .join("");
}

async function extractAadhaarWithLlmFallback(text) {
  if (!config.llmAadhaarFallbackEnabled) return null;
  if (!config.llmAadhaarApiKey || !config.llmAadhaarModel) return null;

  const plainText = String(text || "").trim();
  if (!plainText) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.llmAadhaarRequestTimeoutMs);

  try {
    const response = await fetch(config.llmAadhaarApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.llmAadhaarApiKey}`,
      },
      body: JSON.stringify({
        model: config.llmAadhaarModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Extract only an Aadhaar number from OCR/PDF text. Return strict JSON with key aadhaar. If uncertain, return aadhaar as null.",
          },
          {
            role: "user",
            content: [
              "Find Aadhaar in this text. Output JSON only: {\"aadhaar\":\"12 digits or null\"}.",
              "Do not invent numbers. Use only numbers present in text.",
              plainText.slice(0, 8000),
            ].join("\n"),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content || "";
    if (!content) return null;

    let parsed = null;
    try {
      parsed = JSON.parse(content);
    } catch (_err) {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        parsed = JSON.parse(match[0]);
      } catch (_err2) {
        return null;
      }
    }

    const candidate = normalizeDigits(parsed?.aadhaar).replace(/\D/g, "");
    if (candidate.length !== 12) return null;
    if (!isValidAadhaar(candidate)) return null;

    return candidate;
  } catch (_err) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function extractAadhaarWithLlmVisionFallback({ buffer, mimeType }) {
  if (!config.llmAadhaarFallbackEnabled) return null;
  if (!config.llmAadhaarApiKey || !config.llmAadhaarModel) return null;
  if (!SUPPORTED_IMAGE_TYPES.includes(String(mimeType || "").toLowerCase())) return null;
  if (!buffer || buffer.length > 4 * 1024 * 1024) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.llmAadhaarRequestTimeoutMs);

  try {
    const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    const response = await fetch(config.llmAadhaarApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.llmAadhaarApiKey}`,
      },
      body: JSON.stringify({
        model: config.llmAadhaarModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Extract only Aadhaar number from image. Return strict JSON with key aadhaar. If uncertain, return aadhaar as null.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Read this document image and return JSON only: {\"aadhaar\":\"12 digits or null\"}. Do not invent numbers.",
              },
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content || "";
    if (!content) return null;

    let parsed = null;
    try {
      parsed = JSON.parse(content);
    } catch (_err) {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        parsed = JSON.parse(match[0]);
      } catch (_err2) {
        return null;
      }
    }

    const candidate = normalizeDigits(parsed?.aadhaar).replace(/\D/g, "");
    if (candidate.length !== 12) return null;
    if (!isValidAadhaar(candidate)) return null;

    return candidate;
  } catch (_err) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function extractTextFromImage(buffer) {
  let workerError = null;
  const worker = await createWorker("eng", 1, {
    // Prevent tesseract.js from throwing an uncaught exception that crashes Node.
    errorHandler: (err) => {
      workerError = err;
    },
  });
  try {
    const { data } = await worker.recognize(buffer);
    if (workerError && !String(data?.text || "").trim()) {
      throw createExtractionError(
        "Image OCR failed. Upload a clearer JPG, PNG, or WEBP Aadhaar image.",
        422,
        "IMAGE_OCR_FAILED"
      );
    }
    return data?.text || "";
  } catch (_err) {
    throw createExtractionError(
      "Image OCR failed. Upload a clearer JPG, PNG, or WEBP Aadhaar image.",
      422,
      "IMAGE_OCR_FAILED"
    );
  } finally {
    await worker.terminate().catch(() => {});
  }
}

function scoreOcrTextQuality(text) {
  const value = String(text || "");
  if (!value.trim()) return 0;
  const alphaNum = (value.match(/[A-Za-z0-9]/g) || []).length;
  const words = (value.match(/[A-Za-z]{3,}/g) || []).length;
  const lines = value.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
  const normalized = value.toLowerCase();

  const semanticKeywords = [
    "aadhaar", "aadhar", "uid", "uidai", "enrolment", "enrollment",
    "bank", "passbook", "account", "ifsc", "branch", "savings", "customer",
    "land", "lease", "khasra", "khata", "patta", "jamabandi",
  ];
  const keywordHits = semanticKeywords.reduce(
    (acc, k) => acc + (normalized.includes(k) ? 1 : 0),
    0
  );

  const ifscHits = (value.match(/\b[A-Z]{4}0[A-Z0-9]{6}\b/g) || []).length;
  const accountHits = (value.match(/(?<!\d)\d{9,18}(?!\d)/g) || []).length;

  // Penalize text with too much symbol noise.
  const symbolChars = (value.match(/[^A-Za-z0-9\s]/g) || []).length;
  const totalChars = Math.max(1, value.length);
  const symbolRatioPenalty = symbolChars / totalChars > 0.22 ? 40 : 0;

  return (
    alphaNum +
    words * 4 +
    lines * 2 +
    keywordHits * 30 +
    ifscHits * 55 +
    Math.min(accountHits, 3) * 20 -
    symbolRatioPenalty
  );
}

async function rotateImageBuffer(buffer, degrees) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocr-rotate-"));
  const inputPath = path.join(tempDir, "in.jpg");
  const outputPath = path.join(tempDir, "out.jpg");

  try {
    await fs.writeFile(inputPath, buffer);
    await execFileAsync("sips", ["-r", String(degrees), inputPath, "--out", outputPath], {
      timeout: 10000,
    });
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function enhanceImageContrast(buffer) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocr-enhance-"));
  const inputPath = path.join(tempDir, "in.jpg");
  const outputPath = path.join(tempDir, "out.jpg");

  try {
    await fs.writeFile(inputPath, buffer);
    // Enhance contrast and sharpness using sips
    // -e increases contrast by darkening shadows and lightening highlights
    await execFileAsync("sips", ["-e", "adaptive", inputPath, "--out", outputPath], {
      timeout: 10000,
    }).catch(() => {
      // If adaptive enhancement fails, try simpler contrast boost
      return execFileAsync("sips", ["--contrastAdjustment", "50", inputPath, "--out", outputPath], {
        timeout: 10000,
      }).catch(() => {
        // If both fail, just copy the original
        return fs.copyFile(inputPath, outputPath);
      });
    });
    return await fs.readFile(outputPath);
  } catch (_err) {
    // If any error, return original buffer
    return buffer;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function upscaleImageBuffer(buffer, width) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocr-upscale-"));
  const inputPath = path.join(tempDir, "in.jpg");
  const outputPath = path.join(tempDir, "out.jpg");

  try {
    await fs.writeFile(inputPath, buffer);
    await execFileAsync("sips", ["--resampleWidth", String(width), inputPath, "--out", outputPath], {
      timeout: 12000,
    });
    return await fs.readFile(outputPath);
  } catch (_err) {
    return buffer;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function extractTextFromImageWithOrientationFallback(buffer) {
  let bestText = "";
  let bestMethod = "image_ocr";
  let bestScore = -1;

  const attempts = [
    { rotate: 0, enhance: false, method: "image_ocr" },
    { rotate: 90, enhance: false, method: "image_ocr_rot90" },
    { rotate: 270, enhance: false, method: "image_ocr_rot270" },
    // Try enhanced contrast versions for better field extraction
    { rotate: 0, enhance: true, method: "image_ocr_enhanced" },
    { rotate: 90, enhance: true, method: "image_ocr_rot90_enhanced" },
    { rotate: 270, enhance: true, method: "image_ocr_rot270_enhanced" },
    // Upscaled attempts help recover faint trailing digits in account/IFSC fields.
    { rotate: 270, enhance: true, upscaleWidth: 2200, method: "image_ocr_rot270_enhanced_up2200" },
    { rotate: 270, enhance: true, upscaleWidth: 3000, method: "image_ocr_rot270_enhanced_up3000" },
  ];

  let hadAnySuccess = false;
  for (const attempt of attempts) {
    try {
      let candidateBuffer = attempt.rotate === 0 ? buffer : await rotateImageBuffer(buffer, attempt.rotate);
      if (attempt.enhance) {
        candidateBuffer = await enhanceImageContrast(candidateBuffer);
      }
      if (attempt.upscaleWidth) {
        candidateBuffer = await upscaleImageBuffer(candidateBuffer, attempt.upscaleWidth);
      }
      const text = await extractTextFromImage(candidateBuffer);
      const score = scoreOcrTextQuality(text);
      if (score > bestScore) {
        bestScore = score;
        bestText = text;
        bestMethod = attempt.method;
      }
      hadAnySuccess = true;
    } catch (_err) {
      // Try next orientation/enhancement.
    }
  }

  if (!hadAnySuccess) {
    throw createExtractionError(
      "Image OCR failed. Upload a clearer JPG, PNG, or WEBP Aadhaar image.",
      422,
      "IMAGE_OCR_FAILED"
    );
  }

  return { text: bestText || "", method: bestMethod };
}

async function extractTextFromPdf(buffer) {
  const parsed = await pdfParse(buffer);
  return parsed.text || "";
}

async function extractTextFromPdfFirstPageImage(buffer) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "aadhaar-pdf-"));
  const inputPdf = path.join(tempDir, "document.pdf");
  const outputPng = path.join(tempDir, "document.png");

  try {
    await fs.writeFile(inputPdf, buffer);
    await execFileAsync("sips", ["-s", "format", "png", inputPdf, "--out", outputPng], {
      timeout: 15000,
    });
    // Higher width helps OCR recover weak text like names/digits.
    await execFileAsync("sips", ["--resampleWidth", "2200", outputPng], {
      timeout: 15000,
    }).catch(() => {});
    const imageBuffer = await fs.readFile(outputPng);
    // Keep PDF fallback lightweight to avoid slow scans.
    return await extractTextFromImage(imageBuffer);
  } catch (_err) {
    return "";
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function extractTextFromPdfMultiPageImage(buffer) {
  // For now, this implements best-effort multi-page OCR using sips + Tesseract.
  // Note: macOS `sips` doesn't natively support page-specific extraction from PDFs,
  // so we convert the entire PDF to image(s) and OCR what we can.
  // In the future, consider using pdftoppm or Python libraries for full multi-page support.

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "aadhaar-pdf-page-"));
  try {
    const inputPdf = path.join(tempDir, "document.pdf");
    const outputPng = path.join(tempDir, "document.png");

    await fs.writeFile(inputPdf, buffer);

    // Use sips to convert PDF to PNG (this will convert the first page on macOS)
    // If we need multi-page support with sips, we'd need to use pdftoppm first
    // to extract each page separately, then OCR each one.
    await execFileAsync("sips", ["-s", "format", "png", inputPdf, "--out", outputPng], {
      timeout: 15000,
    });
    await execFileAsync("sips", ["--resampleWidth", "2200", outputPng], {
      timeout: 15000,
    }).catch(() => {});

    const imageBuffer = await fs.readFile(outputPng);
    const pageText = await extractTextFromImage(imageBuffer);

    if (!pageText) {
      return {
        text: "",
        page_found: null,
        candidates: [],
      };
    }

    const pageCandidates = extractCandidates(pageText);
    const validOnPage = pageCandidates.find((n) => isValidAadhaar(n));

    return {
      text: pageText,
      page_found: validOnPage ? 1 : null,
      candidates: pageCandidates,
    };
  } catch (_err) {
    return {
      text: "",
      page_found: null,
      candidates: [],
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function extractTextFromBuffer({ buffer, mimeType }) {
  const type = String(mimeType || "").toLowerCase();
  let text = "";
  let source = "image";
  let extraction_method = "none";
  let warning = "";
  let warning_code = "";

  if (!type) {
    throw createExtractionError("Document type is missing", 400, "MIME_TYPE_MISSING");
  }

  if (type.includes("pdf")) {
    source = "pdf";
    try {
      text = await extractTextFromPdf(buffer);
      extraction_method = text ? "pdf_text" : "pdf_text_empty";
    } catch (_err) {
      warning = "PDF parsing failed. Trying OCR on PDF image...";
      warning_code = "PDF_PARSE_FAILED";
    }

    if (!text) {
      const pdfImageText = await extractTextFromPdfFirstPageImage(buffer);
      if (pdfImageText) {
        text = pdfImageText;
        extraction_method = "pdf_image_ocr";
      }
    }

    if (!text) {
      const multiPageResult = await extractTextFromPdfMultiPageImage(buffer);
      if (multiPageResult?.text) {
        text = multiPageResult.text;
        extraction_method = "pdf_image_ocr_multi_page";
      }
    }

    if (!text) {
      warning = warning || "Could not extract readable text from PDF.";
      warning_code = warning_code || "PDF_TEXT_UNAVAILABLE";
    } else if (warning_code === "PDF_PARSE_FAILED") {
      // OCR fallback succeeded, so do not surface parse warning as an error.
      warning = "";
      warning_code = "";
    }
  } else if (SUPPORTED_IMAGE_TYPES.includes(type)) {
    source = "image";
    try {
      const ocr = await extractTextFromImageWithOrientationFallback(buffer);
      text = ocr.text;
      extraction_method = text ? ocr.method : "image_ocr_empty";
      if (!text) {
        warning = "Image OCR produced no readable text.";
        warning_code = "IMAGE_TEXT_UNAVAILABLE";
      }
    } catch (_err) {
      warning = "Image OCR failed. Upload a clearer JPG, PNG, or WEBP image.";
      warning_code = "IMAGE_OCR_FAILED";
      extraction_method = "none";
    }
  } else {
    throw createExtractionError(
      "Unsupported document type. Upload PDF, JPG, PNG, or WEBP.",
      400,
      "UNSUPPORTED_DOCUMENT_TYPE"
    );
  }

  return {
    text,
    source,
    extraction_method,
    warning,
    warning_code,
  };
}

async function extractAadhaarFromBuffer({ buffer, mimeType, fileName = "" }) {
  const type = String(mimeType || "").toLowerCase();
  let text = "";
  let source = "image";
  let imageExtractionMethod = "none";
  let imageOcrError = null;
  let pdfParseError = null;

  if (!type) {
    throw createExtractionError("Document type is missing", 400, "MIME_TYPE_MISSING");
  }

  if (type.includes("pdf")) {
    source = "pdf";
    try {
      text = await extractTextFromPdf(buffer);
    } catch (_err) {
      pdfParseError = createExtractionError(
        "PDF parsing failed. Trying OCR on PDF image...",
        422,
        "PDF_PARSE_FAILED"
      );
      text = "";
    }
  } else if (SUPPORTED_IMAGE_TYPES.includes(type)) {
    try {
      // Fast path first (previously working behavior).
      text = await extractTextFromImage(buffer);
      imageExtractionMethod = "image_ocr_fast";

      // If fast OCR text has no Aadhaar-like digits, do one stronger fallback pass.
      const hasAadhaarLike = /\b\d{4}[\s\-]*\d{4}[\s\-]*\d{4}\b|(?<!\d)\d{12}(?!\d)/.test(text || "");
      if (!hasAadhaarLike) {
        const ocrFallback = await extractTextFromImageWithOrientationFallback(buffer);
        if ((ocrFallback?.text || "").trim()) {
          text = ocrFallback.text;
          imageExtractionMethod = ocrFallback.method || "image_ocr_fallback";
        }
      }
    } catch (err) {
      imageOcrError = err;
      text = "";
    }
  } else {
    throw createExtractionError(
      "Unsupported document type. Upload PDF, JPG, PNG, or WEBP.",
      400,
      "UNSUPPORTED_DOCUMENT_TYPE"
    );
  }

  const candidates = extractCandidates(text);
  const valid = candidates.find((n) => isValidAadhaar(n));
  let aadhaar = valid || candidates[0] || null;
  let checksumValid = Boolean(valid);
  let extractionMethod = valid
    ? (source === "image" ? `${imageExtractionMethod}_regex` : "regex")
    : aadhaar
      ? (source === "image" ? `${imageExtractionMethod}_candidate` : "candidate")
      : "none";

  if (!aadhaar && source === "pdf") {
    // Try multiple pages with OCR
    const multiPageResult = await extractTextFromPdfMultiPageImage(buffer);
    const pdfImageText = multiPageResult.text;
    if (pdfImageText) {
      const imageCandidates = extractCandidates(pdfImageText);
      const imageValid = imageCandidates.find((n) => isValidAadhaar(n));
      if (imageValid || imageCandidates[0]) {
        aadhaar = imageValid || imageCandidates[0];
        checksumValid = Boolean(imageValid);
        extractionMethod = imageValid ? "pdf_image_ocr" : "pdf_image_candidate";
      }
      imageCandidates.forEach((item) => {
        if (!candidates.includes(item)) candidates.push(item);
      });
      if (!text) {
        text = pdfImageText;
      }
    }
  }

  if (!aadhaar) {
    const llmAadhaar = await extractAadhaarWithLlmFallback(text);
    if (llmAadhaar) {
      aadhaar = llmAadhaar;
      checksumValid = true;
      extractionMethod = "llm_fallback";
      candidates.push(llmAadhaar);
    } else if (imageOcrError?.code === "IMAGE_OCR_FAILED") {
      const llmVisionAadhaar = await extractAadhaarWithLlmVisionFallback({
        buffer,
        mimeType: type,
      });
      if (llmVisionAadhaar) {
        aadhaar = llmVisionAadhaar;
        checksumValid = true;
        extractionMethod = "llm_vision_fallback";
        candidates.push(llmVisionAadhaar);
      }
    }
  }

  let warning = "";
  if (!aadhaar) {
    if (source === "pdf") {
      warning = pdfParseError
        ? "PDF text parse failed and OCR could not detect Aadhaar. Upload a clearer PDF or JPG/PNG image."
        : "No Aadhaar number detected in this PDF. If this is a scanned PDF image, upload a clear JPG/PNG or a searchable PDF.";
    } else if (imageOcrError?.code === "IMAGE_OCR_FAILED") {
      warning = "Image OCR failed. Upload a clearer JPG, PNG, or WEBP Aadhaar image.";
    } else {
      warning = "No Aadhaar number detected. Upload a clearer image with full 12-digit Aadhaar visible.";
    }
  }

  // Name should come from document content only (never filename),
  // even if Aadhaar number confidence is low/missing.
  const extractedName = extractNameFromAadhaarText(text);

  return {
    aadhaar,
    name: extractedName,
    checksum_valid: checksumValid,
    candidates,
    text_preview: text.slice(0, 500),
    warning,
    extraction_method: extractionMethod,
    llm_fallback_used: extractionMethod === "llm_fallback",
  };
}

function extractAadhaarSignalsFromText(text) {
  const source = String(text || "");
  const candidates = extractCandidates(source);
  const valid = candidates.find((n) => isValidAadhaar(n));
  return {
    aadhaar: valid || candidates[0] || null,
    checksum_valid: Boolean(valid),
    candidates,
    name: extractNameFromAadhaarText(source),
  };
}

module.exports = {
  extractAadhaarFromBuffer,
  extractTextFromBuffer,
  extractAadhaarSignalsFromText,
  SUPPORTED_IMAGE_TYPES,
};
