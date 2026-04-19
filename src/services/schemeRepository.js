const { listSchemes: loadSchemes, saveSchemes, appendAudit, listAudit, getAvailableStates } = require("./verificationStore");

function listSchemes(stateCode = "jharkhand") {
  return loadSchemes(stateCode);
}

function verifiedSchemesOnly(data) {
  return data.filter((s) => s.verification_status === "verified");
}

function filterByRegion(data, state, district, block) {
  return data.filter((s) => {
    if (s.state !== "All" && s.state !== state) return false;

    if (s.scope === "district" || s.scope === "block") {
      if (district && s.districts.length > 0 && !s.districts.includes(district)) return false;
    }

    if (s.scope === "block") {
      if (block && s.blocks.length > 0 && !s.blocks.includes(block)) return false;
    }

    return true;
  });
}

function saveSchemesForState(schemes, stateCode) {
  return saveSchemes(schemes, stateCode);
}

function appendAuditForState(entry, stateCode) {
  return appendAudit(entry, stateCode);
}

function listAuditForState(stateCode, limit = 100) {
  return listAudit(stateCode, limit);
}

module.exports = {
  listSchemes,
  verifiedSchemesOnly,
  filterByRegion,
  saveSchemes: saveSchemesForState,
  appendAudit: appendAuditForState,
  listAudit: listAuditForState,
  getAvailableStates,
};
