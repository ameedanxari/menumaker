---
archived_at: 2026-06-20T22:55:01Z
original_path: I18N-GUIDE.md
original_sha256: 77c502b075851790ce5ab9de90ecde0d75c3063ab28b40551d8c00f5394215d7
superseded_by: docs/product/capability-index.md
retention_reason: superseded root/platform guide; replacement identified
---

> Superseded by [docs/product/capability-index.md](../../docs/product/capability-index.md).

# MenuMaker Multi-Language Support Guide

**Phase 3: Multi-Language Support & RTL Layout (US3.3)**
**Version**: 1.0.0
**Last Updated**: 2025-11-15

---

## Overview

MenuMaker supports multiple languages to help sellers reach customers in their native language. Fully support for English, Hindi, Tamil, Arabic, and Marathi with proper RTL (Right-to-Left) layout for Arabic.

### Key Features

✅ **Multi-Language UI**: Support for 5 languages (en, hi, ta, ar, mr)
✅ **RTL Layout**: Proper right-to-left layout for Arabic
✅ **Dish Translations**: Translate dish names and descriptions
✅ **Category Translations**: Translate category names and descriptions
✅ **Locale Detection**: Auto-detect language from Accept-Language header
✅ **Date/Time Formatting**: Locale-specific date and time formats
✅ **Currency Display**: Configurable currency display (symbol, code, name)

---

## Supported Languages

| Code | Language | Native Name | Direction | Status |
|------|----------|-------------|-----------|--------|
| `en` | English | English | LTR | ✅ Default |
| `hi` | Hindi | हिन्दी | LTR | ✅ Supported |
| `ta` | Tamil | தமிழ் | LTR | ✅ Supported |
| `ar` | Arabic | العربية | RTL | ✅ Supported |
| `mr` | Marathi | मराठी | LTR | ✅ Supported (P2) |

---

## Configuration

### 1. Configure Business Locale Settings

**Endpoint**: `PUT /api/v1/i18n/business/:businessId/settings`

**Request**:
```json
{
  "default_locale": "hi",
  "supported_locales": ["en", "hi", "ta"],
  "rtl_enabled": false,
  "date_format": "DD/MM/YYYY",
  "time_format": "12h",
  "currency_display": "symbol"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "settings": {
      "default_locale": "hi",
      "supported_locales": ["en", "hi", "ta"],
      "rtl_enabled": false
    }
  },
  "message": "Locale settings updated successfully"
}
```

**Configuration Options**:

- **`default_locale`**: Default language for seller UI and public menu
  - Values: `en`, `hi`, `ta`, `ar`, `mr`
  - Default: `en`

- **`supported_locales`**: Array of enabled locales for public menu
  - Values: Array of locale codes
  - Example: `["en", "hi", "ta"]`
  - Default: `["en"]`

- **`rtl_enabled`**: Enable RTL layout for Arabic/Hebrew
  - Values: `true` or `false`
  - Default: `false`
  - Auto-enabled when `default_locale` is `ar`

- **`date_format`**: Date format preference
  - Values: `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`
  - Default: `DD/MM/YYYY`

- **`time_format`**: Time format preference
  - Values: `12h` (12:30 PM) or `24h` (12:30)
  - Default: `24h`

- **`currency_display`**: Currency display format
  - Values: `symbol` (₹), `code` (INR), `name` (Rupees)
  - Default: `symbol`

---

## Translation Management

### 2. Add Dish Translations

**Endpoint**: `PUT /api/v1/i18n/dishes/:dishId/translations`

