function includesOrAll(list, value) {
  if (!Array.isArray(list) || list.length === 0) return true;
  return list.includes("All") || list.includes(value);
}

function numericIncomeBracketToValue(incomeBracket) {
  const map = {
    below_1_lakh: 100000,
    "1_to_3_lakh": 300000,
    "3_to_6_lakh": 600000,
    above_6_lakh: 900000,
  };
  return map[incomeBracket] || null;
}

function ruleMatch(profile, scheme) {
  const incomeValue = numericIncomeBracketToValue(profile.income);

  if (!includesOrAll(scheme.crops, profile.crop)) return false;
  if (!includesOrAll(scheme.farm_size, profile.farmSize)) return false;
  if (!includesOrAll(scheme.caste, profile.caste)) return false;
  if (!includesOrAll(scheme.gender, profile.gender)) return false;
  if (!includesOrAll(scheme.land_ownership, profile.landOwnership)) return false;

  if (scheme.bank_account_required && profile.bankAccount !== "yes") return false;

  if (scheme.income_max !== null && incomeValue !== null && incomeValue > scheme.income_max) {
    return false;
  }

  return true;
}

function score(profile, scheme) {
  let s = 0;

  if (scheme.scope === "block") s += 40;
  if (scheme.scope === "district") s += 30;
  if (scheme.scope === "state") s += 20;
  if (scheme.scope === "central") s += 10;

  if (scheme.verification_status === "verified") s += 50;
  if (scheme.crops.includes(profile.crop) || scheme.crops.includes("All")) s += 10;
  if (scheme.farm_size.includes(profile.farmSize)) s += 8;
  if (scheme.caste.includes(profile.caste)) s += 6;
  if (scheme.land_ownership.includes(profile.landOwnership)) s += 6;
  if (scheme.bank_account_required && profile.bankAccount === "yes") s += 5;

  return s;
}

module.exports = {
  ruleMatch,
  score,
};
