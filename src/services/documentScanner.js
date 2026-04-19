const {
  extractTextFromBuffer,
  extractAadhaarSignalsFromText,
} = require("./aadhaarExtractor");

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOcrLikeText(value) {
  // Normalize frequent OCR confusions so keyword matching survives noisy scans.
  return normalizeText(value)
    .replace(/[|!]/g, "i")
    .replace(/0/g, "o")
    .replace(/1/g, "l")
    .replace(/5/g, "s")
    .replace(/8/g, "b")
    .replace(/\$/g, "s");
}

function countKeywordHits(text, keywords) {
  return keywords.reduce((acc, word) => (text.includes(word) ? acc + 1 : acc), 0);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeAccountCandidates(candidates) {
  const raw = unique((candidates || []).map((v) => String(v || "").replace(/\D/g, ""))).filter(Boolean);
  const expanded = [];

  for (const value of raw) {
    expanded.push(value);

    // OCR sometimes inserts an extra "1" right before a long run of zeros.
    // Example: 713710310000003 -> 71371030000003
    if (value.length === 15 && /\d+10{5,}\d{1,2}$/.test(value)) {
      const fixed = value.replace(/(\d+)1(0{5,}\d{1,2})$/, "$1$2");
      if (fixed.length >= 9 && fixed.length <= 18) expanded.push(fixed);
    }

    // If OCR appends one extra trailing zero, trim a single trailing zero variant.
    if (value.length >= 15 && /0$/.test(value)) {
      expanded.push(value.slice(0, -1));
    }
  }

  return unique(expanded);
}

function deriveIfscFromLabeledToken(bankName, sourceText) {
  const source = String(sourceText || "");
  const lines = source.split(/\r?\n/);
  let token = "";

  for (const line of lines) {
    const value = String(line || "").toUpperCase();
    if (!value.trim()) continue;
    if (/MICR/.test(value)) continue;
    if (!/(IFSC|ISC|CODE)/.test(value)) continue;

    const candidates = value.match(/[A-Z0-9$|]{10,14}/g) || [];
    if (candidates.length) {
      token = candidates[0];
      break;
    }
  }

  if (!token) return null;

  const normalizedToken = token
    .replace(/[|!]/g, "I")
    .replace(/\$/g, "B")
    .replace(/[^A-Z0-9]/g, "");

  const digits = normalizedToken.replace(/\D/g, "");
  const normalizedBank = String(bankName || "").toLowerCase();

  // Direct fix for common OCR form: BK1D0007137 -> BKID0007137
  const direct = normalizedToken
    .replace(/^BK1D/, "BKID")
    .replace(/^BKlD/, "BKID")
    .slice(0, 11);
  if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(direct)) return direct;

  // Bank of India IFSC format: BKID0 + 6 chars. OCR usually preserves branch digits.
  if (normalizedBank.includes("bank of india") && digits.length >= 6) {
    const branch = digits.slice(-6);
    const candidate = `BKID0${branch}`;
    if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(candidate)) return candidate;
  }

  // State Bank of India fallback if needed later.
  if (normalizedBank.includes("state bank of india") && digits.length >= 6) {
    const branch = digits.slice(-6);
    const candidate = `SBIN0${branch}`;
    if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(candidate)) return candidate;
  }

  // Indian Overseas Bank fallback.
  if ((normalizedBank.includes("indian overseas bank") || normalizedBank.includes("overseas bank")) && digits.length >= 6) {
    const branch = digits.slice(-6);
    const candidate = `IOBA0${branch}`;
    if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(candidate)) return candidate;
  }

  return null;
}

function detectDocumentType(text) {
  const normalized = normalizeText(text);
  const normalizedOcr = normalizeOcrLikeText(text);

  const ifscPattern = /\b[a-z]{4}0[a-z0-9]{6}\b/i;
  const accountPattern = /(?<!\d)\d{9,18}(?!\d)/;

  const hasIfsc = ifscPattern.test(String(text || ""));
  const hasAccountLike = accountPattern.test(String(text || ""));

  // OCR-tolerant keyword sets.
  const bankKeywords = [
    "passbook",
    "bank",
    "account",
    "ifsc",
    "branch",
    "a/c",
    "acc no",
    "account no",
    "savings",
    "statement",
    "micr",
    "upi",
    "customer id",
  ];

  const aadhaarKeywords = ["aadhaar", "aadhar", "uidai", "enrolment", "enrollment", "your aadhaar no"];

  const landKeywords = [
    "land",
    "lease",
    "khasra",
    "khata",
    "patta",
    "jamabandi",
    "raiyat",
    "record of rights",
    "mutation",
  ];

  const scores = {
    aadhaar: countKeywordHits(normalized, aadhaarKeywords) + countKeywordHits(normalizedOcr, aadhaarKeywords),
    bank_passbook: countKeywordHits(normalized, bankKeywords) + countKeywordHits(normalizedOcr, bankKeywords),
    land_proof: countKeywordHits(normalized, landKeywords) + countKeywordHits(normalizedOcr, landKeywords),
  };

  // Structural signals are strong predictors for passbook documents.
  if (hasIfsc) scores.bank_passbook += 4;
  if (hasAccountLike) scores.bank_passbook += 2;

  // If Aadhaar-like 12-digit grouping appears with Aadhaar keywords, bias Aadhaar.
  if (/\b\d{4}[\s-]\d{4}[\s-]\d{4}\b/.test(normalized) && scores.aadhaar > 0) {
    scores.aadhaar += 3;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestType, bestScore] = sorted[0];
  const secondScore = sorted[1] ? sorted[1][1] : 0;

  if (!bestScore) {
    return { detected_type: "unknown", confidence: 0 };
  }

  const confidence = Math.min(0.99, 0.45 + (bestScore - secondScore) * 0.15 + bestScore * 0.05);
  return {
    detected_type: bestType,
    confidence: Number(confidence.toFixed(2)),
  };
}