**Request**:
```json
{
  "name": {
    "hi": "पनीर बटर मसाला",
    "ta": "பனீர் பட்டர் மசாலா",
    "ar": "بانير بتر ماسالا"
  },
  "description": {
    "hi": "मलाईदार टमाटर की ग्रेवी में पनीर के टुकड़े",
    "ta": "தக்காளி குழம்பில் பாலாடைக்கட்டி துண்டுகள்",
    "ar": "قطع الجبن في صلصة الطماطم الكريمية"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "dish": {
      "id": "dish-uuid",
      "name": "Paneer Butter Masala",
      "description": "Cottage cheese cubes in creamy tomato gravy",
      "name_translations": {
        "hi": "पनीर बटर मसाला",
        "ta": "பனீர் பட்டர் மசாலா",
        "ar": "بانير بتر ماسالا"
      },
      "description_translations": {
        "hi": "मलाईदार टमाटर की ग्रेवी में पनीर के टुकड़े",
        "ta": "தக்காளி குழம்பில் பாலாடைக்கட்டி துண்டுகள்",
        "ar": "قطع الجبن في صلصة الطماطم الكريمية"
      }
    }
  },
  "message": "Dish translations updated successfully"
}
```

### 3. Add Category Translations

**Endpoint**: `PUT /api/v1/i18n/categories/:categoryId/translations`

**Request**:
```json
{
  "name": {
    "hi": "मुख्य व्यंजन",
    "ta": "முக்கிய உணவுகள்",
    "ar": "الأطباق الرئيسية"
  },
  "description": {
    "hi": "हमारे विशेष मुख्य व्यंजन",
    "ta": "எங்கள் சிறப்பு முக்கிய உணவுகள்",
    "ar": "أطباقنا الرئيسية الخاصة"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "category": {
      "id": "category-uuid",
      "name": "Main Course",
      "description": "Our special main course dishes",
      "name_translations": {
        "hi": "मुख्य व्यंजन",
        "ta": "முக்கிய உணவுகள்",
        "ar": "الأطباق الرئيسية"
      },
      "description_translations": {
        "hi": "हमारे विशेष मुख्य व्यंजन",
        "ta": "எங்கள் சிறப்பு முக்கிய உணவுகள்",
        "ar": "أطباقنا الرئيسية الخاصة"
      }
    }
  },
  "message": "Category translations updated successfully"
}
```

### 4. Delete Translations

**Delete Dish Translation**:
```
DELETE /api/v1/i18n/dishes/:dishId/translations/:locale
```

**Delete Category Translation**:
```
DELETE /api/v1/i18n/categories/:categoryId/translations/:locale
```

**Example**:
```bash
DELETE /api/v1/i18n/dishes/dish-uuid/translations/hi
```

**Response**:
```json
{
  "success": true,
  "message": "Dish translation deleted successfully"
}
```

---

## Fetching Localized Content

### 5. Get Localized Dish

**Endpoint**: `GET /api/v1/i18n/dishes/:dishId?locale=hi`

**Query Parameters**:
- `locale` (optional): Locale code (defaults to Accept-Language header)

**Response**:
```json
{
  "success": true,
  "data": {
    "dish": {
      "id": "dish-uuid",
      "name": "Paneer Butter Masala",
      "description": "Cottage cheese cubes in creamy tomato gravy",
      "price_cents": 30000,
      "name_translations": {
        "hi": "पनीर बटर मसाला"
      },
      "description_translations": {
        "hi": "मलाईदार टमाटर की ग्रेवी में पनीर के टुकड़े"
      }
    },
    "localized": {
      "name": "पनीर बटर मसाला",
      "description": "मलाईदार टमाटर की ग्रेवी में पनीर के टुकड़े"
    }
  }
}
```

### 6. Get Localized Dishes for Business

**Endpoint**: `GET /api/v1/i18n/dishes/business/:businessId?locale=ta`

**Response**:
```json
{
  "success": true,
  "data": {
    "dishes": [
      {
        "dish": {
          "id": "dish-uuid",
          "name": "Paneer Butter Masala",
          "price_cents": 30000
        },
        "localized": {
          "name": "பனீர் பட்டர் மசாலா",
          "description": "தக்காளி குழம்பில் பாலாடைக்கட்டி துண்டுகள்"
        }
      }
    ],
    "locale": "ta"
  }
}
```

### 7. Get Localized Categories for Business

**Endpoint**: `GET /api/v1/i18n/categories/business/:businessId?locale=ar`

