const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3010' : '';
let rejectionReasons = [];
let activeAdminRole = null;
const PDFJS_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function isPdfFile(file) {
  return Boolean(file && String(file.type || '').toLowerCase().includes('pdf'));
}

function ensurePdfJsConfigured() {
  if (!window.pdfjsLib) return false;
  if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
  }
  return true;
}

async function convertPdfFirstPageToPngFile(file) {
  if (!isPdfFile(file) || !ensurePdfJsConfigured()) return null;

  try {
    const data = await file.arrayBuffer();
    const doc = await window.pdfjsLib.getDocument({ data }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
    if (!blob) return null;

    const pngName = String(file.name || 'document.pdf').replace(/\.pdf$/i, '') + '-page1.png';
    return new File([blob], pngName, { type: 'image/png' });
  } catch (_err) {
    return null;
  }
}

// ─── UI Translations ──────────────────────────────────────────────────────────
const UI_TEXT = {
  English: {
    title: 'FarmAssist Jharkhand Pilot',
    subtitle: 'Verified scheme discovery for farmers (State + District)',
    pmKisanHelpHeading: 'How this helps for scheme applications',
    pmKisanHelpPoint1: 'Find verified schemes using your profile and district.',
    pmKisanHelpPoint2: 'Prepare key details: name, Aadhaar, mobile, bank account, IFSC, and land details.',
    pmKisanHelpPoint3: 'Auto-extract details from uploaded Aadhaar and passbook where possible.',
    pmKisanHelpPoint4: 'Open the official portal. This assistant tells you what information to fill and where to fill it, then you submit manually.',
    pmKisanAccessHeading: 'How to access official scheme portals',
    pmKisanAccessPoint1: 'Open the official portal from each recommended scheme.',
    pmKisanAccessPoint2: 'Keep Aadhaar, mobile number, bank account, IFSC, and land details ready.',
    pmKisanAccessPoint3: 'Use the scheme-specific ID asked on the portal (registration number, mobile, Aadhaar, etc.).',
    pmKisanAccessPoint4: 'Complete OTP/eKYC or portal verification steps if prompted.',
    pmKisanAccessPoint5: 'Use extracted details from this assistant to fill fields correctly before final submit.',
    pmKisanAccessNote: 'Note: Login and verification steps vary by scheme and portal.',
    step1Heading: 'Step 1: Find Eligible Schemes',
    step1Meta: 'Share only scheme-matching details first. Personal identity and documents are requested only when you choose to apply.',
    labelLanguage: 'Language',
    labelAge: 'Age',
    labelState: 'State',
    labelDistrict: 'District',
    labelFarmSize: 'Farm Size',
    labelCrop: 'Crop',
    labelIncome: 'Income',
    labelCaste: 'Caste',
    labelGender: 'Gender',
    labelLandOwnership: 'Land Ownership',
    labelBankAccount: 'Bank Account',
    labelVerifiedOnly: 'Verified only',
    submitBtn: 'Get Verified Schemes',
    loading: 'Finding best verified schemes...',
    noResults: 'No matching verified schemes found for this profile.',
    applyHeading: 'Apply Assistant',
    applyIntro: 'Step 2: Fill personal details, upload supporting documents, extract Aadhaar if needed, then open the official portal and submit manually using prefilled details.',
    labelApplyName: 'Applicant Name',
    labelApplyMobile: 'Mobile Number',
    labelApplyAadhaar: 'Aadhaar Number (Auto-detected or Manual)',
    labelBankName: 'Bank Name (Auto-detected from Passbook)',
    labelBankAccount2: 'Bank Account Number (Auto-detected or Manual)',
    labelIfsc: 'IFSC Code (Auto-detected or Manual)',
    landDetailsHeading: 'Land Details (PM-KISAN entry)',
    labelLandState: 'Land State',
    labelLandDistrict: 'Land District',
    labelLandSubDistrict: 'Sub-district / Tehsil',
    labelLandBlock: 'Block',
    labelLandVillage: 'Village',
    labelLandHoldingType: 'Single / Joint Land Holding',
    labelKhataNo: 'Khata No.',
    labelSurveyNo: 'Survey / Khasra / Dag No.',
    labelLandArea: 'Area',
    labelLandTransferDetails: 'Land Transfer Details',
    labelLandDateVesting: 'Land Date of Vesting',
    labelPattaRfa: 'Patta No / RFA (Yes/No)',
    labelLandAadhaar: 'Aadhaar No. for Land Section',
    labelLandApplicantName: 'Name for Land Section',
    landSourceGuideHeading: 'Field to Source Document Guide',
    labelUploadDocs: 'Upload Documents (Aadhaar and Bank details are auto-extracted from these files)',
    autoFillBtn: 'Auto Fill From Documents',
    scanAadhaarBtn: 'Scan Aadhaar from File',
    scanBankBtn: 'Scan Bank Passbook',
    scanRorBtn: 'Scan Land Record (RoR/Khatiyan)',
    scanLagaanBtn: 'Scan Tax Receipt (Lagaan/Rasid)',
    guidedSubmissionBtn: '📋 Guided PM-KISAN Submission',
    openPortalSideBySideBtn: 'Open PM-KISAN Side by Side',
    openPortalBtn: 'Open Official Portal (Manual Submit)',
    copyPrefillBtn: 'Copy Prefill Details',
    downloadPacketBtn: 'Download Application Packet',
    guidedSubmissionTitle: 'Step-by-Step PM-KISAN Application Guide',
    guidedPortalHint: 'Portal Hint:',
    portalSplitEyebrow: 'Live Portal',
    portalSplitTitle: 'PM-KISAN Portal',
    portalSplitHelp: 'Use this panel to keep the portal open beside your extracted data. If the site stays blank, it is likely blocking embedding and you should use the new-tab button.',
    portalSplitFallbackTitle: 'Portal not visible?',
    portalSplitFallbackBody: 'Some government sites block opening inside another page. If that happens, use the new-tab button below.',
    closePortalPanel: 'Close Panel',
    previousStep: '← Previous',
    nextStep: 'Next →',
    openPortalInNewTab: '🔗 Open PM-KISAN Portal',
    completeSubmissionBtn: '✓ Submission Complete',
    schemesBenefit: 'Benefit',
    schemesHowToApply: 'How to Apply',
    schemesEligibility: 'Eligibility',
    schemesDocuments: 'Documents',
    schemesDocsDetailed: 'Documents Needed (Scheme-wise)',
    schemesInfoNeeded: 'Information Needed',
    schemesOfficialSource: 'Official Source',
    prepareBtnLabel: 'Prepare Online Application',
    connectError: 'Could not connect to API. Start backend on http://localhost:3010 and retry.',
  },
  EnglishOptions: {
    farmSize: ['Below 2 acres', '2-5 acres', 'Above 5 acres'],
    crop: ['Rice', 'Wheat', 'Maize', 'Pulses', 'Oilseeds', 'Cotton', 'Sugarcane'],
    income: ['Below 1 lakh', '1-3 lakh', '3-6 lakh', 'Above 6 lakh'],
    caste: ['General', 'OBC', 'SC', 'ST'],
    gender: ['Male', 'Female'],
    landOwnership: ['Owned', 'Leased/Tenant'],
    bankAccount: ['Yes', 'No'],
    verifiedOnly: ['Yes', 'No'],
  },
  HindiOptions: {
    farmSize: ['2 एकड़ से कम', '2-5 एकड़', '5 एकड़ से अधिक'],
    crop: ['धान', 'गेहूँ', 'मक्का', 'दलहन', 'तिलहन', 'कपास', 'गन्ना'],
    income: ['1 लाख से कम', '1-3 लाख', '3-6 लाख', '6 लाख से अधिक'],
    caste: ['सामान्य', 'अन्य पिछड़ा वर्ग', 'अनुसूचित जाति', 'अनुसूचित जनजाति'],
    gender: ['पुरुष', 'महिला'],
    landOwnership: ['स्वयं की भूमि', 'पट्टे/बटाई पर'],
    bankAccount: ['हाँ', 'नहीं'],
    verifiedOnly: ['हाँ', 'नहीं'],
  },
  Hindi: {
    title: 'किसान सहायक — झारखंड',
    subtitle: 'किसानों के लिए सत्यापित सरकारी योजनाएं (राज्य + जिला)',
    pmKisanHelpHeading: 'योजना आवेदन में यह कैसे मदद करता है',
    pmKisanHelpPoint1: 'आपकी प्रोफ़ाइल और जिले के आधार पर सत्यापित योजनाएं ढूंढता है।',
    pmKisanHelpPoint2: 'ज़रूरी विवरण तैयार करता है: नाम, आधार, मोबाइल, बैंक खाता, IFSC और भूमि विवरण।',
    pmKisanHelpPoint3: 'अपलोड किए गए आधार और पासबुक से संभव होने पर जानकारी अपने आप निकालता है।',
    pmKisanHelpPoint4: 'संबंधित सरकारी वेबसाइट खोलें। यह सहायक बताता है कि कौन-सी जानकारी कहां भरनी है, और जमा आपको खुद करना है।',
    pmKisanAccessHeading: 'सभी योजना पोर्टल कैसे खोलें',
    pmKisanAccessPoint1: 'हर सुझाई गई योजना के साथ दिए गए सरकारी पोर्टल को खोलें।',
    pmKisanAccessPoint2: 'आधार, मोबाइल नंबर, बैंक खाता, IFSC और भूमि विवरण तैयार रखें।',
    pmKisanAccessPoint3: 'पोर्टल पर जो पहचान मांगी जाए वही दें (पंजीकरण संख्या, मोबाइल, आधार आदि)।',
    pmKisanAccessPoint4: 'यदि कहा जाए तो OTP/eKYC या पोर्टल सत्यापन पूरा करें।',
    pmKisanAccessPoint5: 'अंतिम जमा करने से पहले, सही फील्ड भरने के लिए इस सहायक से निकाली गई जानकारी का उपयोग करें।',
    pmKisanAccessNote: 'नोट: लॉगिन और सत्यापन के चरण योजना और पोर्टल के अनुसार अलग हो सकते हैं।',
    step1Heading: 'पहला चरण: अपने लिए उपयुक्त योजनाएं खोजें',
    step1Meta: 'पहले केवल योजना से जुड़ी जानकारी दें। आवेदन करते समय ही आपकी पहचान और दस्तावेज़ मांगे जाएंगे।',
    labelLanguage: 'भाषा',
    labelAge: 'उम्र',
    labelState: 'राज्य',
    labelDistrict: 'जिला',
    labelFarmSize: 'खेत का क्षेत्रफल',
    labelCrop: 'फसल',
    labelIncome: 'वार्षिक आय',
    labelCaste: 'जाति',
    labelGender: 'लिंग',
    labelLandOwnership: 'भूमि स्वामित्व',
    labelBankAccount: 'बैंक खाता है?',
    labelVerifiedOnly: 'केवल सत्यापित योजनाएं',
    submitBtn: 'सत्यापित योजनाएं देखें',
    loading: 'आपके लिए उपयुक्त योजनाएं खोजी जा रही हैं...',
    noResults: 'आपकी जानकारी के अनुसार कोई सत्यापित योजना नहीं मिली।',
    applyHeading: 'आवेदन में सहायता',
    applyIntro: 'दूसरा चरण: अपना विवरण भरें, ज़रूरी कागज़ात जोड़ें, आधार पहचानें यदि आवश्यक हो, फिर सरकारी वेबसाइट पर निकाली गई जानकारी से फॉर्म भरकर जमा खुद करें।',
    labelApplyName: 'आवेदक का नाम',
    labelApplyMobile: 'मोबाइल नंबर',
    labelApplyAadhaar: 'आधार नंबर (अपने आप पहचाना जाएगा या खुद भरें)',
    labelBankName: 'बैंक का नाम (पासबुक से अपने आप भरा जाएगा)',
    labelBankAccount2: 'बैंक खाता संख्या (अपने आप भरी जाएगी या खुद लिखें)',
    labelIfsc: 'IFSC कोड (अपने आप भरा जाएगा या खुद लिखें)',
    landDetailsHeading: 'भूमि विवरण (PM-KISAN प्रविष्टि)',
    labelLandState: 'भूमि का राज्य',
    labelLandDistrict: 'भूमि का जिला',
    labelLandSubDistrict: 'उप-जिला / तहसील',
    labelLandBlock: 'ब्लॉक',
    labelLandVillage: 'गांव',
    labelLandHoldingType: 'एकल / संयुक्त भूमि धारक',
    labelKhataNo: 'खाता संख्या',
    labelSurveyNo: 'सर्वे / खसरा / दाग संख्या',
    labelLandArea: 'क्षेत्रफल',
    labelLandTransferDetails: 'भूमि हस्तांतरण विवरण',
    labelLandDateVesting: 'भूमि वेस्टिंग तिथि',
    labelPattaRfa: 'पट्टा संख्या / RFA (हाँ/नहीं)',
    labelLandAadhaar: 'भूमि अनुभाग के लिए आधार संख्या',
    labelLandApplicantName: 'भूमि अनुभाग के लिए नाम',
    landSourceGuideHeading: 'फील्ड के लिए स्रोत दस्तावेज़ मार्गदर्शिका',
    labelUploadDocs: 'कागज़ात यहाँ जोड़ें (आधार और बैंक की जानकारी इन्हीं से निकाली जाएगी)',
    autoFillBtn: 'दस्तावेज़ों से ऑटो भरें',
    scanAadhaarBtn: 'फ़ाइल से आधार पहचानें',
    scanBankBtn: 'बैंक पासबुक स्कैन करें',
    scanRorBtn: 'भूमि रिकॉर्ड स्कैन करें (RoR/खतौनी)',
    scanLagaanBtn: 'टैक्स रसीद स्कैन करें (लगान/रसद)',
    guidedSubmissionBtn: '📋 निर्देशित PM-KISAN आवेदन',
    openPortalSideBySideBtn: 'PM-KISAN साथ-साथ खोलें',
    openPortalBtn: 'सरकारी वेबसाइट खोलें (जमा खुद करें)',
    copyPrefillBtn: 'भरी हुई जानकारी नकल करें',
    downloadPacketBtn: 'आवेदन सामग्री सहेजें',
    guidedSubmissionTitle: 'PM-KISAN आवेदन के लिए चरण-दर-चरण गाइड',
    guidedPortalHint: 'पोर्टल सुझाव:',
    portalSplitEyebrow: 'लाइव पोर्टल',
    portalSplitTitle: 'PM-KISAN पोर्टल',
    portalSplitHelp: 'इस पैनल में पोर्टल को आपकी भरी हुई जानकारी के साथ-साथ खुला रखें। अगर पेज खाली रहे, तो साइट एम्बेडिंग रोक रही है और आपको नई टैब वाला बटन इस्तेमाल करना चाहिए।',
    portalSplitFallbackTitle: 'पोर्टल दिखाई नहीं दे रहा?',
    portalSplitFallbackBody: 'कुछ सरकारी साइटें दूसरी पेज के अंदर खुलने से रोकती हैं। ऐसा हो तो नीचे दिया गया नई टैब वाला बटन इस्तेमाल करें।',
    closePortalPanel: 'पैनल बंद करें',
    previousStep: '← पिछला',
    nextStep: 'अगला →',
    openPortalInNewTab: '🔗 PM-KISAN पोर्टल खोलें',
    completeSubmissionBtn: '✓ आवेदन पूर्ण',
    schemesBenefit: 'मिलने वाला लाभ',
    schemesHowToApply: 'आवेदन कैसे करें',
    schemesEligibility: 'पात्रता',
    schemesDocuments: 'ज़रूरी कागज़ात',
    schemesDocsDetailed: 'आवश्यक दस्तावेज़ (योजनावार)',
    schemesInfoNeeded: 'आवश्यक जानकारी',
    schemesOfficialSource: 'सरकारी स्रोत',
    prepareBtnLabel: 'ऑनलाइन आवेदन भरें',
    connectError: 'सर्वर से नहीं जुड़ सका। कृपया http://localhost:3010 पर सर्वर चालू करें और दोबारा प्रयास करें।',
  },
};

const REGION_LABELS = {
  Jharkhand: {
    districts: {
      Bokaro: 'बोकारो',
      Chatra: 'चतरा',
      Deoghar: 'देवघर',
      Dhanbad: 'धनबाद',
      Dumka: 'दुमका',
      'East Singhbhum': 'पूर्वी सिंहभूम',
      Garhwa: 'गढ़वा',
      Giridih: 'गिरिडीह',
      Godda: 'गोड्डा',
      Gumla: 'गुमला',
      Hazaribagh: 'हज़ारीबाग',
      Jamtara: 'जामताड़ा',
      Khunti: 'खूंटी',
      Koderma: 'कोडरमा',
      Latehar: 'लातेहार',
      Lohardaga: 'लोहरदगा',
      Pakur: 'पाकुड़',
      Palamu: 'पलामू',
      Ramgarh: 'रामगढ़',
      Ranchi: 'रांची',
      Sahibganj: 'साहिबगंज',
      'Seraikela Kharsawan': 'सरायकेला खरसावां',
      Simdega: 'सिमडेगा',
      'West Singhbhum': 'पश्चिमी सिंहभूम',
    },
    blocks: {
      Bokaro: { Bermo: 'बेरमो', Chas: 'चास', Chandankiyari: 'चंदनकियारी' },
      Chatra: { Chatra: 'चतरा', Hunterganj: 'हंटरगंज', Simaria: 'सिमरिया' },
      Deoghar: { Deoghar: 'देवघर', Madhupur: 'मधुपुर', Mohanpur: 'मोहनपुर' },
      Dhanbad: { Baghmara: 'बाघमारा', Baliapur: 'बलियापुर', Topchanchi: 'टोपचांची' },
      Dumka: { Dumka: 'दुमका', Jama: 'जामा', Jarmundi: 'जरमुंडी' },
      'East Singhbhum': {
        'Golmuri-cum-Jugsalai': 'गोलमुरी-सह-जुगसलाई',
        Patamda: 'पटमदा',
        Potka: 'पोटका',
      },
      Garhwa: { Garhwa: 'गढ़वा', Meral: 'मेराल', Ranka: 'रंका' },
      Giridih: { Giridih: 'गिरिडीह', Dumri: 'डुमरी', Bengabad: 'बेंगाबाद' },
      Godda: { Godda: 'गोड्डा', Boarijor: 'बोआरीजोर', Pathargama: 'पथरगामा' },
      Gumla: { Gumla: 'गुमला', Sisai: 'सिसई', Palkot: 'पालकोट' },
      Hazaribagh: { Hazaribagh: 'हज़ारीबाग', Katkamdag: 'कटकमदाग', Barkagaon: 'बरकागांव' },
      Jamtara: { Jamtara: 'जामताड़ा', Nala: 'नाला', Karmatanr: 'करमाटांड़' },
      Khunti: { Khunti: 'खूंटी', Torpa: 'तोरपा', Karra: 'कर्रा' },
      Koderma: { Koderma: 'कोडरमा', Domchanch: 'डोमचांच', Jainagar: 'जयनगर' },
      Latehar: { Latehar: 'लातेहार', Balumath: 'बालूमाथ', Mahuadanr: 'महुआडांड़' },
      Lohardaga: { Lohardaga: 'लोहरदगा', Kisko: 'किस्को', Senha: 'सेन्हा' },
      Pakur: { Pakur: 'पाकुड़', Litipara: 'लिट्टीपाड़ा', Amrapara: 'आमड़ापाड़ा' },
      Palamu: { Medininagar: 'मेदिनीनगर', Chainpur: 'चैनपुर', Hussainabad: 'हुसैनाबाद' },
      Ramgarh: { Ramgarh: 'रामगढ़', Gola: 'गोला', Patratu: 'पतरातू' },
      Ranchi: { Kanke: 'कांके', Namkum: 'नामकुम', Ormanjhi: 'ओरमांझी' },
      Sahibganj: { Sahibganj: 'साहिबगंज', Barharwa: 'बरहरवा', Rajmahal: 'राजमहल' },
      'Seraikela Kharsawan': { Seraikela: 'सरायकेला', Chandil: 'चांडिल', Ichagarh: 'ईचागढ़' },
      Simdega: { Simdega: 'सिमडेगा', Kolebira: 'कोलेबिरा', Bano: 'बानो' },
      'West Singhbhum': { Chaibasa: 'चाईबासा', Jagannathpur: 'जगन्नाथपुर', Noamundi: 'नोआमुंडी' },
    },
  },
  Bihar: {
    districts: {
      Patna: 'पटना',
      Nalanda: 'नालंदा',
      Gaya: 'गया',
      Muzaffarpur: 'मुजफ्फरपुर',
      Darbhanga: 'दरभंगा',
      Bhagalpur: 'भागलपुर',
      Purnia: 'पूर्णिया',
      Munger: 'मुंगेर',
      Begusarai: 'बेगूसराय',
      Khagaria: 'खगड़िया',
    },
    blocks: {
      Patna: { 'Patna Sadar': 'पटना सदर', Danapur: 'दानापुर', Paliganj: 'पालीगंज' },
      Nalanda: { Hilsa: 'हिलसा', Islampur: 'इस्लामपुर', Rajgir: 'राजगीर' },
      Gaya: { 'Gaya Town': 'गया नगर', Belaganj: 'बेलागंज', Sherghati: 'शेरघाटी' },
      Muzaffarpur: { 'Muzaffarpur Sadar': 'मुजफ्फरपुर सदर', Minapur: 'मीनापुर', Kanti: 'कांटी' },
      Darbhanga: { 'Darbhanga Sadar': 'दरभंगा सदर', Bahadurpur: 'बहादुरपुर', Keotiranway: 'केवटी रनवे' },
      Bhagalpur: { 'Bhagalpur Sadar': 'भागलपुर सदर', Sabour: 'सबौर', Kharik: 'खरीक' },
      Purnia: { 'Purnia East': 'पूर्णिया पूर्व', 'Purnia West': 'पूर्णिया पश्चिम', Banmankhi: 'बनमनखी' },
      Munger: { 'Munger Sadar': 'मुंगेर सदर', Sangrampur: 'संग्रामपुर', Tarapur: 'तारापुर' },
      Begusarai: { Begusarai: 'बेगूसराय', Teghra: 'तेघड़ा', Matihani: 'मटिहानी' },
      Khagaria: { Khagaria: 'खगड़िया', Alauli: 'अलौली', Chautham: 'चौथम' },
    },
  },
};

function getLocalizedDistrictName(stateName, districtName) {
  if (getLang() !== 'Hindi') return districtName;
  return REGION_LABELS[stateName]?.districts?.[districtName] || districtName;
}

function getLang() {
  const el = document.getElementById('language');
  return (el && el.value === 'Hindi') ? 'Hindi' : 'English';
}

function switchLanguage(lang) {
  const select = document.getElementById('language');
  if (select) select.value = lang;

  const btnEn = document.getElementById('langBtnEn');
  const btnHi = document.getElementById('langBtnHi');
  if (btnEn) btnEn.classList.toggle('active', lang === 'English');
  if (btnHi) btnHi.classList.toggle('active', lang === 'Hindi');

  applyUiLanguage();
}

function t(key) {
  const lang = getLang();
  return (UI_TEXT[lang] && UI_TEXT[lang][key]) || UI_TEXT.English[key] || key;
}

function applyUiLanguage() {
  const lang = getLang();
  const isHindi = lang === 'Hindi';

  document.documentElement.lang = isHindi ? 'hi' : 'en';

  // Static text nodes with data-i18n attributes
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const text = (UI_TEXT[lang] && UI_TEXT[lang][key]) || UI_TEXT.English[key] || '';
    if (text) el.textContent = text;
  });

  // Placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const text = (UI_TEXT[lang] && UI_TEXT[lang][key]) || UI_TEXT.English[key] || '';
    if (text) el.placeholder = text;
  });

  // Buttons with data-i18n
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.textContent = t('submitBtn');

  const scanBtn = document.getElementById('scanAadhaarBtn');
  if (scanBtn) scanBtn.textContent = t('scanAadhaarBtn');

  const scanBankBtn = document.getElementById('scanBankBtn');
  if (scanBankBtn) scanBankBtn.textContent = t('scanBankBtn');

  const scanRorBtn = document.getElementById('scanRorBtn');
  if (scanRorBtn) scanRorBtn.textContent = t('scanRorBtn');

  const scanLagaanBtn = document.getElementById('scanLagaanBtn');
  if (scanLagaanBtn) scanLagaanBtn.textContent = t('scanLagaanBtn');

  const autoFillBtn = document.getElementById('autoFillBtn');
  if (autoFillBtn) autoFillBtn.textContent = t('autoFillBtn');

  const portalBtn = document.getElementById('openPortalBtn');
  if (portalBtn) portalBtn.textContent = t('openPortalBtn');

  const prefillBtn = document.getElementById('copyPrefillBtn');
  if (prefillBtn) prefillBtn.textContent = t('copyPrefillBtn');

  const packetBtn = document.getElementById('downloadPacketBtn');
  if (packetBtn) packetBtn.textContent = t('downloadPacketBtn');

  // Reload states dropdown labels (Hindi/English state names)
  loadStates().catch(console.error);

  // Translate select option labels while preserving stable option values.
  const optionSets = isHindi ? UI_TEXT.HindiOptions : UI_TEXT.EnglishOptions;
  const selectIds = ['farmSize', 'crop', 'income', 'caste', 'gender', 'landOwnership', 'bankAccount', 'verifiedOnly'];
  selectIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel || !optionSets[id]) return;
    const labels = optionSets[id];
    Array.from(sel.options).forEach((opt, i) => {
      if (labels[i]) opt.text = labels[i];
    });
  });

  // Existing results are already localized strings from the previous request,
  // so fetch them again when the language changes.
  if (lastResults.length) {
    fetchSchemes().catch(console.error);
  }
}
let lastResults = [];
let selectedScheme = null;
let scannedDocsByName = {};
let uploadedDocumentsByKey = {};