function pickLikelyBankName(lines) {
  const candidates = [];
  for (const rawLine of lines) {
    const line = String(rawLine || "").trim();
    if (!line) continue;
    if (!/bank/i.test(line)) continue;
    if (/(ifsc|branch|account|a\/c|micr|code|no\.?)/i.test(line)) continue;

    const cleaned = line
      .replace(/[^A-Za-z&.,\-\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned || cleaned.length < 5 || cleaned.length > 80) continue;
    candidates.push(cleaned);
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

function extractKnownBankName(source) {
  const compact = String(source || "").toLowerCase().replace(/[^a-z]/g, "");
  const known = [
    { key: "indianoverseasbank", name: "Indian Overseas Bank" },
    { key: "overseasbank", name: "Indian Overseas Bank" },
    { key: "statebankofindia", name: "State Bank of India" },
    { key: "bankofindia", name: "Bank of India" },
    { key: "bankofbaroda", name: "Bank of Baroda" },
    { key: "punjabnationalbank", name: "Punjab National Bank" },
    { key: "canarabank", name: "Canara Bank" },
    { key: "unionbankofindia", name: "Union Bank of India" },
    { key: "indianbank", name: "Indian Bank" },
    { key: "centralbankofindia", name: "Central Bank of India" },
    { key: "icicibank", name: "ICICI Bank" },
    { key: "hdfcbank", name: "HDFC Bank" },
    { key: "axisbank", name: "Axis Bank" },
    { key: "kotakmahindrabank", name: "Kotak Mahindra Bank" },
    { key: "yesbank", name: "Yes Bank" },
    { key: "uco", name: "UCO Bank" },
  ];

  for (const bank of known) {
    if (compact.includes(bank.key)) return bank.name;
  }
  return null;
}

function pickLikelyAccountNumber(candidates) {
  const cleaned = normalizeAccountCandidates(candidates);
  if (!cleaned.length) return null;

  const scored = cleaned.map((n) => {
    let score = 0;
    // Prefer Indian bank account lengths: 10-18 digits, with sweet spot at 14-16
    if (n.length === 14) score += 12; // Most common for these passbooks
    else if (n.length >= 15 && n.length <= 16) score += 8;
    else if (n.length >= 11 && n.length <= 13) score += 4; // Slightly shorter
    else if (n.length >= 9 && n.length <= 18) score += 2;  // Acceptable range
    
    // Penalize helpline numbers and short sequences
    if (/^1800/.test(n) || /^1860/.test(n)) score -= 10;
    if (n.length <= 10) score -= 3;  // Too short for account
    
    // Reward non-repeating digits (real account, not padding)
    if (!/^(\d)\1+$/.test(n)) score += 2;
    return { n, score };
  });

  scored.sort((a, b) => b.score - a.score || b.n.length - a.n.length);
  return scored[0]?.n || null;
}

function normalizeIfscCandidates(text) {
  const source = String(text || "").toUpperCase();
  
  // First, try to extract IFSC from labeled fields: "IFSC code: XXXXX" or similar
  const labeledIfscMatches = [];
  const labelRegex = /(?:ifsc|isc)\s*(?:code|no\.?|number|#)?\s*[:\-]?\s*(\S+)/gi;
  let labelMatch = null;
  while ((labelMatch = labelRegex.exec(source)) !== null) {
    let rawCode = String(labelMatch[1] || "")
      .replace(/[\s\-\.]/g, "")
      .trim()
      .slice(0, 15);  // Get first 15 chars
    
    if (rawCode.length >= 10) {
      labeledIfscMatches.push(rawCode);
    }
  }
  
  // Then look for the standard IFSC pattern (4 letters, 0, 6 alphanumerics)
  const raw = source.match(/\b[A-Z]{4}[0O][A-Z0-9]{6}\b/g) || [];
  
  // Look for relaxed patterns: any sequence with letters and a zero that could be IFSC-like
  const relaxedPattern = source.match(/\b[A-Z$|]*[0O][A-Z0-9]{5,8}\b/g) || [];
  
  const allCandidates = [...labeledIfscMatches, ...raw, ...relaxedPattern]
    .map((code) => {
      let original = String(code || "");
      let normalized = original
        .toUpperCase()
        .replace(/[\$@#&!_\s\-\.]/g, "")  // Remove garbage characters and spacers
        .slice(0, 15);
      
      // If too short, skip
      if (normalized.length < 10) return null;
      
      // Try AGGRESSIVE error correction for codes that look like they might be IFSC
      // but with heavy OCR corruption
      if (/[BK0-9]{9,}/.test(normalized)) {
        // Try different interpretations
        let candidates = [];
        
        // Interpretation 1: First char is garbage, remove it
        if (normalized.length >= 11) {
          let trimmed = normalized.slice(1, 12);
          if (/^[A-Z]{3}0[A-Z0-9]{6}$/.test(trimmed)) {
            candidates.push("B" + trimmed);  // Prepend B for Bank codes
          }
        }
        
        // Interpretation 2: Clean all special chars and rebuild as BKID0XXXXX format
        let digits = normalized.replace(/[^A-Z0-9]/g, "");
        if (digits.match(/^[A-Z]*0\d+$/)) {
          // Has a zero in the middle with non-digits around it
          const match = digits.match(/^([A-Z]+)0(\d{6,})$/);
          if (match && [2, 3, 4].includes(match[1].length)) {
            // Pad bank code to 4 letters with 'I' if needed (common fill)
            let bankCode = match[1];
            while (bankCode.length < 4) bankCode += "I";
            let result = bankCode.slice(0, 4) + "0" + match[2].slice(0, 6);
            if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(result)) {
              candidates.push(result);
            }
          }
        }
        
        // Interpretation 3: $K00007157 → try BKID0157 type patterns
        if (normalized[0] === "$" || /^[^A-Z]/.test(normalized)) {
          let afterGarbage = normalized.replace(/^[^A-Z]*/, "");
          if (afterGarbage.length >= 10) {
            // Try normal IFSC check on the rest
            if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(afterGarbage.slice(0, 11))) {
              candidates.push(afterGarbage.slice(0, 11));
            }
          }
        }
        
        if (candidates.length > 0) return candidates[0];
      }
      
      // Standard cleanup for well-formed-looking codes
      normalized = normalized
        .replace(/\$/g, "B")           // $ -> B
        .replace(/[|!]/g, "I")         // | or ! -> I
        .replace(/[O]/g, "0")          // O -> 0
        .replace(/[l]/g, "1")          // l -> 1
        .replace(/[S]/g, "5")          // S -> 5
        .slice(0, 12);

      // OCR often reads I as 1 in bank code: BK1D -> BKID, I0BA -> IOBA.
      normalized = `${normalized.slice(0, 4).replace(/1/g, "I")}${normalized.slice(4)}`;

      // OCR sometimes inserts an extra letter before the required zero: IOBAU0C00405 -> IOBA0C00405.
      if (/^[A-Z]{4}[A-Z][0O][A-Z0-9]{5,6}$/.test(normalized)) {
        normalized = `${normalized.slice(0, 4)}${normalized.slice(5)}`;
      }

      // After the bank code, letters are often zero-like OCR noise in IFSC branch digits.
      if (/^[A-Z]{4}[0O][A-Z0-9]{6}$/.test(normalized)) {
        const bankCode = normalized.slice(0, 4).replace(/1/g, "I");
        const tail = normalized.slice(4).replace(/[OCU]/g, "0");
        normalized = `${bankCode}${tail}`;
      }

      normalized = normalized.slice(0, 11);
      
      if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalized)) {
        return normalized;
      }
      
      return null;
    })
    .filter(Boolean);
  
  return unique(allCandidates);
}




function extractBankFields(text) {
  const source = String(text || "");
  const lines = source.split(/\r?\n/);
  const ifscMatches = normalizeIfscCandidates(source);

  // Prefer account numbers near labels before generic numeric runs.
  // Try multiple regex patterns to match account labels despite OCR corruption
  const labeledAccountMatches = [];
  
  // Pattern 1: Standard "Account No: ..." or "a/c: ..."
  const labelRegex1 = /(?:account|a\/c|acc(?:ount)?)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([0-9\s]{9,24})/gi;
  
  // Pattern 2: Very mangled labels with "ount", "aount", "ccount", etc.
  const labelRegex2 = /(?:[Aa]|[Aa]\/)?\s*(?:c|[Cc]|C|a)\s*(?:count|ccoun|oun|account)\s*(?:no|NO|No|number)?\s*[:\-]?\s*([0-9\s]{9,24})/gi;
  
  // Pattern 3: Look for "No." or "No" followed by colon and digits (very flexible)
  const labelRegex3 = /(?:No\.?\s*:\s*|no\.\s*:\s*|NUMBER\s*:\s*|account.*?:\s*|a\/c.*?:\s*)([0-9\s]{9,24})/gi;
  
  // Pattern 4: Look for "ount No." pattern specifically (common mangling)
  const labelRegex4 = /ount\s*(?:No|no|NO)\s*[\.\:\-]?\s*([0-9\s]{9,24})/gi;
  
  const allLabelRegexes = [labelRegex1, labelRegex2, labelRegex3, labelRegex4];
  
  
    // Pattern 5: Look for longest numeric sequences after account-like labels
    // This captures the full account number even if split across lines or with extra spaces
    const labelRegex5 = /(?:account|a\/c|acc|ount)\s*(?:no|NO|No|number)?\s*[\.\:\-]?\s*([0-9\s\-]{12,30})/gi;
  
    allLabelRegexes.push(labelRegex5);
  
  for (const labelRegex of allLabelRegexes) {
    let labelMatch = null;
    while ((labelMatch = labelRegex.exec(source)) !== null) {
      const digits = String(labelMatch[1] || "").replace(/\D/g, "");
        if (digits.length >= 9 && digits.length <= 20) {
        labeledAccountMatches.push(digits);
      }
    }
  }

  const genericAccountMatches = source.match(/(?<!\d)\d{9,18}(?!\d)/g) || [];
  
    // Also look for longer sequences (14-18 digits typical for Indian accounts)
    const longerAccountMatches = source.match(/(?<!\d)\d{14,18}(?!\d)/g) || [];
  
    const accountCandidates = normalizeAccountCandidates([...labeledAccountMatches, ...longerAccountMatches, ...genericAccountMatches]).slice(0, 12);

  const bankNameCandidates = [];
  const directBankName = pickLikelyBankName(lines);
  if (directBankName) bankNameCandidates.push(directBankName);

  const bigBankPattern = /\b([A-Z][A-Za-z&.\-\s]{3,40}\sBANK(?:\s+OF\s+[A-Z][A-Za-z.\-\s]{2,30})?)\b/g;
  let bankMatch = null;
  while ((bankMatch = bigBankPattern.exec(source)) !== null) {
    bankNameCandidates.push(bankMatch[1].replace(/\s+/g, " ").trim());
  }

  const bestBankName = unique(bankNameCandidates)[0] || null;
  const knownBankName = extractKnownBankName(source);
  const finalBankName = knownBankName || bestBankName;
  const bestAccountNumber = pickLikelyAccountNumber(accountCandidates);

  const ifscFallback = ifscMatches[0] || deriveIfscFromLabeledToken(finalBankName, source);

  return {
    bank_name: finalBankName,
    bank_name_candidates: unique(bankNameCandidates).slice(0, 3),
    ifsc: ifscFallback || null,
    ifsc_candidates: unique([...(ifscMatches || []), ifscFallback]),
    account_number: bestAccountNumber,
    account_number_candidates: unique(accountCandidates),
  };
}

function extractLandFields(text) {
  const normalized = String(text || "");
  const khataMatches = normalized.match(/\bkhata\s*(no\.?|number)?\s*[:\-]?\s*([a-z0-9\-/]{2,})/gi) || [];
  const khasraMatches = normalized.match(/\bkhasra\s*(no\.?|number)?\s*[:\-]?\s*([a-z0-9\-/]{2,})/gi) || [];

  return {
    khata_candidates: unique(khataMatches).slice(0, 5),
    khasra_candidates: unique(khasraMatches).slice(0, 5),
  };
}

async function scanDocumentFromBuffer({ buffer, mimeType }) {
  const extracted = await extractTextFromBuffer({ buffer, mimeType });
  const text = extracted.text || "";

  const detection = detectDocumentType(text);

  let fields = {};
  if (detection.detected_type === "aadhaar") {
    fields = extractAadhaarSignalsFromText(text);
  } else if (detection.detected_type === "bank_passbook") {
    fields = extractBankFields(text);
  } else if (detection.detected_type === "land_proof") {
    fields = extractLandFields(text);
  }

  return {
    detected_type: detection.detected_type,
    confidence: detection.confidence,
    text_preview: text.slice(0, 500),
    extraction_method: extracted.extraction_method,
    warning: extracted.warning || "",
    warning_code: extracted.warning_code || "",
    fields,
  };
}

module.exports = {
  scanDocumentFromBuffer,
};