**Response**:
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "category": {
          "id": "category-uuid",
          "name": "Main Course"
        },
        "localized": {
          "name": "الأطباق الرئيسية",
          "description": "أطباقنا الرئيسية الخاصة"
        }
      }
    ],
    "locale": "ar"
  }
}
```

---

## RTL (Right-to-Left) Layout

### Arabic Support

When `default_locale` is set to `ar` (Arabic), the UI automatically switches to RTL layout.

**Auto-Enable RTL**:
```json
{
  "default_locale": "ar",
  "rtl_enabled": true  // Auto-enabled for Arabic
}
```

**RTL Layout Considerations**:

1. **Text Direction**: All text flows right-to-left
2. **UI Mirroring**: Navigation, modals, and tables mirror horizontally
3. **Numbers**: Numbers remain LTR (123 not ٣٢١)
4. **Mixed Content**: English text within Arabic content maintains LTR

**Frontend Integration** (React example):
```jsx
import { useEffect } from 'react';

function App() {
  const locale = 'ar';
  const rtlEnabled = true;

  useEffect(() => {
    document.documentElement.dir = rtlEnabled ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale, rtlEnabled]);

  return <div>App content</div>;
}
```

---

## Locale Detection

### Accept-Language Header

The API automatically detects locale from the `Accept-Language` header if not explicitly specified.

**Example**:
```
Accept-Language: hi-IN,hi;q=0.9,en-US;q=0.8,en;q=0.7
```

**Parsed Locale**: `hi` (Hindi)

**Fallback Logic**:
1. Use `?locale=` query parameter if provided
2. Parse `Accept-Language` header
3. Use business `default_locale`
4. Fallback to `en` (English)

---

## Date & Time Formatting

### Date Formats

| Format | Example | Usage |
|--------|---------|-------|
| `DD/MM/YYYY` | 15/11/2025 | India, UK (default) |
| `MM/DD/YYYY` | 11/15/2025 | US |
| `YYYY-MM-DD` | 2025-11-15 | ISO standard |

**Configure**:
```json
{
  "date_format": "DD/MM/YYYY"
}
```

### Time Formats

| Format | Example | Usage |
|--------|---------|-------|
| `24h` | 14:30 | 24-hour format (default) |
| `12h` | 02:30 PM | 12-hour format with AM/PM |

**Configure**:
```json
{
  "time_format": "12h"
}
```

---

## Currency Display

### Display Formats

| Format | Example | Description |
|--------|---------|-------------|
| `symbol` | ₹ 1,000.00 | Currency symbol (default) |
| `code` | INR 1,000.00 | Currency code |
| `name` | 1,000.00 Rupees | Currency name |

**Configure**:
```json
{
  "currency_display": "symbol"
}
```

---

## Validation Messages

Validation error messages are automatically translated based on locale.

**English** (`en`):
- "This field is required"
- "Invalid email address"
- "Minimum length is 3 characters"

**Hindi** (`hi`):
- "यह फील्ड आवश्यक है"
- "अमान्य ईमेल पता"
- "न्यूनतम लंबाई 3 अक्षर है"

**Tamil** (`ta`):
- "இந்த புலம் தேவையானது"
- "தவறான மின்னஞ்சல் முகவரி"
- "குறைந்தபட்ச நீளம் 3 எழுத்துக்கள்"

**Arabic** (`ar`):
- "هذا الحقل مطلوب"
- "عنوان بريد إلكتروني غير صالح"
- "الحد الأدنى للطول هو 3 حرفًا"

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/i18n/locales` | GET | Get supported locales |
| `/i18n/business/:id/settings` | GET | Get business locale settings |
| `/i18n/business/:id/settings` | PUT | Update business locale settings |
| `/i18n/dishes/:id/translations` | PUT | Add/update dish translations |
| `/i18n/categories/:id/translations` | PUT | Add/update category translations |
| `/i18n/dishes/:id/translations/:locale` | DELETE | Delete dish translation |
| `/i18n/categories/:id/translations/:locale` | DELETE | Delete category translation |
| `/i18n/dishes/:id` | GET | Get localized dish |
| `/i18n/dishes/business/:id` | GET | Get localized dishes |
| `/i18n/categories/business/:id` | GET | Get localized categories |

