const { extractTextFromBuffer } = require("./aadhaarExtractor");

/**
 * Extract land details from Lagaan (Property Tax Receipt) / Tax Receipt images
 * Looks for: Khata/Survey/Khasra No, Area, Village, Owner Name, Tax Year, Property Type
 */

function extractLagaanDetailsFromText(text) {
  const input = String(text || "").trim();
  if (!input.length || input.length > 50000) return {};

  const details = {};

  // Extract Village/Gram - usually at top of receipt
  const villagePatterns = [
    /(?:village|gram|गाँव|ग्राम|Village)\s*[:\-]?\s*([A-Za-z\s]{2,40})/i,
    /Village\s*\/\s*(?:गाँव|ग्राम)\s*[:\-]?\s*([^\n]{2,40})/i,
  ];
  for (const pattern of villagePatterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      const rawVillage = match[1]
        .replace(/[^A-Za-z\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (rawVillage.length > 1 && rawVillage.length < 40) {
        details.village = rawVillage;
        break;
      }
    }
  }

  // Extract Khata / Account / Holding No (खाता नंबर / खाता संख्या)
  const khataPatterns = [
    /(?:khata|account|holding|खाता)\s*(?:no\.?|नंबर|संख्या|नं\.)\s*[:\-]?\s*([0-9\/\-\.]+)/i,
    /खाता\s*(?:नंबर|नं\.)\s*[:\-]?\s*([0-9\/\-\.]+)/,
    /account\s*(?:no\.?|number)\s*[:\-]?\s*([0-9\/\-\.]+)/i,
  ];
  for (const pattern of khataPatterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      const rawNumber = match[1]
        .replace(/\s+/g, "")
        .trim();
      if (rawNumber.length > 0) {
        details.khata = rawNumber;
        break;
      }
    }
  }

  // Extract Survey No / Khasra / Dag / Plot No
  const surveyPatterns = [
    /(?:survey|khasra|dag|plot)\s*(?:no\.?|नंबर|संख्या)\s*[:\-]?\s*([0-9\/\-\.]+)/i,
    /खसरा\s*(?:नंबर|नं\.)\s*[:\-]?\s*([0-9\/\-\.]+)/,
    /दाक\s*[:\-]?\s*([0-9\/\-\.]+)/i,
    /(?:plot|पार्सल)\s*(?:no\.?|नंबर)\s*[:\-]?\s*([0-9\/\-\.]+)/i,
  ];
  for (const pattern of surveyPatterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      const rawNumber = match[1]
        .replace(/\s+/g, "")
        .trim();
      if (rawNumber.length > 0) {
        details.surveyNo = rawNumber;
        break;
      }
    }
  }

  // Extract Area (in acres/hectares/square meters)
  const areaPatterns = [
    /(?:area|क्षेत्र|खेत\s*का\s*क्षेत्र)\s*[:\-]?\s*([0-9.]+)\s*(?:acre|hectare|हेक्टेयर|एकड़|ha|ac|हे\.|sq\.?m|वर्ग मीटर)/i,
    /(?:area|क्षेत्र|खेत)\s*[:\-]?\s*([0-9.]+)/i,
    /कुल\s*क्षेत्र\s*[:\-]?\s*([0-9.]+)/,
  ];
  for (const pattern of areaPatterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      const rawArea = match[1].trim();
      if (rawArea.length > 0 && /^[0-9.]+$/.test(rawArea)) {
        details.area = rawArea;
        break;
      }
    }
  }

  // Extract Owner/Occupant Name
  const ownerPatterns = [
    /(?:owner|occupant|होलदार|नाम|मालिक)\s*[:\-]?\s*([A-Za-z\s]{3,60})/i,
    /नाम\s*[:\-]?\s*([^\n]{3,60})/,
    /(?:Shri|श्री|Smt\.?|श्रीमती)\s+([A-Za-z\s]{2,50})/i,
  ];
  for (const pattern of ownerPatterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      const rawName = match[1]
        .replace(/[^A-Za-z\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (rawName.length > 3 && rawName.length < 60) {
        details.landOwnerName = rawName;
        break;
      }
    }
  }

  // Extract Tax Year / Assessment Year
  const yearPatterns = [
    /(?:year|वर्ष|assessment|फसल)\s*[:\-]?\s*([0-9\-\/]{4,9})/i,
    /([0-9]{4})[\/\-]([0-9]{2,4})/,
  ];
  for (const pattern of yearPatterns) {
    const match = input.match(pattern);
    if (match) {
      const rawYear = match[0].trim();
      if (rawYear.length > 0) {
        details.taxYear = rawYear;
        break;
      }
    }
  }

  // Extract Property Type (Agricultural/Urban/Residential)
  if (/agricultural|farm|सांप/i.test(input)) {
    details.propertyType = "agricultural";
  } else if (/urban|city|शहरी/i.test(input)) {
    details.propertyType = "urban";
  } else if (/residential|रिहायश/i.test(input)) {
    details.propertyType = "residential";
  }

  // Extract TAX AMOUNT (useful for verification)
  const taxPatterns = [
    /(?:tax|लगान|कर)\s*(?:amount|राशि|amount)\s*[:\-]?\s*(?:rs\.?|रु\.)\s*([0-9,.]+)/i,
    /(?:लगान|property\s*tax)\s*[:\-]?\s*([0-9,.]+)/i,
  ];
  for (const pattern of taxPatterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      details.taxAmount = match[1].trim();
      break;
    }
  }

  // Extract Receipt Number / Document Number
  const docNoPatterns = [
    /(?:receipt|रसीद|document|दस्तावेज)\s*(?:no\.?|नंबर|नं\.|#)\s*[:\-]?\s*([A-Z0-9\-\/]+)/i,
  ];
  for (const pattern of docNoPatterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      details.receiptNo = match[1].trim();
      break;
    }
  }

  return details;
}