function formatDetectedDocType(type) {
  const map = {
    aadhaar: 'Aadhaar',
    bank_passbook: 'Bank Passbook',
    land_proof: 'Land/Lease Proof',
    unknown: 'Unknown',
  };
  return map[type] || 'Unknown';
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`);
  }
  return res;
}

function adminHeaders() {
  const adminKey = document.getElementById('adminKey').value.trim();
  return {
    'Content-Type': 'application/json',
    'x-admin-key': adminKey
  };
}

function downloadBlob(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function loadStates() {
  try {
    const res = await apiFetch('/api/states');
    const data = await res.json();
    const lang = getLang();
    const stateEl = document.getElementById('state');
    const districtEl = document.getElementById('district');
    const selectedState = stateEl.value || 'Jharkhand';
    const selectedDistrict = districtEl.value;
    stateEl.innerHTML = data.states
      .filter(s => s.hasData)
      .map((s) => `<option value="${s.name.English}">${lang === 'Hindi' && s.name.Hindi ? s.name.Hindi : s.name.English}</option>`)
      .join('');
    if (Array.from(stateEl.options).some((option) => option.value === selectedState)) {
      stateEl.value = selectedState;
    }
    await loadDistricts(selectedDistrict);
  } catch (error) {
    console.error('Failed to load states:', error);
    const stateEl = document.getElementById('state');
    stateEl.innerHTML = '<option value="Jharkhand">Jharkhand</option>';
    await loadDistricts();
  }
}

async function loadDistricts(selectedDistrictValue) {
  const state = document.getElementById('state').value;
  const stateCode = getStateCodeFromName(state);
  const res = await apiFetch(`/api/regions?state=${encodeURIComponent(stateCode)}`);
  const data = await res.json();
  const districtEl = document.getElementById('district');
  districtEl.innerHTML = data.districts
    .map((districtName) => `<option value="${districtName}">${getLocalizedDistrictName(state, districtName)}</option>`)
    .join('');

  const districtToSelect = selectedDistrictValue || districtEl.value;
  if (Array.from(districtEl.options).some((option) => option.value === districtToSelect)) {
    districtEl.value = districtToSelect;
  }
}

function getStateCodeFromName(stateName) {
  const stateMap = {
    'Jharkhand': 'jharkhand',
    'Bihar': 'bihar',
    'West Bengal': 'west-bengal',
    'Odisha': 'odisha',
    'Chhattisgarh': 'chhattisgarh'
  };
  return stateMap[stateName] || 'jharkhand';
}

function translateRequiredDocumentsForDisplay(documents) {
  const list = Array.isArray(documents) ? documents : [];
  if (getLang() !== 'Hindi') return list;

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

  return list.map((doc) => map[doc] || doc);
}

function buildPayload() {
  return {
    language: document.getElementById('language').value,
    state: document.getElementById('state').value,
    district: document.getElementById('district').value,
    farmSize: document.getElementById('farmSize').value,
    crop: document.getElementById('crop').value,
    income: document.getElementById('income').value,
    caste: document.getElementById('caste').value,
    gender: document.getElementById('gender').value,
    landOwnership: document.getElementById('landOwnership').value,
    bankAccount: document.getElementById('bankAccount').value,
    verifiedOnly: document.getElementById('verifiedOnly').value === 'true'
  };
}

function render(results) {
  lastResults = Array.isArray(results) ? results : [];
  const root = document.getElementById('results');
  if (!results.length) {
    root.innerHTML = `<div class="card">${t('noResults')}</div>`;
    return;
  }

  root.innerHTML = results.map((s, i) => {
    const docsDisplay = Array.isArray(s.required_documents_display) && s.required_documents_display.length
      ? s.required_documents_display
      : translateRequiredDocumentsForDisplay(s.required_documents || []);
    const detailedDocs = Array.isArray(s.required_documents_detailed) && s.required_documents_detailed.length
      ? s.required_documents_detailed
      : (s.required_documents || []);
    const infoNeeded = Array.isArray(s.required_information_required) ? s.required_information_required : [];

    return `
    <div class="scheme">
      <h3>${s.name}</h3>
      <p><strong>${t('schemesBenefit')}:</strong> ${s.benefit}</p>
      <p><strong>${t('schemesHowToApply')}:</strong> ${s.apply}</p>
      <p><strong>${t('schemesEligibility')}:</strong> ${s.eligibility}</p>
      <p class="meta"><strong>${t('schemesDocuments')}:</strong> ${docsDisplay.join(', ')}</p>
      <p class="meta"><strong>${t('schemesDocsDetailed')}:</strong></p>
      <ul class="meta" style="margin-top: 4px; padding-left: 18px;">
        ${detailedDocs.map((d) => `<li>${d}</li>`).join('')}
      </ul>
      ${infoNeeded.length ? `
      <p class="meta"><strong>${t('schemesInfoNeeded')}:</strong></p>
      <ul class="meta" style="margin-top: 4px; padding-left: 18px;">
        ${infoNeeded.map((x) => `<li>${x}</li>`).join('')}
      </ul>
      ` : ''}
      <p class="meta"><a href="${s.website}" target="_blank" rel="noreferrer">${t('schemesOfficialSource')}</a></p>
      <span class="pill">${s.scope.toUpperCase()}</span>
      <span class="pill">${s.verification_status.toUpperCase()}</span>
      <span class="pill">Confidence ${s.confidence}</span>
      <div><button type="button" class="apply-btn" data-apply-index="${i}">${t('prepareBtnLabel')}</button></div>
    </div>
  `;
  }).join('');

  root.querySelectorAll('button[data-apply-index]').forEach((btn) => {
    btn.addEventListener('click', (evt) => {
      const idx = Number(evt.currentTarget.getAttribute('data-apply-index'));
      openApplyAssistant(lastResults[idx]);
    });
  });
}

function normalizeDocName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getManagedSlotKey(fileName, detectedType = 'unknown') {
  const managedTypes = new Set(['aadhaar', 'bank_passbook', 'land_proof']);
  return managedTypes.has(detectedType) ? detectedType : normalizeDocName(fileName);
}

function effectiveDetectedType(row) {
  return (row?.manualOverride || '').trim() || row?.detected_type || 'unknown';
}

function selectedDocumentEntries() {
  return Object.values(uploadedDocumentsByKey || {});
}

const DOC_ALIASES = {
  aadhaar: ['aadhaar', 'aadhar', 'adhar', 'adhaar', 'uid', 'uidai', 'idproof', 'identityproof'],
  bankpassbook: ['bankpassbook', 'passbook', 'bankbook', 'bankstatement', 'statement'],
  landleaseproof: [
    'landleaseproof',
    'landproof',
    'leaseproof',
    'landrecord',
    'khasra',
    'khata',
    'patta',
    'jamabandi',
    'landdocument',
    'leaseagreement'
  ],
  districtcircularref: ['districtcircularref', 'circular', 'notification', 'govorder', 'order']
};

function aliasKeysForRequiredDoc(requiredDoc) {
  const normalized = normalizeDocName(requiredDoc);
  const keys = new Set([normalized]);

  if (normalized.includes('aadhaar') || normalized.includes('aadhar') || normalized.includes('identity')) {
    DOC_ALIASES.aadhaar.forEach((k) => keys.add(k));
  }
  if (normalized.includes('passbook') || normalized.includes('bank')) {
    DOC_ALIASES.bankpassbook.forEach((k) => keys.add(k));
  }
  if (normalized.includes('land') || normalized.includes('lease')) {
    DOC_ALIASES.landleaseproof.forEach((k) => keys.add(k));
  }
  if (normalized.includes('circular') || normalized.includes('notification') || normalized.includes('order')) {
    DOC_ALIASES.districtcircularref.forEach((k) => keys.add(k));
  }

  return Array.from(keys);
}

function selectedFiles() {
  return selectedDocumentEntries().map((entry) => entry.file).filter(Boolean);
}

function refreshUploadSelectionHint() {
  const hint = document.getElementById('uploadSelectionHint');
  if (!hint) return;

  const count = selectedDocumentEntries().length;
  if (!count) {
    hint.textContent = 'No documents uploaded yet.';
    return;
  }

  const noun = count === 1 ? 'document' : 'documents';
  hint.textContent = `${count} ${noun} uploaded. File picker may still show "No file chosen" after upload.`;
}

async function scanSupportingDocuments(filesToScan = selectedFiles()) {
  const root = document.getElementById('scannedDocsSummary');
  const files = Array.isArray(filesToScan) ? filesToScan : [];
  if (!files.length) {
    scannedDocsByName = {};
    uploadedDocumentsByKey = {};
    if (root) root.innerHTML = '';
    refreshUploadSelectionHint();
    return;
  }

  const scanTasks = files.map(async (file) => {
    let fileToSend = file;
    let convertedFromPdf = false;
    if (isPdfFile(file)) {
      const converted = await convertPdfFirstPageToPngFile(file);
      if (converted) {
        fileToSend = converted;
        convertedFromPdf = true;
      }
    }

    const formData = new FormData();
    formData.append('document', fileToSend);

    try {
      const res = await fetch(`${API_BASE}/api/extract/document`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return null;

      return {
        key: getManagedSlotKey(file.name, data.detected_type || 'unknown'),
        fileName: file.name,
        detected_type: data.detected_type || 'unknown',
        confidence: Number(data.confidence || 0),
        extraction_method: convertedFromPdf ? `client_pdf_page1_${data.extraction_method || 'none'}` : (data.extraction_method || 'none'),
        warning: convertedFromPdf ? '' : (data.warning || ''),
        text_preview: data.text_preview || '',
        fields: data.fields || {},
        file
      };
    } catch (_err) {
      return null;
    }
  });

  const scanned = await Promise.all(scanTasks);
  scanned.filter(Boolean).forEach((row) => {
    const existingUpload = uploadedDocumentsByKey[row.key];
    if (existingUpload?.downloadUrl) {
      URL.revokeObjectURL(existingUpload.downloadUrl);
    }

    uploadedDocumentsByKey[row.key] = {
      key: row.key,
      file: row.file,
      fileName: row.fileName,
      normalizedName: normalizeDocName(row.fileName),
      downloadUrl: URL.createObjectURL(row.file),
      uploadedAt: Date.now(),
    };

    scannedDocsByName[row.key] = {
      ...row,
      uploadedAt: Date.now(),
    };
  });

  applyDetectedAadhaarDetails();
  applyDetectedBankDetails();
  renderScannedDocsSummary();
  refreshUploadSelectionHint();
}

function applyDetectedBankDetails() {
  const rows = Object.values(scannedDocsByName || {});
  const bankNameEl = document.getElementById('applyBankName');
  const accountEl = document.getElementById('applyBankAccountNumber');
  const ifscEl = document.getElementById('applyIfsc');

  if (!rows.length) {
    [bankNameEl, accountEl, ifscEl].forEach((el) => {
      if (el && el.dataset.source === 'bank_passbook') {
        el.value = '';
      }
    });
    validateAccountNumber();
    return;
  }

  const bankRows = rows
    .filter((row) => {
      const effectiveType = effectiveDetectedType(row);
      return effectiveType === 'bank_passbook';
    })
    .sort((a, b) => Number(b.uploadedAt || 0) - Number(a.uploadedAt || 0) || Number(b.confidence || 0) - Number(a.confidence || 0));

  if (!bankRows.length) {
    [bankNameEl, accountEl, ifscEl].forEach((el) => {
      if (el && el.dataset.source === 'bank_passbook') {
        el.value = '';
      }
    });
    validateAccountNumber();
    return;
  }

  const best = bankRows[0];
  const fields = best.fields || {};

  const bankName = (fields.bank_name || (fields.bank_name_candidates || [])[0] || '').trim();
  const account = String(fields.account_number || (fields.account_number_candidates || [])[0] || '').trim();
  const ifsc = String(fields.ifsc || (fields.ifsc_candidates || [])[0] || '').trim();

  const nameEl = document.getElementById('applyBankName');
  const canFillBankName = !nameEl?.value?.trim() || nameEl?.dataset?.source === 'bank_passbook';
  const canFillAccount = !accountEl?.value?.trim() || accountEl?.dataset?.source === 'bank_passbook';
  const canFillIfsc = !ifscEl?.value?.trim() || ifscEl?.dataset?.source === 'bank_passbook';

  const filledFields = [];
  if (bankName && canFillBankName) {
    bankNameEl.value = bankName;
    bankNameEl.dataset.source = 'bank_passbook';
    filledFields.push('Bank Name');
  }
  if (account && canFillAccount) {
    accountEl.value = account;
    accountEl.dataset.source = 'bank_passbook';
    filledFields.push('Account #');
  }
  if (ifsc && canFillIfsc) {
    ifscEl.value = ifsc;
    ifscEl.dataset.source = 'bank_passbook';
    filledFields.push('IFSC');
  }
  
  if (filledFields.length > 0) {
    const confidence = Math.round(Number(best.confidence || 0) * 100);
    const confidenceNote = confidence >= 80 ? '' : ` (Confidence: ${confidence}% - please review)`;
    setAdminStatus(
      `Bank details extracted from ${best.fileName}: ${filledFields.join(', ')}${confidenceNote}`
    );
  }
  
  // Validate account number completeness
  validateAccountNumber();
}

function validateAccountNumber() {
  const accountEl = document.getElementById('applyBankAccountNumber');
  const warningEl = document.getElementById('accountNumberWarning');
  if (!accountEl || !warningEl) return;
  const accountNum = accountEl.value.trim().replace(/\D/g, '');
  
  if (accountNum && accountNum.length < 13) {
    warningEl.style.display = 'inline';
  } else {
    warningEl.style.display = 'none';
  }
}

function copyFieldValue(fieldId, fieldLabel) {
  const field = document.getElementById(fieldId);
  if (!field || !field.value) {
    alert(`${fieldLabel} is empty. Please fill it first.`);
    return;
  }
  
  // Copy to clipboard
  navigator.clipboard.writeText(field.value).then(() => {
    showNotification(`✓ ${fieldLabel} copied!`, 'success');
  }).catch(() => {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = field.value;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showNotification(`✓ ${fieldLabel} copied!`, 'success');
  });
}

function showNotification(message, type = 'info') {
  // Show a toast-like notification
  const notif = document.createElement('div');
  notif.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : '#3b82f6'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 10000;
    animation: slideInUp 0.3s ease;
  `;
  notif.textContent = message;
  document.body.appendChild(notif);
  setTimeout(() => {
    notif.style.animation = 'slideOutDown 0.3s ease';
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}

// Add real-time validation listener to account number field
document.addEventListener('DOMContentLoaded', function() {
  const accountEl = document.getElementById('applyBankAccountNumber');
  if (accountEl) {
    accountEl.addEventListener('input', validateAccountNumber);
    accountEl.addEventListener('change', validateAccountNumber);
  }
  
  // Load states on page load
  loadStates().catch(console.error);

  // Guided submission button handlers
  const guidedNextBtn = document.getElementById('guidedNextBtn');
  const guidedPrevBtn = document.getElementById('guidedPrevBtn');
  const guidedOpenSideBySideBtn = document.getElementById('guidedOpenSideBySideBtn');
  const guidedOpenPortalBtn = document.getElementById('guidedOpenPortalBtn');
  const guidedCompleteBtn = document.getElementById('guidedCompleteBtn');
  const guidedCloseBtn = document.getElementById('guidedCloseBtn');

  if (guidedNextBtn) {
    guidedNextBtn.addEventListener('click', function() {
      if (currentGuidedStep < guidedSteps.length - 1) {
        currentGuidedStep++;
        renderGuidedStep();
      }
    });
  }

  if (guidedPrevBtn) {
    guidedPrevBtn.addEventListener('click', function() {
      if (currentGuidedStep > 0) {
        currentGuidedStep--;
        renderGuidedStep();
      }
    });
  }

  if (guidedOpenPortalBtn) {
    guidedOpenPortalBtn.addEventListener('click', function() {
      // Open PM-KISAN portal in new tab
      window.open('https://pmkisan.gov.in', '_blank');
      showNotification('Portal opened in new tab. Paste your fields and submit!', 'info');
    });
  }

  if (guidedOpenSideBySideBtn) {
    guidedOpenSideBySideBtn.addEventListener('click', function() {
      openPortalSideBySide();
      showNotification('Portal opened side by side.', 'info');
    });
  }

  if (guidedCompleteBtn) {
    guidedCompleteBtn.addEventListener('click', function() {
      closeGuidedSubmissionWalkthrough();
      showNotification('✓ PM-KISAN submission complete! Your application has been submitted.', 'success');
    });
  }

  if (guidedCloseBtn) {
    guidedCloseBtn.addEventListener('click', closeGuidedSubmissionWalkthrough);
  }
});
function renderScannedDocsSummary() {
  const root = document.getElementById('scannedDocsSummary');
  if (!root) return;

  const rows = Object.values(scannedDocsByName || {}).sort((a, b) => Number(b.uploadedAt || 0) - Number(a.uploadedAt || 0));
  if (!rows.length) {
    root.innerHTML = '';
    return;
  }

  root.innerHTML = rows.map((row) => {
    const uploaded = uploadedDocumentsByKey[row.key];
    const confidence = Number(row.confidence) || 0;
    const confidencePercent = `${Math.round(confidence * 100)}%`;
    
    // Determine color class based on confidence threshold
    let confidenceClass = 'confidence-low';
    if (confidence >= 0.8) {
      confidenceClass = 'confidence-high';
    } else if (confidence >= 0.5) {
      confidenceClass = 'confidence-medium';
    }
    
    const toneClass = row.detected_type === 'unknown' ? 'warn' : 'ok';
    const warningLine = row.warning
      ? `<div class="scan-file-warning">${row.warning}</div>`
      : '';

    const extractedAadhaar = normalizeAadhaarCandidate(
      row?.fields?.aadhaar || (row?.fields?.candidates || [])[0] || ''
    );
    const extractedAadhaarLine = extractedAadhaar
      ? `<div class="scan-file-meta"><strong>Extracted Aadhaar:</strong> ${formatAadhaar(extractedAadhaar)}</div>`
      : '';
    const extractedNameLine = row?.fields?.name
      ? `<div class="scan-file-meta"><strong>Extracted Name:</strong> ${row.fields.name}</div>`
      : '';

    // Determine if this file has a manual override stored
    const manualOverride = (row.manualOverride || '').trim();
    const overrideLabel = manualOverride ? ` (Overridden to: ${formatDetectedDocType(manualOverride)})` : '';
    const downloadLink = uploaded?.downloadUrl
      ? `<a class="scan-action-link" href="${uploaded.downloadUrl}" download="${row.fileName}">Download</a>`
      : '';

    return `
      <div class="scan-file-row">
        <div class="scan-file-head">
          <span class="scan-file-name">${row.fileName}</span>
          <span class="scan-pill ${toneClass} ${confidenceClass}">${manualOverride ? formatDetectedDocType(manualOverride) : formatDetectedDocType(row.detected_type)} (${confidencePercent})</span>
        </div>
        <div class="scan-file-meta">Uploaded. Method: ${row.extraction_method || 'none'} ${overrideLabel}</div>
        ${effectiveDetectedType(row) === 'aadhaar' ? `${extractedAadhaarLine}${extractedNameLine}` : ''}
        <div class="scan-file-actions">
          ${downloadLink}
          <button type="button" class="scan-action-btn delete" data-delete-key="${row.key}">Delete</button>
        </div>
        <div class="scan-file-override">
          <span style="font-size: 11px; color: #475569;">Manual override:</span>
          <div class="override-toggle">
            <select id="override-${row.key}" data-file-key="${row.key}">
              <option value="">— Use auto-detection —</option>
              <option value="aadhaar">Aadhaar</option>
              <option value="bank_passbook">Bank Passbook</option>
              <option value="land_proof">Land/Lease Proof</option>
              <option value="unknown">Unknown</option>
            </select>
            <button type="button" class="override-apply-btn" data-file-key="${row.key}">Apply</button>
          </div>
        </div>
        ${warningLine}
      </div>
    `;
  }).join('');

  // Add event listeners for override buttons
  document.querySelectorAll('.override-apply-btn').forEach((btn) => {
    btn.addEventListener('click', (evt) => {
      const key = evt.target.getAttribute('data-file-key');
      const selectId = `override-${key}`;
      const selectEl = document.getElementById(selectId);
      const newType = selectEl.value;
      
      if (scannedDocsByName[key]) {
        scannedDocsByName[key].manualOverride = newType;
      }

      applyDetectedAadhaarDetails({ force: true });
      applyDetectedBankDetails();
      renderDocChecklist();
      renderScannedDocsSummary();
    });
  });

  document.querySelectorAll('[data-delete-key]').forEach((btn) => {
    btn.addEventListener('click', (evt) => {
      deleteUploadedDocument(evt.currentTarget.getAttribute('data-delete-key'));
    });
  });
}

function deleteUploadedDocument(key) {
  const uploaded = uploadedDocumentsByKey[key];
  if (uploaded?.downloadUrl) {
    URL.revokeObjectURL(uploaded.downloadUrl);
  }
  delete uploadedDocumentsByKey[key];
  delete scannedDocsByName[key];
  if (key === 'aadhaar') {
    clearAadhaarDerivedFields();
  }
  applyDetectedAadhaarDetails({ force: true });
  applyDetectedBankDetails();
  renderScannedDocsSummary();
  renderDocChecklist();
  refreshUploadSelectionHint();
  setAdminStatus('Document removed from upload list.');
}

function expectedDocTypesForRequiredDoc(requiredDoc) {
  const normalized = normalizeDocName(requiredDoc);
  const expected = [];

  if (normalized.includes('aadhaar') || normalized.includes('aadhar') || normalized.includes('adhar') || normalized.includes('uid')) {
    expected.push('aadhaar');
  }
  if (normalized.includes('passbook') || normalized.includes('bank')) {
    expected.push('bank_passbook');
  }
  if (normalized.includes('land') || normalized.includes('lease') || normalized.includes('khata') || normalized.includes('khasra') || normalized.includes('patta')) {
    expected.push('land_proof');
  }

  return expected;
}

function pickAadhaarCandidateFile(files, { allowFallback = false } = {}) {
  if (!Array.isArray(files) || !files.length) return null;
  const aadhaarKeys = DOC_ALIASES.aadhaar || [];
  const entries = selectedDocumentEntries();

  // Prefer document-scanner classification first.
  const scannedTypeEntry = entries.find((entry) => {
    const scanned = scannedDocsByName[entry.key];
    if (!scanned) return false;
    return effectiveDetectedType(scanned) === 'aadhaar';
  });

  if (scannedTypeEntry) return scannedTypeEntry.file;

  const strictMatch = files.find((f) => {
    const name = normalizeDocName(f.name);
    return aadhaarKeys.some((k) => name.includes(k));
  });

  if (strictMatch) return strictMatch;

  if (!allowFallback) return null;

  const scanableFallback = files.find((f) => {
    const type = String(f.type || '').toLowerCase();
    return type.includes('pdf') || type.includes('image');
  });

  return scanableFallback || files[0];
}

function renderDocChecklist() {
  const root = document.getElementById('docChecklist');
  if (!selectedScheme || !root) return;

  const files = selectedFiles();
  const fileEntries = selectedDocumentEntries().map((entry) => ({
    raw: entry.fileName,
    normalized: entry.normalizedName,
    key: entry.key,
  }));
  const required = selectedScheme.required_documents || [];
  const requiredDisplay = (selectedScheme.required_documents_display && selectedScheme.required_documents_display.length)
    ? selectedScheme.required_documents_display
    : translateRequiredDocumentsForDisplay(required);

  // If Aadhaar was auto-extracted from a file, that specific file is the Aadhaar source.
  const aadhaarScanned = document.getElementById('applyAadhaar').value.trim();
  const aadhaarBadge = document.getElementById('aadhaarStatusBadge');
  const aadhaarDetected = aadhaarScanned && aadhaarBadge &&
    (aadhaarBadge.classList.contains('detected') || aadhaarBadge.classList.contains('candidate'));
  const aadhaarSourceFile = aadhaarDetected ? pickAadhaarCandidateFile(files) : null;

  root.innerHTML = required.map((doc, index) => {
    const docLabel = requiredDisplay[index] || doc;
    const aliases = aliasKeysForRequiredDoc(doc);
    const isAadhaarDoc = aliases.some((k) => k.includes('aadhaar') || k.includes('aadhar') || k.includes('adhar') || k.includes('uid'));

    // If this row is Aadhaar and we extracted the number from a file, that file satisfies it.
    if (isAadhaarDoc && aadhaarSourceFile) {
      return `
        <div class="check-row">
          <span>${docLabel}</span>
          <span class="status ok">Attached (${aadhaarSourceFile.name})</span>
        </div>
      `;
    }

    const expectedTypes = expectedDocTypesForRequiredDoc(doc);
    const scannedMatch = fileEntries.find((f) => {
      const scanned = scannedDocsByName[f.key];
      if (!scanned || !expectedTypes.length) return false;
      const effectiveType = effectiveDetectedType(scanned);
      return expectedTypes.includes(effectiveType);
    });

    if (scannedMatch) {
      return `
        <div class="check-row">
          <span>${docLabel}</span>
          <span class="status ok">Attached (${scannedMatch.raw})</span>
        </div>
      `;
    }

    const match = fileEntries.find((f) => aliases.some((k) => f.normalized.includes(k) || k.includes(f.normalized)));
    const matched = Boolean(match);
    return `
      <div class="check-row">
        <span>${docLabel}</span>
        <span class="status ${matched ? 'ok' : 'miss'}">${matched ? `Attached (${match.raw})` : 'Missing'}</span>
      </div>
    `;
  }).join('');
}

function prefillText() {
  if (!selectedScheme) return '';
  const payload = buildPayload();
  const name = document.getElementById('applyName').value.trim() || '-';
  const mobile = document.getElementById('applyMobile').value.trim() || '-';
  const aadhaar = document.getElementById('applyAadhaar').value.trim() || '-';
  const bankName = document.getElementById('applyBankName').value.trim() || '-';
  const bankAccountNumber = document.getElementById('applyBankAccountNumber').value.trim() || '-';
  const ifsc = document.getElementById('applyIfsc').value.trim() || '-';
  const landState = document.getElementById('landState').value.trim() || payload.state || '-';
  const landDistrict = document.getElementById('landDistrict').value.trim() || payload.district || '-';
  const landSubDistrict = document.getElementById('landSubDistrict').value.trim() || '-';
  const landBlock = document.getElementById('landBlock').value.trim() || '-';
  const landVillage = document.getElementById('landVillage').value.trim() || '-';
  const landHoldingType = document.getElementById('landHoldingType').value.trim() || '-';
  const landKhataNo = document.getElementById('landKhataNo').value.trim() || '-';
  const landSurveyNo = document.getElementById('landSurveyNo').value.trim() || '-';
  const landArea = document.getElementById('landArea').value.trim() || '-';
  const landTransferDetails = document.getElementById('landTransferDetails').value.trim() || '-';
  const landDateVesting = document.getElementById('landDateVesting').value.trim() || '-';
  const landPattaRfa = document.getElementById('landPattaRfa').value.trim() || '-';
  const landAadhaarNo = document.getElementById('landAadhaarNo').value.trim() || aadhaar || '-';
  const landApplicantName = document.getElementById('landApplicantName').value.trim() || name || '-';

  return [
    `Scheme: ${selectedScheme.name}`,
    `Applicant: ${name}`,
    `Mobile: ${mobile}`,
    `Aadhaar: ${aadhaar}`,
    `Bank Name: ${bankName}`,
    `Bank Account Number: ${bankAccountNumber}`,
    `IFSC: ${ifsc}`,
    `Land State: ${landState}`,
    `Land District: ${landDistrict}`,
    `Land Sub-district/Tehsil: ${landSubDistrict}`,
    `Land Block: ${landBlock}`,
    `Land Village: ${landVillage}`,
    `Single/Joint: ${landHoldingType}`,
    `Khata No: ${landKhataNo}`,
    `Survey/Khasra/Dag No: ${landSurveyNo}`,
    `Land Area: ${landArea}`,
    `Land Transfer Details: ${landTransferDetails}`,
    `Land Date Vesting: ${landDateVesting}`,
    `Patta No/RFA: ${landPattaRfa}`,
    `Land Section Aadhaar: ${landAadhaarNo}`,
    `Land Section Name: ${landApplicantName}`,
    `State: ${payload.state}`,
    `District: ${payload.district}`,
    `Farm Size: ${payload.farmSize}`,
    `Crop: ${payload.crop}`,
    `Income: ${payload.income}`,
    `Caste: ${payload.caste}`,
    `Gender: ${payload.gender}`,
    `Land Ownership: ${payload.landOwnership}`,
    `Bank Account: ${payload.bankAccount}`,
    `Official Portal: ${selectedScheme.website}`,
  ].join('\n');
}

function openApplyAssistant(scheme) {
  if (!scheme) return;
  selectedScheme = scheme;

  const panel = document.getElementById('applyAssistant');
  const summary = document.getElementById('applySchemeSummary');

  // Keep already entered personal details if user switches between schemes.
  if (!document.getElementById('applyName').value.trim()) {
    document.getElementById('applyName').value = '';
  }
  if (!document.getElementById('applyMobile').value.trim()) {
    document.getElementById('applyMobile').value = '';
  }
  if (!document.getElementById('applyAadhaar').value.trim()) {
    document.getElementById('applyAadhaar').value = '';
  }
  if (!document.getElementById('applyBankName').value.trim()) {
    document.getElementById('applyBankName').value = '';
  }
  if (!document.getElementById('applyBankAccountNumber').value.trim()) {
    document.getElementById('applyBankAccountNumber').value = '';
  }
  if (!document.getElementById('applyIfsc').value.trim()) {
    document.getElementById('applyIfsc').value = '';
  }
  if (!document.getElementById('landState').value.trim()) {
    document.getElementById('landState').value = document.getElementById('state').value || '';
  }
  if (!document.getElementById('landDistrict').value.trim()) {
    document.getElementById('landDistrict').value = document.getElementById('district').value || '';
  }
  Object.values(uploadedDocumentsByKey).forEach((entry) => {
    if (entry?.downloadUrl) URL.revokeObjectURL(entry.downloadUrl);
  });
  document.getElementById('applicationDocs').value = '';
  uploadedDocumentsByKey = {};
  scannedDocsByName = {};
  renderScannedDocsSummary();

  summary.innerHTML = `
    <h4 style="margin: 0 0 6px;">${scheme.name}</h4>
    <div class="meta">Portal: <a href="${scheme.website}" target="_blank" rel="noreferrer">${scheme.website}</a></div>
    <div class="meta">Required documents: ${(((scheme.required_documents_display && scheme.required_documents_display.length)
      ? scheme.required_documents_display
      : translateRequiredDocumentsForDisplay(scheme.required_documents || [])).join(', '))}</div>
    <div class="meta" style="margin-top: 6px;"><strong>Detailed documents:</strong></div>
    <ul class="meta" style="margin: 4px 0 0; padding-left: 18px;">
      ${((scheme.required_documents_detailed || scheme.required_documents || []).map((d) => `<li>${d}</li>`).join(''))}
    </ul>
    ${Array.isArray(scheme.required_information_required) && scheme.required_information_required.length ? `
    <div class="meta" style="margin-top: 6px;"><strong>Required information:</strong></div>
    <ul class="meta" style="margin: 4px 0 0; padding-left: 18px;">
      ${scheme.required_information_required.map((x) => `<li>${x}</li>`).join('')}
    </ul>
    ` : ''}
  `;

  panel.style.display = 'block';
  setAadhaarBadge('unknown', 'Unknown');
  renderDocChecklist();
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function copyPrefillDetails() {
  const text = prefillText();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setAdminStatus('Prefill details copied. Paste them into the official portal form fields.');
  } catch (_err) {
    setAdminStatus('Could not copy details automatically. Please copy manually from downloaded packet.', true);
  }
}

async function copyFieldValue(fieldId, fieldName) {
  const element = document.getElementById(fieldId);
  const value = element.value.trim();
  if (!value) {
    setAdminStatus(`${fieldName} is empty.`, true);
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    const btn = document.getElementById(`copy${fieldName}Btn`);
    btn.classList.add('copied');
    setAdminStatus(`${fieldName} copied to clipboard.`);
    setTimeout(() => {
      btn.classList.remove('copied');
    }, 2000);
  } catch (_err) {
    setAdminStatus(`Could not copy ${fieldName}.`, true);
  }
}

function downloadApplicationPacket() {
  if (!selectedScheme) {
    setAdminStatus('Select a scheme first using Prepare Online Application.', true);
    return;
  }

  const payload = buildPayload();
  const files = selectedFiles();
  const packet = {
    generated_at: new Date().toISOString(),
    scheme: {
      id: selectedScheme.id || '',
      name: selectedScheme.name,
      website: selectedScheme.website,
      required_documents: selectedScheme.required_documents || [],
    },
    applicant: {
      name: document.getElementById('applyName').value.trim() || '',
      mobile: document.getElementById('applyMobile').value.trim() || '',
      aadhaar: document.getElementById('applyAadhaar').value.trim() || '',
      bankName: document.getElementById('applyBankName').value.trim() || '',
      bankAccountNumber: document.getElementById('applyBankAccountNumber').value.trim() || '',
      ifsc: document.getElementById('applyIfsc').value.trim() || '',
      landDetails: {
        state: document.getElementById('landState').value.trim() || payload.state,
        district: document.getElementById('landDistrict').value.trim() || payload.district,
        subDistrict: document.getElementById('landSubDistrict').value.trim() || '',
        block: document.getElementById('landBlock').value.trim() || '',
        village: document.getElementById('landVillage').value.trim() || '',
        singleOrJoint: document.getElementById('landHoldingType').value.trim() || '',
        khataNo: document.getElementById('landKhataNo').value.trim() || '',
        surveyKhasraDagNo: document.getElementById('landSurveyNo').value.trim() || '',
        area: document.getElementById('landArea').value.trim() || '',
        landTransferDetails: document.getElementById('landTransferDetails').value.trim() || '',
        landDateVesting: document.getElementById('landDateVesting').value.trim() || '',
        pattaRfa: document.getElementById('landPattaRfa').value.trim() || '',
        aadhaarNo: document.getElementById('landAadhaarNo').value.trim() || document.getElementById('applyAadhaar').value.trim() || '',
        applicantName: document.getElementById('landApplicantName').value.trim() || document.getElementById('applyName').value.trim() || '',
      },
      state: payload.state,
      district: payload.district,
      farmSize: payload.farmSize,
      crop: payload.crop,
      income: payload.income,
      caste: payload.caste,
      gender: payload.gender,
      landOwnership: payload.landOwnership,
      bankAccount: payload.bankAccount,
    },
    attached_files: files.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      lastModified: f.lastModified,
    })),
    note: 'File binaries are not auto-uploaded to government portals. Use the portal link and upload files manually.',
  };

  const fileName = `application-packet-${(selectedScheme.id || 'scheme').replace(/[^a-zA-Z0-9-_]/g, '')}.json`;
  downloadBlob(JSON.stringify(packet, null, 2), fileName, 'application/json;charset=utf-8');
  setAdminStatus(`Downloaded ${fileName}. Open the official portal and upload documents manually.`);
}