---

## Best Practices

### 1. Translation Workflow

1. **Create Content in Default Language** (English)
   - Add dish with English name and description
   - Get dish ID

2. **Add Translations**
   - Use `PUT /i18n/dishes/:id/translations`
   - Add translations for all supported locales
   - Verify translations with `GET /i18n/dishes/:id?locale=hi`

3. **Test with Different Locales**
   - Test public menu with `?locale=hi`, `?locale=ta`, `?locale=ar`
   - Verify RTL layout for Arabic
   - Check date/time formatting

### 2. Partial Translations

You don't need to translate all fields:
```json
{
  "name": {
    "hi": "पनीर बटर मसाला"
    // Tamil translation missing - will fallback to English
  }
}
```

**Fallback Logic**: Missing translation → Default language (English)

### 3. RTL Testing

When testing Arabic (`ar`) locale:
- Verify UI elements mirror (navigation, buttons)
- Check text alignment (right-aligned)
- Ensure numbers remain LTR
- Test mixed English-Arabic content

### 4. Font Support

Ensure proper font support for:
- **Hindi**: Devanagari script (नागरी)
- **Tamil**: Tamil script (தமிழ் எழுத்து)
- **Arabic**: Arabic script (الأبجدية العربية)

**Recommended Fonts**:
- Noto Sans Devanagari (Hindi)
- Noto Sans Tamil (Tamil)
- Noto Naskh Arabic (Arabic)

---

## Examples

### Example 1: Configure Hindi as Default

```bash
PUT /api/v1/i18n/business/business-uuid/settings

{
  "default_locale": "hi",
  "supported_locales": ["en", "hi", "ta"],
  "date_format": "DD/MM/YYYY",
  "time_format": "12h",
  "currency_display": "symbol"
}
```

### Example 2: Add Multi-Language Dish

```bash
# Step 1: Create dish in English
POST /api/v1/dishes
{
  "name": "Chicken Biryani",
  "description": "Fragrant rice with spiced chicken",
  "price_cents": 25000
}

# Step 2: Add translations
PUT /api/v1/i18n/dishes/dish-uuid/translations
{
  "name": {
    "hi": "चिकन बिरयानी",
    "ta": "சிக்கன் பிரியாணி",
    "ar": "دجاج برياني"
  },
  "description": {
    "hi": "मसालेदार चिकन के साथ सुगंधित चावल",
    "ta": "மசாலா கோழியுடன் நறுமணமுள்ள அரிசி",
    "ar": "أرز عطري مع دجاج متبل"
  }
}
```

### Example 3: Fetch Menu in Tamil

```bash
GET /api/v1/i18n/dishes/business/business-uuid?locale=ta

# Response includes Tamil translations
{
  "dishes": [
    {
      "dish": { "name": "Chicken Biryani" },
      "localized": {
        "name": "சிக்கன் பிரியாணி",
        "description": "மசாலா கோழியுடன் நறுமணமுள்ள அரிசி"
      }
    }
  ]
}
```

---

## Success Metrics

**Target Impact**:
- 🌍 **Language Coverage**: 5 languages (en, hi, ta, ar, mr)
- 📱 **RTL Support**: Full Arabic RTL layout support
- 🎯 **Locale Detection**: Auto-detect from Accept-Language header
- ✅ **Translation Coverage**: 100% of public-facing content translatable

---

## Support

**For i18n Issues**:
- Configure locale: `PUT /api/v1/i18n/business/:id/settings`
- Add translations: `PUT /api/v1/i18n/dishes/:id/translations`
- Fetch localized content: `GET /api/v1/i18n/dishes/:id?locale=hi`

**For RTL Layout**:
- Enable RTL: Set `default_locale` to `ar`
- Frontend: Set `document.documentElement.dir = 'rtl'`

---

**Status**: ✅ Phase 3 - US3.3 Complete
**Languages**: English, Hindi, Tamil, Arabic, Marathi
**RTL**: Arabic support with full UI mirroring
**Auto-Detection**: Accept-Language header parsing
**Formatting**: Locale-specific date/time/currency
