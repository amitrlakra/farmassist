const { extractTextFromBuffer } = require("./aadhaarExtractor");

/**
 * Extract land details from RoR/Khatiyan/Jamabandi images
 * Looks for: State, District, Village, Khata/Survey/Khasra No, Area
 */

function extractLandDetailsFromText(text) {
  const input = String(text || "").trim();
  if (!input.length || input.length > 50000) return {};

  const details = {};

  // Extract State (usually at top)
  const statePatterns = [
    /state\s*[:\-]?\s*([A-Za-z\s]{3,30})/i,
    /राज्य\s*[:\-]?\s*([^\n]{3,30})/,
    /State\s*\/\s*राज्य\s*[:\-]?\s*([^\n]{3,30})/i,
  ];
  for (const pattern of statePatterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      const rawState = match[1]
        .replace(/[^A-Za-z\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (rawState.length > 2 && rawState.length < 30) {
        details.state = rawState;
        break;
      }
    }
  }

  // Extract District
  const districtPatterns = [
    /district\s*[:\-]?\s*([A-Za-z\s]{3,30})/i,
    /जिला\s*[:\-]?\s*([^\n]{3,30})/,
    /District\s*\/\s*जिला\s*[:\-]?\s*([^\n]{3,30})/i,
  ];
  for (const pattern of districtPatterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      const rawDistrict = match[1]
        .replace(/[^A-Za-z\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (rawDistrict.length > 2 && rawDistrict.length < 30) {
        details.district = rawDistrict;
        break;
      }
    }
  }

  // Extract Village/Gram
  const villagePatterns = [
    /(?:village|gram|गाँव|ग्राम)\s*[:\-]?\s*([A-Za-z\s]{2,40})/i,
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

  // Extract Khata / Khasra / Dag / Survey No
  // Look for patterns like "खाता नंबर: 45" or "Khasra No: 78/2" or "Survey No: 123"
  const khataPatterns = [
    /(?:khata|khasra|dag|survey)\s*(?:no\.?|नंबर|संख्या|नं\.)\s*[:\-]?\s*([0-9\/\-\.]+)/i,
    /खाता\s*(?:नंबर|नं\.)\s*[:\-]?\s*([0-9\/\-\.]+)/,
    /खसरा\s*(?:नंबर|नं\.)\s*[:\-]?\s*([0-9\/\-\.]+)/,
    /dak|dag|दाक\s*[:\-]?\s*([0-9\/\-\.]+)/i,
    /account\s*(?:no\.?|number)\s*[:\-]?\s*([0-9\/\-\.]+)/i,
  ];
  for (const pattern of khataPatterns) {
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

  // Extract Area (in acres/hectares)
  // Look for patterns like "Area: 5 acres" or "क्षेत्र: 2.5 हेक्टेयर"
  const areaPatterns = [
    /(?:area|क्षेत्र|खेत\s*का\s*क्षेत्र)\s*[:\-]?\s*([0-9.]+)\s*(?:acre|hectare|हेक्टेयर|एकड़|ha|ac|हे\.)/i,
    /(?:area|क्षेत्र)\s*[:\-]?\s*([0-9.]+)/i,
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

  // Extract Block / Sub-district / Tahsil
  const blockPatterns = [
    /(?:block|tahsil|तहसील|तहसील|ब्लॉक)\s*[:\-]?\s*([A-Za-z\s]{2,40})/i,
    /Block\s*\/\s*(?:तहसील|Tahsil)\s*[:\-]?\s*([^\n]{2,40})/i,
  ];
  for (const pattern of blockPatterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      const rawBlock = match[1]
        .replace(/[^A-Za-z\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (rawBlock.length > 1 && rawBlock.length < 40) {
        details.block = rawBlock;
        break;
      }
    }
  }

  // Extract Sub-district / Tehsil (alternative patterns)
  const subDistrictPatterns = [
    /(?:sub.?district|sub.?division|तहसील|tehsil)\s*[:\-]?\s*([A-Za-z\s]{2,40})/i,
  ];
  for (const pattern of subDistrictPatterns) {
    const match = input.match(pattern);
    if (match && match[1] && !details.block) {
      const rawSubDist = match[1]
        .replace(/[^A-Za-z\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (rawSubDist.length > 1 && rawSubDist.length < 40) {
        details.subDistrict = rawSubDist;
        break;
      }
    }
  }

  // Extract Owner/Applicant Name from RoR
  const ownerPatterns = [
    /(?:owner|occupant|applicant|स्वामी|मालिक|धारक)\s*[:\-]?\s*([A-Za-z\s]{3,60})/i,
    /नाम\s*[:\-]?\s*([^\n]{3,60})/,
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

  // Extract Holding Type (Single/Joint)
  if (/(joint|साझे|संयुक्त)/i.test(input)) {
    details.holdingType = "joint";
  } else if (/(single|एकल)/i.test(input)) {
    details.holdingType = "single";
  }

  return details;
}

/**
 * Main function to extract land details from RoR buffer
 * Returns extracted state, district, village, khata, area, etc.
 */
async function extractLandDetailsFromBuffer({ buffer, mimeType, fileName = "" }) {
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
        warning: extracted.warning || "Could not extract text from land record image. Please upload a clear JPG/PNG/WEBP image.",
        warning_code: extracted.warning_code || "TEXT_EXTRACTION_FAILED",
      };
    }

    const details = extractLandDetailsFromText(ocrText);
    const fieldsFound = Object.keys(details).length;

    return {
      success: fieldsFound > 0,
      details,
      extraction_method: extracted.extraction_method,
      fields_found: fieldsFound,
      text_preview: ocrText.slice(0, 400),
      warning: fieldsFound === 0 ? "Could not detect structured land record format. Please verify image quality and make sure it's a RoR/Khatiyan/Jamabandi document." : "",
      warning_code: fieldsFound === 0 ? "STRUCTURED_DATA_NOT_FOUND" : "",
    };
  } catch (err) {
    return {
      success: false,
      details: {},
      extraction_method: "none",
      warning: "Error processing land record image: " + (err.message || "Unknown error"),
      warning_code: "EXTRACTION_ERROR",
    };
  }
}

module.exports = {
  extractLandDetailsFromBuffer,
  extractLandDetailsFromText,
};