function autoFillFromDocuments() {
  const beforeAadhaar = document.getElementById('applyAadhaar').value.trim();
  const beforeName = document.getElementById('applyName').value.trim();
  const beforeBankName = document.getElementById('applyBankName').value.trim();
  const beforeAccount = document.getElementById('applyBankAccountNumber').value.trim();
  const beforeIfsc = document.getElementById('applyIfsc').value.trim();

  applyDetectedAadhaarDetails({ force: true });
  applyDetectedBankDetails();

  const afterAadhaar = document.getElementById('applyAadhaar').value.trim();
  const afterName = document.getElementById('applyName').value.trim();
  const afterBankName = document.getElementById('applyBankName').value.trim();
  const afterAccount = document.getElementById('applyBankAccountNumber').value.trim();
  const afterIfsc = document.getElementById('applyIfsc').value.trim();

  const changed = [];
  if (!beforeAadhaar && afterAadhaar) changed.push('Aadhaar');
  if (!beforeName && afterName) changed.push('Name');
  if (!beforeBankName && afterBankName) changed.push('Bank Name');
  if (!beforeAccount && afterAccount) changed.push('Bank Account');
  if (!beforeIfsc && afterIfsc) changed.push('IFSC');

  if (changed.length) {
    setAdminStatus(`Auto-filled: ${changed.join(', ')}.`);
  } else {
    setAdminStatus('No new fields were auto-filled. Please verify and enter missing details manually.');
  }
}

