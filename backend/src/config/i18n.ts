/**
 * i18n Configuration
 * Phase 3 - US3.3: Multi-Language Support & RTL Layout
 *
 * Supported languages: English, Hindi, Tamil, Arabic
 */

export type SupportedLocale = 'en' | 'hi' | 'ta' | 'ar' | 'mr';

/**
 * Locale metadata with native names and directions
 */
export interface LocaleMetadata {
  code: SupportedLocale;
  name: string; // English name
  nativeName: string; // Native name
  direction: 'ltr' | 'rtl';
  dateFormat: string; // Default date format
  currencySymbol: string; // Default currency symbol for INR
  decimalSeparator: string;
  thousandsSeparator: string;
}

/**
 * Supported locales with metadata
 */
export const SUPPORTED_LOCALES: Record<SupportedLocale, LocaleMetadata> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    currencySymbol: '₹',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    currencySymbol: '₹',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  ta: {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    currencySymbol: '₹',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl',
    dateFormat: 'DD/MM/YYYY',
    currencySymbol: '₹',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  mr: {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    currencySymbol: '₹',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
};

/**
 * Default locale
 */
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * RTL (Right-to-Left) locales
 */
export const RTL_LOCALES: SupportedLocale[] = ['ar'];

/**
 * Check if a locale is supported
 */
export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return locale in SUPPORTED_LOCALES;
}

/**
 * Check if a locale uses RTL layout
 */
export function isRTLLocale(locale: SupportedLocale): boolean {
  return RTL_LOCALES.includes(locale);
}

/**
 * Get locale metadata
 */
export function getLocaleMetadata(locale: SupportedLocale): LocaleMetadata {
  return SUPPORTED_LOCALES[locale] || SUPPORTED_LOCALES[DEFAULT_LOCALE];
}

/**
 * Get locale from Accept-Language header
 * Parses header and returns best matching supported locale
 */
export function getLocaleFromHeader(acceptLanguage?: string): SupportedLocale {
  if (!acceptLanguage) {
    return DEFAULT_LOCALE;
  }

  // Parse Accept-Language header
  // Format: "en-US,en;q=0.9,hi;q=0.8"
  const locales = acceptLanguage
    .split(',')
    .map((lang) => {
      const parts = lang.trim().split(';');
      const code = parts[0].split('-')[0]; // Extract language code (ignore region)
      const quality = parts[1] ? parseFloat(parts[1].replace('q=', '')) : 1.0;
      return { code, quality };
    })
    .sort((a, b) => b.quality - a.quality); // Sort by quality

  // Find first supported locale
  for (const { code } of locales) {
    if (isSupportedLocale(code)) {
      return code;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Format currency for locale
 */
export function formatCurrency(
  amountCents: number,
  locale: SupportedLocale,
  currencyDisplay: 'symbol' | 'code' | 'name' = 'symbol'
): string {
  const metadata = getLocaleMetadata(locale);
  const amount = amountCents / 100;

  // Format with thousands separator
  const formatted = amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Apply currency display preference
  switch (currencyDisplay) {
    case 'symbol':
      return `${metadata.currencySymbol} ${formatted}`;
    case 'code':
      return `INR ${formatted}`;
    case 'name':
      return `${formatted} Rupees`;
    default:
      return `${metadata.currencySymbol} ${formatted}`;
  }
}

/**
 * Format date for locale
 */
export function formatDate(
  date: Date,
  locale: SupportedLocale,
  format?: string
): string {
  const metadata = getLocaleMetadata(locale);
  const dateFormat = format || metadata.dateFormat;

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  return dateFormat
    .replace('DD', day)
    .replace('MM', month)
    .replace('YYYY', year.toString());
}

/**
 * Format time for locale
 */
export function formatTime(
  date: Date,
  locale: SupportedLocale,
  timeFormat: '12h' | '24h' = '24h'
): string {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');

  if (timeFormat === '12h') {
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes} ${period}`;
  } else {
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
}

/**
 * Get translated value from translations object
 * Falls back to default value if translation not found
 */
export function getTranslation(
  translations: Record<string, string> | undefined,
  locale: SupportedLocale,
  defaultValue: string
): string {
  if (!translations) {
    return defaultValue;
  }

  return translations[locale] || defaultValue;
}

/**
 * Validation error messages in multiple languages
 */
export const VALIDATION_MESSAGES: Record<
  SupportedLocale,
  Record<string, string>
> = {
  en: {
    required: 'This field is required',
    invalid_email: 'Invalid email address',
    invalid_phone: 'Invalid phone number',
    min_length: 'Minimum length is {min} characters',
    max_length: 'Maximum length is {max} characters',
    invalid_format: 'Invalid format',
  },
  hi: {
    required: 'यह फील्ड आवश्यक है',
    invalid_email: 'अमान्य ईमेल पता',
    invalid_phone: 'अमान्य फोन नंबर',
    min_length: 'न्यूनतम लंबाई {min} अक्षर है',
    max_length: 'अधिकतम लंबाई {max} अक्षर है',
    invalid_format: 'अमान्य प्रारूप',
  },
  ta: {
    required: 'இந்த புலம் தேவையானது',
    invalid_email: 'தவறான மின்னஞ்சல் முகவரி',
    invalid_phone: 'தவறான தொலைபேசி எண்',
    min_length: 'குறைந்தபட்ச நீளம் {min} எழுத்துக்கள்',
    max_length: 'அதிகபட்ச நீளம் {max} எழுத்துக்கள்',
    invalid_format: 'தவறான வடிவம்',
  },
  ar: {
    required: 'هذا الحقل مطلوب',
    invalid_email: 'عنوان بريد إلكتروني غير صالح',
    invalid_phone: 'رقم هاتف غير صالح',
    min_length: 'الحد الأدنى للطول هو {min} حرفًا',
    max_length: 'الحد الأقصى للطول هو {max} حرفًا',
    invalid_format: 'تنسيق غير صالح',
  },
  mr: {
    required: 'हे फील्ड आवश्यक आहे',
    invalid_email: 'अवैध ईमेल पत्ता',
    invalid_phone: 'अवैध फोन नंबर',
    min_length: 'किमान लांबी {min} वर्ण आहे',
    max_length: 'कमाल लांबी {max} वर्ण आहे',
    invalid_format: 'अवैध स्वरूप',
  },
};

/**
 * Get validation message in specific locale
 */
export function getValidationMessage(
  key: string,
  locale: SupportedLocale,
  params?: Record<string, string | number>
): string {
  let message =
    VALIDATION_MESSAGES[locale]?.[key] ||
    VALIDATION_MESSAGES[DEFAULT_LOCALE][key] ||
    key;

  // Replace parameters
  if (params) {
    Object.entries(params).forEach(([param, value]) => {
      message = message.replace(`{${param}}`, value.toString());
    });
  }

  return message;
}
