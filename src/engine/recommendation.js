const { ruleMatch, score } = require("./rules");

function langValue(obj, language) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[language] || obj.English || "";
}

function langArrayValue(obj, language, fallback = []) {
  if (!obj) return fallback;
  if (Array.isArray(obj)) return obj;
  if (typeof obj === "object") {
    const value = obj[language] || obj.English || obj.Hindi;
    return Array.isArray(value) ? value : fallback;
  }
  return fallback;
}

function translateRequiredDocuments(documents, language) {
  const fallback = Array.isArray(documents) ? documents : [];
  if (language !== 'Hindi') return fallback;

  const map = {
    'Aadhaar': 'आधार',
    'Bank Passbook': 'बैंक पासबुक',
    'Land/Lease Proof': 'भूमि/पट्टा प्रमाण',
    'Sowing/Crop Details': 'बुआई/फसल का विवरण',
    'Identity Proof': 'पहचान प्रमाण',
    'District Circular Ref': 'जिला परिपत्र संदर्भ',
    'Irrigation Layout/Estimate': 'सिंचाई का नक्शा/अनुमान',
    'Mobile Number': 'मोबाइल नंबर',
    'Project Report': 'परियोजना प्रतिवेदन',
  };

  return fallback.map((doc) => map[doc] || doc);
}

function recommend({ profile, schemes, language }) {
  const eligible = schemes
    .filter((s) => ruleMatch(profile, s))
    .map((s) => ({ ...s, _score: score(profile, s) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 8)
    .map((s) => ({
      id: s.id,
      name: langValue(s.name, language),
      benefit: langValue(s.benefit, language),
      apply: langValue(s.apply, language),
      eligibility: langValue(s.eligibility_note, language),
      required_documents: s.required_documents,
      required_documents_display: translateRequiredDocuments(s.required_documents, language),
      required_documents_detailed: langArrayValue(s.required_documents_detailed, language, s.required_documents || []),
      required_information_required: langArrayValue(s.required_information_required, language, []),
      website: s.source_url,
      scope: s.scope,
      verification_status: s.verification_status,
      confidence: Math.min(100, s._score),
      why_recommended: [
        `${s.scope.toUpperCase()} scope`,
        s.verification_status === "verified" ? "Verified source" : "Needs verification",
        `Matches crop: ${profile.crop}`,
        `Matches farm size: ${profile.farmSize}`,
      ],
    }));

  return eligible;
}

module.exports = { recommend };