function buildReadinessChecklist() {
  const name = document.getElementById('applyName').value.trim();
  const mobile = document.getElementById('applyMobile').value.trim();
  const aadhaar = document.getElementById('applyAadhaar').value.replace(/\D/g, '');
  const bankName = document.getElementById('applyBankName').value.trim();
  const bankAcc = document.getElementById('applyBankAccountNumber').value.replace(/\D/g, '');
  const ifsc = document.getElementById('applyIfsc').value.trim();
  const landState = document.getElementById('landState').value.trim();
  const landDistrict = document.getElementById('landDistrict').value.trim();
  const landSubDistrict = document.getElementById('landSubDistrict').value.trim();
  const landBlock = document.getElementById('landBlock').value.trim();
  const landVillage = document.getElementById('landVillage').value.trim();
  const landHoldingType = document.getElementById('landHoldingType').value.trim();
  const landKhataNo = document.getElementById('landKhataNo').value.trim();
  const landSurveyNo = document.getElementById('landSurveyNo').value.trim();
  const landArea = document.getElementById('landArea').value.trim();
  const landTransferDetails = document.getElementById('landTransferDetails').value.trim();
  const landDateVesting = document.getElementById('landDateVesting').value.trim();
  const landPattaRfa = document.getElementById('landPattaRfa').value.trim();
  const landAadhaar = (document.getElementById('landAadhaarNo').value || document.getElementById('applyAadhaar').value || '').replace(/\D/g, '');
  const landName = (document.getElementById('landApplicantName').value || document.getElementById('applyName').value || '').trim();
  const allScanned = Object.values(scannedDocsByName || {});
  const hasAadhaarDoc = allScanned.some(row => effectiveDetectedType(row) === 'aadhaar');
  const hasBankDoc = allScanned.some(row => effectiveDetectedType(row) === 'bank_passbook');

  return [
    { label: 'Applicant Name',           ok: name.length > 0,                        hint: 'Enter your full name in the Applicant Name field.' },
    { label: 'Mobile Number',             ok: /^\d{10}$/.test(mobile),                hint: 'Enter a valid 10-digit mobile number.' },
    { label: 'Aadhaar Number',            ok: aadhaar.length === 12,                  hint: 'Upload your Aadhaar card or type the 12-digit number manually.' },
    { label: 'Bank Name',                 ok: bankName.length > 0,                    hint: 'Upload your bank passbook to auto-detect, or type the bank name.' },
    { label: 'Bank Account Number',       ok: bankAcc.length >= 9,                    hint: 'Upload your passbook or type the account number (9–18 digits).' },
    { label: 'IFSC Code',                 ok: /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc),   hint: 'Enter the 11-character IFSC code from your passbook.' },
    { label: 'Land State',                ok: landState.length > 0,                   hint: 'Enter land record state as asked on PM-KISAN.' },
    { label: 'Land District',             ok: landDistrict.length > 0,                hint: 'Enter land record district.' },
    { label: 'Land Sub-district/Tehsil',  ok: landSubDistrict.length > 0,             hint: 'Enter sub-district/tehsil from land records.' },
    { label: 'Land Block',                ok: landBlock.length > 0,                   hint: 'Enter block.' },
    { label: 'Land Village',              ok: landVillage.length > 0,                 hint: 'Enter village.' },
    { label: 'Single/Joint Holding',      ok: ['single', 'joint'].includes(landHoldingType.toLowerCase()), hint: 'Select whether holding is single or joint.' },
    { label: 'Khata No',                  ok: landKhataNo.length > 0,                 hint: 'Enter Khata number from land record.' },
    { label: 'Survey/Khasra/Dag No',      ok: landSurveyNo.length > 0,                hint: 'Enter survey/khasra/dag number.' },
    { label: 'Land Area',                 ok: landArea.length > 0,                    hint: 'Enter area exactly as record.' },
    { label: 'Land Transfer Details',     ok: landTransferDetails.length > 0,         hint: 'Enter transfer details or N/A.' },
    { label: 'Land Date of Vesting',      ok: landDateVesting.length > 0,             hint: 'Select vesting date from records.' },
    { label: 'Patta No/RFA',              ok: ['yes', 'no'].includes(landPattaRfa.toLowerCase()), hint: 'Select Yes/No.' },
    { label: 'Land Section Aadhaar',      ok: landAadhaar.length === 12,              hint: 'Use Aadhaar number for land section.' },
    { label: 'Land Section Name',         ok: landName.length > 0,                    hint: 'Use applicant name for land section.' },
    { label: 'Aadhaar document uploaded', ok: hasAadhaarDoc,                          hint: 'Upload your Aadhaar PDF or image under "Upload Documents".' },
    { label: 'Bank passbook uploaded',    ok: hasBankDoc,                             hint: 'Upload your bank passbook PDF or image under "Upload Documents".' },
  ];
}

