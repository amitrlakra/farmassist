const uiText = {
  English: {
    title: "FarmAssist Jharkhand Pilot",
    subtitle: "Verified scheme discovery for farmers (State + District + Block)",
    getSchemes: "Get Verified Schemes",
    loading: "Finding best verified schemes...",
  },
  Hindi: {
    title: "किसान सहायक — झारखंड",
    subtitle: "किसानों के लिए सत्यापित सरकारी योजनाएं (राज्य + जिला + प्रखंड)",
    getSchemes: "सत्यापित योजनाएं देखें",
    loading: "आपके लिए उपयुक्त योजनाएं खोजी जा रही हैं...",
  },
};

function t(language, key) {
  const langPack = uiText[language] || uiText.English;
  return langPack[key] || uiText.English[key] || key;
}

module.exports = { t, uiText };
