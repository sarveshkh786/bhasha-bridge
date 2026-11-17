// The page's data: the languages it offers and the sample notice it shows.
// The notice is fictional. It is written like the notices that most need translating:
// short, full of dates, times, amounts and a helpline number.

/**
 * Languages the assistant may translate into. English is the original.
 * dir is the writing direction the page sets on translated text.
 */
export const LANGUAGES = [
  { code: "hi", name: "Hindi", native: "हिन्दी", dir: "ltr" },
  { code: "bn", name: "Bengali", native: "বাংলা", dir: "ltr" },
  { code: "mr", name: "Marathi", native: "मराठी", dir: "ltr" },
  { code: "te", name: "Telugu", native: "తెలుగు", dir: "ltr" },
  { code: "ta", name: "Tamil", native: "தமிழ்", dir: "ltr" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", dir: "ltr" },
  { code: "ur", name: "Urdu", native: "اردو", dir: "rtl" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", dir: "ltr" },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ", dir: "ltr" },
  { code: "ml", name: "Malayalam", native: "മലയാളം", dir: "ltr" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", dir: "ltr" },
  { code: "as", name: "Assamese", native: "অসমীয়া", dir: "ltr" },
];

/**
 * Reading levels. "simple" is easy-read: short sentences and everyday words.
 */
export const READING_LEVELS = [
  { code: "simple", name: "Simple (easy-read: short sentences, everyday words)" },
  { code: "standard", name: "Standard (same tone and detail as the original)" },
];

/**
 * The sample notice, section by section, in its original English.
 */
export const NOTICE = {
  title: "Shantinagar Municipal Council — public notice (fictional sample)",
  sections: [
    {
      id: "headline",
      heading: "No water supply on Saturday, 19 December 2026",
      text: "Water supply in Wards 12, 13 and 14 will be stopped from 6:00 AM to 4:30 PM on 19-12-2026 for pipeline repair.",
    },
    {
      id: "prepare",
      heading: "What to do before the repair",
      text: "Store at least 40 litres of drinking water for each person on the night of 18-12-2026. Keep tanks and taps closed during the repair.",
    },
    {
      id: "tanker",
      heading: "Free water tanker",
      text: "A free water tanker will stand at the Ward 13 community hall from 9:00 AM to 1:00 PM. Bring your own containers.",
    },
    {
      id: "bills",
      heading: "Your water bill",
      text: "This repair does not change your water bill. The late fee of ₹150 is waived for bills paid by 31-12-2026.",
    },
    {
      id: "help",
      heading: "Help for older and disabled residents",
      text: "If you cannot carry water, call the free helpline 1800-000-0000 (24 hours) and volunteers will bring up to 20 litres to your door. Details: https://example.org/water-notice",
    },
  ],
};