function showReadinessModal(checks, onProceed) {
  const existing = document.getElementById('readinessModal');
  if (existing) existing.remove();

  const incomplete = checks.filter(c => !c.ok);

  const overlay = document.createElement('div');
  overlay.id = 'readinessModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';

  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:12px;padding:24px;max-width:500px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.18);font-family:inherit;';

  const allGood = incomplete.length === 0;

  let checklistHtml = checks.map(c =>
    `<li style="margin-bottom:6px;">
      <span style="color:${c.ok ? '#2e7d32' : '#d9534f'};font-weight:bold;">${c.ok ? '✓' : '✗'}</span>
      <strong style="margin-left:6px;">${c.label}</strong>
      ${c.ok ? '' : `<br><span style="font-size:12px;color:#888;margin-left:20px;">${c.hint}</span>`}
    </li>`
  ).join('');

  box.innerHTML = `
    <h3 style="margin:0 0 8px;color:${allGood ? '#2e7d32' : '#d9534f'};">
      ${allGood ? '&#10003; Ready to Submit' : '&#9888; Incomplete Application'}
    </h3>
    <p style="margin:0 0 14px;font-size:14px;color:#555;">
      ${allGood
        ? 'All required fields are filled and documents uploaded. Your details have been <strong>copied to clipboard</strong>. Open the portal and paste them as needed.'
        : `<strong>${incomplete.length}</strong> item${incomplete.length > 1 ? 's are' : ' is'} missing. Fix them for a complete submission, or proceed anyway.`}
    </p>
    <ul style="margin:0 0 18px;padding-left:0;list-style:none;font-size:14px;line-height:1.6;">${checklistHtml}</ul>
    <p style="margin:0 0 14px;font-size:12px;color:#888;border-top:1px solid #eee;padding-top:10px;">
      &#9432; <strong>Note:</strong> pmkisan.gov.in is only accessible from <strong>India</strong>. If you get a connection error, connect to an Indian VPN server and try again.
    </p>
    <div style="display:flex;gap:10px;justify-content:flex-end;">
      <button id="readinessCloseBtn" style="padding:8px 18px;border-radius:8px;border:1px solid #ccc;background:#f5f5f5;cursor:pointer;font-size:14px;">
        ${allGood ? 'Cancel' : 'Go Back &amp; Fix'}
      </button>
      <button id="readinessProceedBtn" style="padding:8px 18px;border-radius:8px;border:none;background:${allGood ? '#357a38' : '#e8a020'};color:#fff;cursor:pointer;font-size:14px;">
        ${allGood ? 'Open Official Portal &#8594;' : 'Proceed Anyway &#8594;'}
      </button>
    </div>`;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById('readinessCloseBtn').addEventListener('click', () => overlay.remove());
  document.getElementById('readinessProceedBtn').addEventListener('click', () => { overlay.remove(); onProceed(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

async function openOfficialPortal() {
  const portalUrl = getOfficialPortalUrl();

  // Copy all details to clipboard first
  const copied = await copyPrefillToClipboard();

  const checks = buildReadinessChecklist();

  showReadinessModal(checks, () => {
    window.open(portalUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => {
      setAdminStatus(
        (copied ? 'Details copied to clipboard. ' : '') +
        'Portal opened in a new tab. ' +
        'If you see ERR_CONNECTION_TIMED_OUT, the portal is only accessible from India — connect to an Indian VPN and try again.'
      );
    }, 800);
  });
}

const PM_KISAN_PORTAL_URL = 'https://pmkisan.gov.in';
let portalSplitFallbackTimer = null;

function getOfficialPortalUrl() {
  return (selectedScheme && selectedScheme.website) || PM_KISAN_PORTAL_URL;
}

async function copyPrefillToClipboard() {
  const text = prefillText();
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    return false;
  }
}

function setPortalSplitVisible(isVisible) {
  const shell = document.getElementById('workspaceShell');
  const panel = document.getElementById('portalSplitView');
  const frame = document.getElementById('portalSplitFrame');
  const fallback = document.getElementById('portalSplitFallback');
  if (!shell || !panel || !frame || !fallback) return;

  shell.classList.toggle('portal-open', isVisible);
  panel.setAttribute('aria-hidden', isVisible ? 'false' : 'true');

  if (!isVisible) {
    if (portalSplitFallbackTimer) {
      clearTimeout(portalSplitFallbackTimer);
      portalSplitFallbackTimer = null;
    }
    fallback.hidden = true;
    frame.src = 'about:blank';
  }
}

async function openPortalSideBySide() {
  const portalUrl = getOfficialPortalUrl();
  const frame = document.getElementById('portalSplitFrame');
  const fallback = document.getElementById('portalSplitFallback');
  if (!frame || !fallback) return;

  const copied = await copyPrefillToClipboard();

  fallback.hidden = true;
  setPortalSplitVisible(true);
  frame.src = portalUrl;

  if (portalSplitFallbackTimer) clearTimeout(portalSplitFallbackTimer);
  portalSplitFallbackTimer = setTimeout(() => {
    fallback.hidden = false;
  }, 4000);

  setAdminStatus(
    (copied ? 'Details copied to clipboard. ' : '') +
    'Portal opened side by side. If it stays blank, use the new-tab button in the right panel.'
  );
}

function closePortalSideBySide() {
  setPortalSplitVisible(false);
}

function formatAadhaar(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 12);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function setAadhaarBadge(status, text) {
  const badge = document.getElementById('aadhaarStatusBadge');
  if (!badge) return;
  badge.className = 'aadhaar-badge';
  badge.classList.add(status || 'unknown');
  badge.textContent = text || 'Unknown';
}

function clearAadhaarDerivedFields() {
  const aadhaarEl = document.getElementById('applyAadhaar');
  const nameEl = document.getElementById('applyName');

  if (aadhaarEl) {
    aadhaarEl.value = '';
    delete aadhaarEl.dataset.source;
  }

  if (nameEl && nameEl.dataset.source === 'aadhaar') {
    nameEl.value = '';
    delete nameEl.dataset.source;
  }

  setAadhaarBadge('unknown', 'Unknown');
}

function findScannedRowForFile(file) {
  if (!file || !file.name) return null;
  const rows = Object.values(scannedDocsByName || {});
  return rows.find((row) => row && row.fileName === file.name) || null;
}

function findBestScannedAadhaarRow() {
  const rows = Object.values(scannedDocsByName || {});
  const aadhaarRows = rows
    .filter((row) => row && effectiveDetectedType(row) === 'aadhaar')
    .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));
  return aadhaarRows[0] || null;
}

