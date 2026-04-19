const schemes = require("../src/data/schemes.jharkhand.seed.json");

const allowedDomains = ["gov.in", "nic.in", "jharkhand.gov.in", "rkvy.da.gov.in"];

function hasAllowedDomain(url) {
  try {
    const u = new URL(url);
    return allowedDomains.some((d) => u.hostname.endsWith(d));
  } catch (_e) {
    return false;
  }
}

const errors = [];

schemes.forEach((s) => {
  if (!s.id) errors.push("Missing id");
  if (!s.name || !s.name.English || !s.name.Hindi) {
    errors.push(`Scheme ${s.id}: missing bilingual name`);
  }
  if (!s.source_url || !hasAllowedDomain(s.source_url)) {
    errors.push(`Scheme ${s.id}: source_url not in trusted domains`);
  }
  if (!["verified", "pending"].includes(s.verification_status)) {
    errors.push(`Scheme ${s.id}: invalid verification_status`);
  }
});

if (errors.length > 0) {
  console.error("Validation failed:\n" + errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}

console.log("Scheme data validation passed.");