/**
 * Main function to extract lagaan/tax receipt details from image buffer
 * Returns extracted khata, survey, area, village, owner name, etc.
 */
async function extractLagaanDetailsFromBuffer({ buffer, mimeType, fileName = "" }) {
  if (!buffer || buffer.length === 0) {
    const err = new Error("Empty document buffer");
    err.statusCode = 400;
    err.code = "EMPTY_DOCUMENT";
    throw err;
  }

  try {
    const extracted = await extractTextFromBuffer({ buffer, mimeType });
    const ocrText = String(extracted.text || "");

    if (!ocrText.trim()) {
      return {
        success: false,
        details: {},
        extraction_method: extracted.extraction_method,
        warning: extracted.warning || "Could not extract text from tax receipt image. Please upload a clear JPG/PNG/WEBP image.",
        warning_code: extracted.warning_code || "TEXT_EXTRACTION_FAILED",
      };
    }

    const details = extractLagaanDetailsFromText(ocrText);
    const fieldsFound = Object.keys(details).length;

    return {
      success: fieldsFound > 0,
      details,
      extraction_method: extracted.extraction_method,
      fields_found: fieldsFound,
      text_preview: ocrText.slice(0, 400),
      warning: fieldsFound === 0 ? "Could not detect structured tax receipt format. Please verify image quality and make sure it's a property tax receipt (Lagaan/Rasid)." : "",
      warning_code: fieldsFound === 0 ? "STRUCTURED_DATA_NOT_FOUND" : "",
    };
  } catch (err) {
    return {
      success: false,
      details: {},
      extraction_method: "none",
      warning: "Error processing tax receipt image: " + (err.message || "Unknown error"),
      warning_code: "EXTRACTION_ERROR",
    };
  }
}

module.exports = {
  extractLagaanDetailsFromBuffer,
  extractLagaanDetailsFromText,
};