function normalizeAadhaarCandidate(value) {
  const raw = String(value || '')
    .replace(/[OoQqD]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8');

  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12) return digits;
  if (digits.length > 12) return digits.slice(0, 12);
  return '';
}

function bestAadhaarFromRow(row) {
  return String(
    normalizeAadhaarCandidate(row?.fields?.aadhaar) ||
    normalizeAadhaarCandidate((row?.fields?.candidates || [])[0] || '') ||
    normalizeAadhaarCandidate((row?.fields?.candidates || [])[1] || '') ||
    normalizeAadhaarCandidate(extractAadhaarFromRawText(row?.text_preview || '')) ||
    ''
  ).trim();
}

function applyDetectedAadhaarDetails({ force = false } = {}) {
  const aadhaarEl = document.getElementById('applyAadhaar');
  const nameEl = document.getElementById('applyName');
  if (!aadhaarEl) return;

  const aadhaarRows = Object.values(scannedDocsByName || {})
    .filter((row) => row && effectiveDetectedType(row) === 'aadhaar')
    .sort((a, b) => Number(b.uploadedAt || 0) - Number(a.uploadedAt || 0) || Number(b.confidence || 0) - Number(a.confidence || 0));

  if (!aadhaarRows.length) return;

  const bestRow = aadhaarRows[0];
  const candidate = bestAadhaarFromRow(bestRow);
  const canFillAadhaar = force || !aadhaarEl.value.trim() || aadhaarEl.dataset.source === 'aadhaar';

  if (candidate && canFillAadhaar) {
    aadhaarEl.value = formatAadhaar(candidate);
    aadhaarEl.dataset.source = 'aadhaar';
    const checksumOk = Boolean(bestRow?.fields?.checksum_valid);
    setAadhaarBadge(checksumOk ? 'detected' : 'candidate', checksumOk ? 'Detected' : 'Candidate');
  }

  const detectedName = String(bestRow?.fields?.name || '').trim();
  const canFillName = !nameEl?.value?.trim() || nameEl?.dataset?.source === 'aadhaar';
  if (nameEl && detectedName && canFillName) {
    nameEl.value = detectedName;
    nameEl.dataset.source = 'aadhaar';
  }
}

function extractAadhaarFromRawText(rawText) {
  const normalized = String(rawText || '')
    .replace(/[OoQqD]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8');

  const grouped = normalized.match(/\b\d{4}[\s\-]*\d{4}[\s\-]*\d{4}\b/);
  if (grouped && grouped[0]) {
    const digits = grouped[0].replace(/\D/g, '');
    if (digits.length === 12) return digits;
  }

  const strict12 = normalized.match(/(?<!\d)\d{12}(?!\d)/);
  if (strict12 && strict12[0]) return strict12[0];

  const allDigits = normalized.replace(/\D/g, '');
  if (allDigits.length >= 12) return allDigits.slice(0, 12);

  return '';
}

async function fetchAadhaarSignalsViaDocumentScan(file) {
  if (!file) return null;
  const formData = new FormData();
  formData.append('document', file);

  try {
    const res = await fetch(`${API_BASE}/api/extract/document`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return null;
    return data;
  } catch (_err) {
    return null;
  }
}

async function scanAadhaarFromSelectedFile(fileOverride = null, { allowFallback = false, preserveExisting = true } = {}) {
  const files = selectedFiles();
  const fileToScan = fileOverride || pickAadhaarCandidateFile(files, { allowFallback });
  const aadhaarInput = document.getElementById('applyAadhaar');
  const existingAadhaar = aadhaarInput.value.trim();
  const hadExistingAadhaar = Boolean(existingAadhaar);

  if (!fileToScan) {
    if (preserveExisting && hadExistingAadhaar) {
      setAdminStatus('No Aadhaar document detected in current upload. Kept previously extracted Aadhaar.');
      return;
    }
    setAdminStatus('Please upload an Aadhaar document or click Scan Aadhaar manually.', true);
    clearAadhaarDerivedFields();
    setAadhaarBadge('missing', 'No File');
    return;
  }

  let fileToSend = fileToScan;
  let convertedFromPdf = false;
  if (isPdfFile(fileToScan)) {
    const converted = await convertPdfFirstPageToPngFile(fileToScan);
    if (converted) {
      fileToSend = converted;
      convertedFromPdf = true;
    }
  }

  const formData = new FormData();
  formData.append('document', fileToSend);

  try {
    setAdminStatus(
      convertedFromPdf
        ? `Scanning ${fileToScan.name} (converted first PDF page to image) for Aadhaar number...`
        : `Scanning ${fileToScan.name} for Aadhaar number...`
    );
    const res = await fetch(`${API_BASE}/api/extract/aadhaar`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data?.error || 'Aadhaar scan failed');
    }

    if (!data.aadhaar) {
      let scannedRow = findScannedRowForFile(fileToScan) || findBestScannedAadhaarRow();
      if (!scannedRow || !scannedRow.fields || (!scannedRow.fields.aadhaar && !(scannedRow.fields.candidates || []).length)) {
        const liveScan = await fetchAadhaarSignalsViaDocumentScan(fileToScan);
        if (liveScan && liveScan.detected_type === 'aadhaar') {
          scannedRow = {
            fileName: fileToScan.name,
            text_preview: liveScan.text_preview || '',
            fields: liveScan.fields || {},
          };
        }
      }

      const fallbackAadhaar = String(
        bestAadhaarFromRow(scannedRow) ||
        normalizeAadhaarCandidate(extractAadhaarFromRawText(data?.text_preview || '')) ||
        ''
      ).trim();
      const fallbackName = String(scannedRow?.fields?.name || data.name || '').trim();

      if (fallbackAadhaar) {
        const formattedFallback = formatAadhaar(fallbackAadhaar);
        const aadhaarEl = document.getElementById('applyAadhaar');
        aadhaarEl.value = formattedFallback;
        aadhaarEl.dataset.source = 'aadhaar';

        if (fallbackName) {
          const nameEl = document.getElementById('applyName');
          if (nameEl && !nameEl.value.trim()) {
            nameEl.value = fallbackName;
            nameEl.dataset.source = 'aadhaar';
          }
        }

        const checksumOk = Boolean(scannedRow?.fields?.checksum_valid);
        setAadhaarBadge(checksumOk ? 'detected' : 'candidate', checksumOk ? 'Detected' : 'Candidate');
        setAdminStatus(
          checksumOk
            ? `Aadhaar detected from scanned OCR fallback: ${formattedFallback}${fallbackName ? ` | Name: ${fallbackName}` : ''}`
            : `Aadhaar candidate from scanned OCR fallback: ${formattedFallback}${fallbackName ? ` | Name: ${fallbackName}` : ''}`
        );
        renderDocChecklist();
        return;
      }

      if (data.name) {
        const nameEl = document.getElementById('applyName');
        if (nameEl && !nameEl.value.trim()) {
          nameEl.value = data.name;
          nameEl.dataset.source = 'aadhaar';
        }
      }
      const warning = data?.warning ? ` ${data.warning}` : '';
      if (preserveExisting && hadExistingAadhaar) {
        const nameNote = data?.name ? ` Name detected: ${data.name}.` : '';
        setAdminStatus(`No Aadhaar found in ${fileToScan.name}.${warning}${nameNote} Kept previously extracted Aadhaar.`, true);
        return;
      }
      const nameNote = data?.name ? ` Name detected: ${data.name}.` : '';
      setAdminStatus(`No Aadhaar number detected yet. Ensure Aadhaar file is uploaded and readable.${warning}${nameNote}`, true);
      clearAadhaarDerivedFields();
      setAadhaarBadge('missing', 'Not Detected');
      return;
    }

    const formatted = formatAadhaar(data.aadhaar);
    document.getElementById('applyAadhaar').value = formatted;
    document.getElementById('applyAadhaar').dataset.source = 'aadhaar';
    
    // Auto-fill name from Aadhaar if extracted
    if (data.name) {
      document.getElementById('applyName').value = data.name;
      document.getElementById('applyName').dataset.source = 'aadhaar';
      setAdminStatus(
        data.checksum_valid
          ? `Aadhaar detected: ${formatted} | Name: ${data.name}`
          : `Aadhaar candidate detected (checksum not confirmed): ${formatted} | Name: ${data.name}`
      );
    } else {
      setAdminStatus(
        data.checksum_valid
          ? `Aadhaar detected: ${formatted}`
          : `Aadhaar candidate detected (checksum not confirmed): ${formatted}`
      );
    }
    
    setAadhaarBadge(data.checksum_valid ? 'detected' : 'candidate', data.checksum_valid ? 'Detected' : 'Candidate');
    renderDocChecklist();
  } catch (err) {
    setAdminStatus(`Aadhaar scan failed: ${err.message}`, true);
    setAadhaarBadge('missing', 'Scan Failed');
  }
}

async function scanLandRecordFromSelectedFile() {
  const files = selectedFiles();
  if (!files || files.length === 0) {
    setAdminStatus('Please upload a RoR/Khatiyan document image.', true);
    return;
  }

  // Use first uploaded file for RoR extraction
  const fileToScan = files[0];
  
  let fileToSend = fileToScan;
  let convertedFromPdf = false;
  if (isPdfFile(fileToScan)) {
    const converted = await convertPdfFirstPageToPngFile(fileToScan);
    if (converted) {
      fileToSend = converted;
      convertedFromPdf = true;
    }
  }

  const formData = new FormData();
  formData.append('document', fileToSend);

  try {
    setAdminStatus(
      convertedFromPdf
        ? `Scanning ${fileToScan.name} (converted first PDF page to image) for land record details...`
        : `Scanning ${fileToScan.name} for land record details...`
    );

    const res = await fetch(`${API_BASE}/api/extract/land-record`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data?.error || 'Land record scan failed');
    }

    const details = data.details || {};
    const fieldsFound = data.fields_found || 0;

    if (fieldsFound === 0) {
      setAdminStatus(`Could not detect structured land record format in ${fileToScan.name}. Please verify image quality.`, true);
      return;
    }

    // Auto-fill land fields with extracted data
    if (details.state) {
      document.getElementById('landState').value = details.state;
    }
    if (details.district) {
      document.getElementById('landDistrict').value = details.district;
    }
    if (details.subDistrict) {
      document.getElementById('landSubDistrict').value = details.subDistrict;
    }
    if (details.block) {
      document.getElementById('landBlock').value = details.block;
    }
    if (details.village) {
      document.getElementById('landVillage').value = details.village;
    }
    if (details.surveyNo) {
      document.getElementById('landSurveyNo').value = details.surveyNo;
    }
    if (details.area) {
      document.getElementById('landArea').value = details.area;
    }
    if (details.landOwnerName) {
      const nameEl = document.getElementById('landApplicantName');
      if (nameEl && !nameEl.value.trim()) {
        nameEl.value = details.landOwnerName;
      }
    }
    if (details.holdingType) {
      const holdingEl = document.getElementById('landHoldingType');
      if (holdingEl) {
        holdingEl.value = details.holdingType;
      }
    }

    const fieldsFilledList = [];
    if (details.state) fieldsFilledList.push('State');
    if (details.district) fieldsFilledList.push('District');
    if (details.village) fieldsFilledList.push('Village');
    if (details.surveyNo) fieldsFilledList.push('Survey No');
    if (details.area) fieldsFilledList.push('Area');

    setAdminStatus(
      `Land record extracted successfully (${fieldsFound} fields found). ` +
      `Auto-filled: ${fieldsFilledList.length > 0 ? fieldsFilledList.join(', ') : 'None'}. ` +
      `Please review and fill remaining fields manually.`
    );
    
    renderDocChecklist();
  } catch (err) {
    setAdminStatus(`Land record scan failed: ${err.message}`, true);
  }
}

async function scanBankPassbookFromSelectedFile() {
  const files = selectedFiles();
  if (!files || files.length === 0) {
    setAdminStatus('Please upload a bank passbook document image.', true);
    return;
  }

  // Use first uploaded file for bank passbook extraction
  const fileToScan = files[0];
  
  let fileToSend = fileToScan;
  let convertedFromPdf = false;
  if (isPdfFile(fileToScan)) {
    const converted = await convertPdfFirstPageToPngFile(fileToScan);
    if (converted) {
      fileToSend = converted;
      convertedFromPdf = true;
    }
  }

  const formData = new FormData();
  formData.append('document', fileToSend);

  try {
    setAdminStatus(
      convertedFromPdf
        ? `Scanning ${fileToScan.name} (converted first PDF page to image) for bank passbook details...`
        : `Scanning ${fileToScan.name} for bank passbook details...`
    );

    const res = await fetch(`${API_BASE}/api/extract/document`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data?.error || 'Bank passbook scan failed');
    }

    if (data.detected_type !== 'bank_passbook') {
      setAdminStatus(
        `Document appears to be ${data.detected_type || 'unknown'} (not a bank passbook). ` +
        `Confidence: ${Math.round(Number(data.confidence || 0) * 100)}%. Please upload a clear bank passbook image.`,
        true
      );
      return;
    }

    const fields = data.fields || {};
    const bankName = (fields.bank_name || (fields.bank_name_candidates || [])[0] || '').trim();
    const account = String(fields.account_number || (fields.account_number_candidates || [])[0] || '').trim();
    const ifsc = String(fields.ifsc || (fields.ifsc_candidates || [])[0] || '').trim();

    const filledFields = [];
    if (bankName) {
      document.getElementById('applyBankName').value = bankName;
      document.getElementById('applyBankName').dataset.source = 'bank_passbook';
      filledFields.push(`Bank: ${bankName}`);
    }
    if (account) {
      document.getElementById('applyBankAccountNumber').value = account;
      document.getElementById('applyBankAccountNumber').dataset.source = 'bank_passbook';
      filledFields.push(`Account: ${account}`);
    }
    if (ifsc) {
      document.getElementById('applyIfsc').value = ifsc;
      document.getElementById('applyIfsc').dataset.source = 'bank_passbook';
      filledFields.push(`IFSC: ${ifsc}`);
    }

    const confidence = Math.round(Number(data.confidence || 0) * 100);
    if (filledFields.length > 0) {
      setAdminStatus(
        `Bank passbook extracted (Confidence: ${confidence}%). ` +
        `Auto-filled: ${filledFields.join(' | ')}`
      );
    } else {
      setAdminStatus(
        `Bank passbook detected but no fields extracted. Please check image quality and ensure all details are visible.`,
        true
      );
    }
    
    validateAccountNumber();
    renderDocChecklist();
  } catch (err) {
    setAdminStatus(`Bank passbook scan failed: ${err.message}`, true);
  }
}

async function scanTaxReceiptFromSelectedFile() {
  const files = selectedFiles();
  if (!files || files.length === 0) {
    setAdminStatus('Please upload a tax receipt (Lagaan/Rasid) document image.', true);
    return;
  }

  // Use first uploaded file for lagaan extraction
  const fileToScan = files[0];
  
  let fileToSend = fileToScan;
  let convertedFromPdf = false;
  if (isPdfFile(fileToScan)) {
    const converted = await convertPdfFirstPageToPngFile(fileToScan);
    if (converted) {
      fileToSend = converted;
      convertedFromPdf = true;
    }
  }

  const formData = new FormData();
  formData.append('document', fileToSend);

  try {
    setAdminStatus(
      convertedFromPdf
        ? `Scanning ${fileToScan.name} (converted first PDF page to image) for tax receipt details...`
        : `Scanning ${fileToScan.name} for tax receipt details...`
    );

    const res = await fetch(`${API_BASE}/api/extract/lagaan`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data?.error || 'Tax receipt scan failed');
    }

    const details = data.details || {};
    const fieldsFound = data.fields_found || 0;

    if (fieldsFound === 0) {
      setAdminStatus(`Could not detect structured tax receipt format in ${fileToScan.name}. Please verify image quality.`, true);
      return;
    }

    // Auto-fill land fields with extracted data
    if (details.village) {
      document.getElementById('landVillage').value = details.village;
    }
    if (details.khata) {
      document.getElementById('landKhataNo').value = details.khata;
    }
    if (details.surveyNo) {
      document.getElementById('landSurveyNo').value = details.surveyNo;
    }
    if (details.area) {
      document.getElementById('landArea').value = details.area;
    }
    if (details.landOwnerName) {
      const nameEl = document.getElementById('landApplicantName');
      if (nameEl && !nameEl.value.trim()) {
        nameEl.value = details.landOwnerName;
      }
    }

    const fieldsFilledList = [];
    if (details.village) fieldsFilledList.push('Village');
    if (details.khata) fieldsFilledList.push('Khata #');
    if (details.surveyNo) fieldsFilledList.push('Survey #');
    if (details.area) fieldsFilledList.push('Area');
    if (details.landOwnerName) fieldsFilledList.push('Owner Name');

    setAdminStatus(
      `Tax receipt extracted successfully (${fieldsFound} fields found). ` +
      `Auto-filled: ${fieldsFilledList.length > 0 ? fieldsFilledList.join(', ') : 'None'}. ` +
      `Please review and fill remaining fields manually.`
    );
    
    renderDocChecklist();
  } catch (err) {
    setAdminStatus(`Tax receipt scan failed: ${err.message}`, true);
  }
}

async function fetchSchemes() {
  const payload = buildPayload();
  document.getElementById('results').innerHTML = `<div class="card">${t('loading')}</div>`;

  try {
    const res = await apiFetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    render(data.results || []);
  } catch (err) {
    document.getElementById('results').innerHTML =
      `<div class="card">${t('connectError')}</div>`;
    console.error(err);
  }
}

// Guided Submission Walkthrough
let currentGuidedStep = 0;
const guidedSteps = [
  {
    title: 'Personal Details',
    hint: 'Go to "Personal Details" section on PM-KISAN portal. Fill your name, mobile number, and Aadhaar number.',
    fields: [
      { label: 'Full Name', id: 'applyName' },
      { label: 'Mobile Number', id: 'applyMobile' },
      { label: 'Aadhaar Number', id: 'applyAadhaar' }
    ]
  },
  {
    title: 'Bank Details',
    hint: 'Go to "Bank Details" section. Fill your bank name, account number, and IFSC code.',
    fields: [
      { label: 'Bank Name', id: 'applyBankName' },
      { label: 'Account Number', id: 'applyBankAccountNumber' },
      { label: 'IFSC Code', id: 'applyIfsc' }
    ]
  },
  {
    title: 'Land Details',
    hint: 'Go to "Land Details" section. Fill all land information: state, district, village, khata, survey no, area.',
    fields: [
      { label: 'State', id: 'landState' },
      { label: 'District', id: 'landDistrict' },
      { label: 'Village', id: 'landVillage' },
      { label: 'Khata No', id: 'landKhataNo' },
      { label: 'Survey / Khasra / Dag No', id: 'landSurveyNo' },
      { label: 'Area', id: 'landArea' }
    ]
  }
];

function renderGuidedStep() {
  const step = guidedSteps[currentGuidedStep];
  const overlay = document.getElementById('guidedSubmissionOverlay');
  const titleEl = document.getElementById('guidedTitle');
  const contentEl = document.getElementById('guidedContent');
  const hintEl = document.getElementById('guidedHint');
  const fieldsEl = document.getElementById('guidedFields');
  const stepIndicator = document.getElementById('guidedStepIndicator');
  const prevBtn = document.getElementById('guidedPrevBtn');
  const nextBtn = document.getElementById('guidedNextBtn');

  if (!step) return;

  titleEl.textContent = `Step ${currentGuidedStep + 1}: ${step.title}`;
  hintEl.textContent = step.hint;
  stepIndicator.textContent = `Step ${currentGuidedStep + 1} of ${guidedSteps.length}`;

  // Rich content for each step
  let richContent = '';
  if (currentGuidedStep === 0) {
    richContent = `
      <p><strong>Instructions:</strong></p>
      <ol style="margin-left:20px;">
        <li>Click "Personal Details" on PM-KISAN portal</li>
        <li>For each field below, click "Copy" button</li>
        <li>Paste it into the corresponding field on the portal</li>
        <li>Click "Next" when all fields are filled</li>
      </ol>
    `;
  } else if (currentGuidedStep === 1) {
    richContent = `
      <p><strong>Instructions:</strong></p>
      <ol style="margin-left:20px;">
        <li>On the portal, look for "Bank Account Details" section</li>
        <li>Copy each field below and paste into the portal</li>
        <li>Make sure values match your actual bank passbook exactly</li>
        <li>Click "Next" to proceed to land details</li>
      </ol>
    `;
  } else if (currentGuidedStep === 2) {
    richContent = `
      <p><strong>Instructions:</strong></p>
      <ol style="margin-left:20px;">
        <li>On the portal, find "Land Details" section</li>
        <li>Fill state/district dropdowns from your extracted data</li>
        <li>For each text field, copy from the boxes below</li>
        <li>After filling all fields, you're ready to submit!</li>
      </ol>
    `;
  }
  contentEl.innerHTML = richContent;

  // Render field copy buttons
  let fieldsHTML = '';
  for (const field of step.fields) {
    const value = document.getElementById(field.id)?.value || '(not filled)';
    const isEmpty = !value || value === '(not filled)';
    const isValid = !isEmpty;
    fieldsHTML += `
      <div style="background:#f9f9f9; padding:12px; margin-bottom:10px; border-left:4px solid ${isValid ? '#10b981' : '#999'}; border-radius:4px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <div>
            <div style="font-weight:bold; color:#333;">${field.label}</div>
            <div style="color:#666; font-size:13px; margin-top:4px; word-break:break-all;">${value}</div>
          </div>
          <button type="button" class="secondary" onclick="copyFieldValue('${field.id}', '${field.label}')" style="white-space:nowrap; padding:8px 12px; font-size:12px;">📋 Copy</button>
        </div>
      </div>
    `;
  }
  fieldsEl.innerHTML = fieldsHTML || '<p style="color:#999;">No fields to fill yet.</p>';

  // Toggle button states
  prevBtn.disabled = currentGuidedStep === 0;
  nextBtn.disabled = currentGuidedStep === guidedSteps.length - 1;
  
  prevBtn.style.opacity = currentGuidedStep === 0 ? '0.5' : '1';
  nextBtn.style.opacity = currentGuidedStep === guidedSteps.length - 1 ? '0.5' : '1';
}

function openGuidedSubmissionWalkthrough() {
  currentGuidedStep = 0;
  document.getElementById('guidedSubmissionOverlay').style.display = 'block';
  renderGuidedStep();
}

function closeGuidedSubmissionWalkthrough() {
  document.getElementById('guidedSubmissionOverlay').style.display = 'none';
}

function setAdminStatus(message, isError = false) {
  const el = document.getElementById('adminStatus');
  el.textContent = message;
  el.style.color = isError ? '#b91c1c' : '#0f766e';
}

function setRoleBadge(role, name = '') {
  const badge = document.getElementById('activeRoleBadge');
  if (!badge) return;
  badge.className = 'role-badge';

  if (!role) {
    badge.classList.add('unknown');
    badge.textContent = 'Role: Unknown';
    return;
  }

  badge.classList.add(role);
  const label = name ? `${name} (${role})` : role;
  badge.textContent = `Role: ${label}`;
}

function applyRoleAccess(role) {
  const queueOnlyButtons = [
    document.getElementById('loadQueueBtn'),
    document.getElementById('downloadQueueCsvBtn')
  ];
  const auditButtons = [
    document.getElementById('loadAuditBtn'),
    document.getElementById('downloadAuditCsvBtn')
  ];

  const canQueue = role === 'reviewer' || role === 'superadmin';
  const canAudit = role === 'auditor' || role === 'reviewer' || role === 'superadmin';

  queueOnlyButtons.forEach((btn) => {
    if (btn) btn.disabled = !canQueue;
  });
  auditButtons.forEach((btn) => {
    if (btn) btn.disabled = !canAudit;
  });
}

async function refreshAdminRole() {
  const key = document.getElementById('adminKey').value.trim();
  if (!key) {
    activeAdminRole = null;
    setRoleBadge(null);
    applyRoleAccess(null);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/me`, {
      method: 'GET',
      headers: adminHeaders()
    });

    if (res.status === 401 || res.status === 403) {
      activeAdminRole = null;
      setRoleBadge(null);
      applyRoleAccess(null);
      return;
    }

    if (!res.ok) {
      throw new Error(`Role check failed: ${res.status}`);
    }

    const data = await res.json();
    activeAdminRole = data?.admin?.role || null;
    setRoleBadge(activeAdminRole, data?.admin?.name || '');
    applyRoleAccess(activeAdminRole);
  } catch (_err) {
    activeAdminRole = null;
    setRoleBadge(null);
    applyRoleAccess(null);
  }
}

function adminDecisionRow(item) {
  const reasonOptions = rejectionReasons
    .map((r) => `<option value="${r.code}">${r.label}</option>`)
    .join('');

  return `
    <div class="decision-row">
      <select id="decision-${item.id}">
        <option value="verified">verified</option>
        <option value="pending">pending</option>
        <option value="rejected">rejected</option>
      </select>
      <select id="reason-${item.id}" style="display:none;">
        <option value="">Select rejection reason...</option>
        ${reasonOptions}
      </select>
      <input id="note-${item.id}" type="text" placeholder="Decision notes" />
      <button type="button" class="tiny" data-scheme-id="${item.id}">Submit Decision</button>
    </div>
  `;
}

function renderQueue(items) {
  const root = document.getElementById('adminQueue');
  if (!items.length) {
    root.innerHTML = '<div class="admin-item">No pending or rejected schemes in queue.</div>';
    return;
  }

  root.innerHTML = items.map((item) => `
    <div class="admin-item">
      <h4>${item.name}</h4>
      <div class="meta">ID: ${item.id} | Scope: ${item.scope} | Status: ${item.status}</div>
      <div class="meta">Source: <a href="${item.source_url}" target="_blank" rel="noreferrer">${item.source_url}</a></div>
      ${adminDecisionRow(item)}
    </div>
  `).join('');

  root.querySelectorAll('button[data-scheme-id]').forEach((btn) => {
    const schemeId = btn.getAttribute('data-scheme-id');
    const decisionSelect = document.getElementById(`decision-${schemeId}`);
    const reasonSelect = document.getElementById(`reason-${schemeId}`);

    // Show/hide reason dropdown based on decision
    decisionSelect.addEventListener('change', () => {
      reasonSelect.style.display = decisionSelect.value === 'rejected' ? 'block' : 'none';
    });

    btn.addEventListener('click', async (evt) => {
      await submitDecision(schemeId);
    });
  });
}

function renderAudit(items) {
  const root = document.getElementById('adminAudit');
  if (!items.length) {
    root.innerHTML = '<div class="admin-item">No audit events yet.</div>';
    return;
  }

  root.innerHTML = items.map((a) => `
    <div class="admin-item">
      <div><strong>${a.scheme_id}</strong> ${a.before} -> ${a.after}</div>
      <div class="meta">Reviewer: ${a.reviewer} | Time: ${a.ts}</div>
      <div class="meta">Reason Code: ${a.reason_code || '-'}</div>
      <div class="meta">Notes: ${a.notes || '-'}</div>
    </div>
  `).join('');
}

async function loadQueue() {
  try {
    const state = document.getElementById('state').value;
    const stateCode = getStateCodeFromName(state);
    const res = await apiFetch(`/api/admin/verification/queue?state=${encodeURIComponent(stateCode)}`, {
      method: 'GET',
      headers: adminHeaders()
    });
    const data = await res.json();
    renderQueue(data.items || []);
    const adminLabel = data.admin ? `${data.admin.name} (${data.admin.role})` : 'admin';
    setAdminStatus(`Queue loaded by ${adminLabel}: ${data.total || 0} items.`);
  } catch (err) {
    setAdminStatus('Failed to load queue. Check admin key/role and backend status.', true);
    console.error(err);
  }
}

async function loadAudit() {
  try {
    const state = document.getElementById('state').value;
    const stateCode = getStateCodeFromName(state);
    const res = await apiFetch(`/api/admin/audit?limit=100&state=${encodeURIComponent(stateCode)}`, {
      method: 'GET',
      headers: adminHeaders()
    });
    const data = await res.json();
    renderAudit(data.items || []);
    const adminLabel = data.admin ? `${data.admin.name} (${data.admin.role})` : 'admin';
    setAdminStatus(`Audit loaded by ${adminLabel}: ${(data.items || []).length} events.`);
  } catch (err) {
    setAdminStatus('Failed to load audit log. Check admin key/role and backend status.', true);
    console.error(err);
  }
}

async function downloadAdminCsv(path, fileName) {
  try {
    const res = await apiFetch(path, {
      method: 'GET',
      headers: adminHeaders()
    });
    const csv = await res.text();
    downloadBlob(csv, fileName, 'text/csv;charset=utf-8');
    setAdminStatus(`Downloaded ${fileName}.`);
  } catch (err) {
    setAdminStatus(`Failed to download ${fileName}.`, true);
    console.error(err);
  }
}

async function submitDecision(schemeId) {
  const decision = document.getElementById(`decision-${schemeId}`).value;
  const reasonCode = document.getElementById(`reason-${schemeId}`).value;
  const notes = document.getElementById(`note-${schemeId}`).value;
  const reviewer = document.getElementById('reviewerName').value.trim() || 'Admin';

  // Validate that rejection has a reason
  if (decision === 'rejected' && !reasonCode) {
    setAdminStatus('Please select a rejection reason before submitting.', true);
    return;
  }

  try {
    const res = await apiFetch(`/api/admin/verification/${encodeURIComponent(schemeId)}/decision`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ decision, reasonCode, notes, reviewer })
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Decision failed');
    }
    setAdminStatus(`Updated ${schemeId} to ${decision} by ${data.admin.name} (${data.admin.role}).`);
    await loadQueue();
    await loadAudit();
  } catch (err) {
    setAdminStatus(`Failed to submit decision for ${schemeId}.`, true);
    console.error(err);
  }
}

document.getElementById('state').addEventListener('change', loadDistricts);
document.getElementById('submitBtn').addEventListener('click', fetchSchemes);
document.getElementById('language').addEventListener('change', applyUiLanguage);
document.getElementById('applicationDocs').addEventListener('change', async () => {
  const input = document.getElementById('applicationDocs');
  const newFiles = input && input.files ? Array.from(input.files) : [];
  if (!newFiles.length) return;
  renderDocChecklist();
  await scanSupportingDocuments(newFiles);
  input.value = '';
  renderDocChecklist();
  await scanAadhaarFromSelectedFile(null, { allowFallback: false, preserveExisting: true });
  setAdminStatus('Document uploaded. Use Download or Delete from the uploaded list below.');
});
document.getElementById('scanAadhaarBtn').addEventListener('click', () => {
  scanAadhaarFromSelectedFile(null, { allowFallback: true, preserveExisting: true });
});
document.getElementById('scanBankBtn').addEventListener('click', () => {
  scanBankPassbookFromSelectedFile();
});
document.getElementById('scanRorBtn').addEventListener('click', () => {
  scanLandRecordFromSelectedFile();
});
document.getElementById('scanLagaanBtn').addEventListener('click', () => {
  scanTaxReceiptFromSelectedFile();
});
document.getElementById('autoFillBtn').addEventListener('click', autoFillFromDocuments);
document.getElementById('copyPrefillBtn').addEventListener('click', copyPrefillDetails);
document.getElementById('copyNameBtn').addEventListener('click', () => copyFieldValue('applyName', 'Name'));
document.getElementById('copyMobileBtn').addEventListener('click', () => copyFieldValue('applyMobile', 'Mobile'));
document.getElementById('copyAadhaarBtn').addEventListener('click', () => copyFieldValue('applyAadhaar', 'Aadhaar'));
document.getElementById('copyIfscBtn').addEventListener('click', () => copyFieldValue('applyIfsc', 'IFSC'));
document.getElementById('downloadPacketBtn').addEventListener('click', downloadApplicationPacket);
document.getElementById('guidedSubmissionBtn').addEventListener('click', openGuidedSubmissionWalkthrough);
document.getElementById('openPortalSideBySideBtn').addEventListener('click', openPortalSideBySide);
document.getElementById('openPortalBtn').addEventListener('click', openOfficialPortal);
document.getElementById('portalSplitOpenNewTabBtn').addEventListener('click', openOfficialPortal);
document.getElementById('closePortalSplitBtn').addEventListener('click', closePortalSideBySide);

const portalSplitFrame = document.getElementById('portalSplitFrame');
if (portalSplitFrame) {
  portalSplitFrame.addEventListener('load', () => {
    const fallback = document.getElementById('portalSplitFallback');
    if (portalSplitFallbackTimer) {
      clearTimeout(portalSplitFallbackTimer);
      portalSplitFallbackTimer = null;
    }
    if (fallback) fallback.hidden = true;
  });
}

async function loadRejectionReasons() {
  try {
    const res = await apiFetch('/api/admin/rejection-reasons');
    const data = await res.json();
    rejectionReasons = data.reasons || [];
  } catch (err) {
    console.error('Failed to load rejection reasons:', err);
    rejectionReasons = [];
  }
}

loadDistricts().catch((err) => {
  document.getElementById('results').innerHTML =
    '<div class="card">Could not load regions. Start backend on http://localhost:3010 and retry.</div>';
  console.error(err);
});

refreshUploadSelectionHint();
