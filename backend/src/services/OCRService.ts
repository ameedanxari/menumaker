import Anthropic from '@anthropic-ai/sdk';
import {
  assertCapabilityEnabled,
  capabilityReadiness,
  getCapability,
} from '../config/capabilities.js';

// Environment variables
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const OCR_ENABLED = process.env.OCR_ENABLED === 'true';
const KNOWN_ALLERGENS = new Set(['dairy', 'nuts', 'gluten', 'shellfish', 'soy', 'eggs']);
const KNOWN_MENU_CATEGORIES = new Set([
  'appetizer',
  'main_course',
  'dessert',
  'beverage',
  'bread',
  'other',
]);
const MENU_CATEGORY_ALIASES = new Map<string, string>([
  ['starter', 'appetizer'],
  ['starters', 'appetizer'],
  ['snack', 'appetizer'],
  ['snacks', 'appetizer'],
  ['main', 'main_course'],
  ['mains', 'main_course'],
  ['main_courses', 'main_course'],
  ['main_dish', 'main_course'],
  ['main_dishes', 'main_course'],
  ['drink', 'beverage'],
  ['drinks', 'beverage'],
  ['beverages', 'beverage'],
  ['sweet', 'dessert'],
  ['sweets', 'dessert'],
  ['desserts', 'dessert'],
  ['breads', 'bread'],
]);
const MAX_OCR_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_OCR_TEXT_BYTES = 50 * 1024;
const MAX_OCR_PRICE_CENTS = 100_000_000;
const MAX_OCR_DISH_NAME_CHARS = 120;
const MAX_OCR_DISH_DESCRIPTION_CHARS = 1000;
const MAX_OCR_PROVIDER_ERROR_CHARS = 1000;
const MIN_PROVIDER_DISH_CONFIDENCE = 50;
const AMBIGUOUS_LOCAL_CATEGORY_HEADER = '__ambiguous_local_category_header__';
const UNSAFE_OCR_TEXT_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;
const OCR_EXTRACTION_OPTION_KEYS = new Set(['enforceCapability']);
const OCR_PROVIDER_DISH_KEYS = new Set([
  'name',
  'description',
  'price_cents',
  'price_text',
  'price',
  'category',
  'allergens',
  'is_vegetarian',
  'is_vegan',
  'is_gluten_free',
  'confidence',
]);
const OCR_PROVIDER_TEXT_BLOCK_KEYS = new Set(['type', 'text']);
const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

// Initialize Anthropic client
let anthropicClient: Anthropic | null = null;

if (OCR_ENABLED && ANTHROPIC_API_KEY) {
  anthropicClient = new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
  });
  console.log('✅ Anthropic Claude Vision API initialized for OCR');
} else {
  console.warn('⚠️  OCR disabled (missing Anthropic API key)');
}

/**
 * Extracted dish structure
 */
export interface ExtractedDish {
  name: string;
  description?: string;
  price_cents: number;
  category?: string;
  allergens?: string[];
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
  confidence: number; // 0-100
}

/**
 * OCR extraction result
 */
export interface OCRResult {
  dishes: ExtractedDish[];
  total_extracted: number;
  extraction_time_ms: number;
  success: boolean;
  error?: string;
  raw_text?: string;
}

interface OCRExtractionOptions {
  enforceCapability?: boolean;
}

/**
 * OCR Service for menu extraction using Claude Vision API
 */
export class OCRService {
  /**
   * Extract menu items from image using Claude Vision
   */
  static async extractFromImage(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg',
    options: OCRExtractionOptions = {}
  ): Promise<OCRResult> {
    const normalizedOptions = this.normalizeExtractionOptions(options);
    this.assertOcrEnabled(normalizedOptions);
    const normalizedMimeType = this.validateImageInput(imageBuffer, mimeType);
    if (!this.isProviderConfigured()) {
      return {
        dishes: [],
        total_extracted: 0,
        extraction_time_ms: 0,
        success: false,
        error: 'OCR not configured. Please set ANTHROPIC_API_KEY.',
      };
    }

    const startTime = Date.now();

    try {
      // Convert buffer to base64
      const base64Image = imageBuffer.toString('base64');

      // Create vision prompt
      const response = await anthropicClient.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: normalizedMimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: this.getImageExtractionPrompt(),
              },
            ],
          },
        ],
      });

      // Extract and validate the provider text response. Treat additional
      // provider blocks as untrusted metadata instead of silently ignoring
      // them while importing menu facts from the first text block.
      const extractedText = this.extractProviderTextResponse(response.content, 'Claude Vision API');

      // Parse JSON response
      const dishes = this.parseExtractedJSON(extractedText);

      const extractionTime = Date.now() - startTime;

      return this.buildProviderExtractionResult(
        dishes,
        extractionTime,
        extractedText,
        'No trusted menu items could be extracted from the OCR provider response.'
      );
    } catch (error: any) {
      const trustedError = this.normalizeProviderFailureMessage(error);
      console.error('❌ OCR extraction failed:', trustedError);

      return {
        dishes: [],
        total_extracted: 0,
        extraction_time_ms: Date.now() - startTime,
        success: false,
        error: trustedError,
      };
    }
  }

  /**
   * Extract menu items from pasted text
   */
  static async extractFromText(
    text: string,
    options: OCRExtractionOptions = {}
  ): Promise<OCRResult> {
    const normalizedOptions = this.normalizeExtractionOptions(options);
    this.assertOcrEnabled(normalizedOptions);
    const normalizedText = this.validateTextInput(text);
    const startTime = Date.now();

    if (!this.isProviderConfigured()) {
      const dishes = this.extractMenuItemsFromPlainText(normalizedText);
      return {
        dishes,
        total_extracted: dishes.length,
        extraction_time_ms: Date.now() - startTime,
        success: dishes.length > 0,
        ...(dishes.length > 0
          ? {}
          : { error: 'No menu items with prices could be extracted from the provided text.' }),
        raw_text: normalizedText,
      };
    }

    try {
      // Create text parsing prompt
      const response = await anthropicClient.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: this.getTextExtractionPrompt(normalizedText),
          },
        ],
      });

      // Extract and validate the provider text response. Treat additional
      // provider blocks as untrusted metadata instead of silently ignoring
      // them while importing menu facts from the first text block.
      const extractedText = this.extractProviderTextResponse(response.content, 'Claude API');

      // Parse JSON response
      const dishes = this.parseExtractedJSON(extractedText);

      const extractionTime = Date.now() - startTime;

      return this.buildProviderExtractionResult(
        dishes,
        extractionTime,
        extractedText,
        'No trusted menu items could be extracted from the OCR provider response.'
      );
    } catch (error: any) {
      const trustedError = this.normalizeProviderFailureMessage(error);
      console.error('❌ Text extraction failed:', trustedError);

      return {
        dishes: [],
        total_extracted: 0,
        extraction_time_ms: Date.now() - startTime,
        success: false,
        error: trustedError,
      };
    }
  }

  /**
   * Extract menu items from plain text without an external AI provider.
   * This intentionally handles conservative, price-bearing menu lines only;
   * uncertain text is skipped instead of fabricating dishes.
   */
  static extractMenuItemsFromPlainText(text: string): ExtractedDish[] {
    const normalizedText = this.validateTextInput(text);
    const candidateDishes: ExtractedDish[] = [];
    let currentCategory = 'other';

    for (const rawLine of normalizedText.split(/\r?\n/)) {
      const line = rawLine.replace(/\s+/g, ' ').trim();
      if (!line) continue;

      const headerCategory = this.detectCategoryHeader(line);
      if (headerCategory) {
        currentCategory = headerCategory;
        continue;
      }

      const price = this.extractPrice(line);
      if (!price) continue;
      if (!this.isValidPriceCents(price.price_cents)) continue;
      if (this.hasMultipleExplicitPriceSignals(line)) continue;
      if (this.hasResidualLocalPriceEvidence(line, price)) continue;

      const itemText = this.cleanMenuItemText(
        `${line.slice(0, price.start)} ${line.slice(price.end)}`
      );
      if (!itemText || itemText.length < 2) continue;
      if (this.isLikelyBareNumberedDishName(itemText, price.price_cents, price.explicitCurrency)) continue;

      const { name, description } = this.splitNameAndDescription(itemText);
      if (!name || /^\d+$/.test(name)) continue;
      if (!this.hasMeaningfulDishName(name)) continue;
      if (!this.hasValidDishTextBounds(name, description)) continue;
      if (this.isLikelyAccountingLine(name, description)) continue;
      if (this.isLikelyVariablePriceLine(line, name, description)) continue;

      const allergens = this.detectAllergens(`${name} ${description || ''}`);
      const dietary = this.detectDietaryFlags(`${name} ${description || ''}`, allergens);
      const category = currentCategory === AMBIGUOUS_LOCAL_CATEGORY_HEADER
        ? 'other'
        : currentCategory === 'other'
        ? this.inferCategory(`${name} ${description || ''}`) || 'other'
        : currentCategory;

      const extractedDish: ExtractedDish = {
        name,
        description,
        price_cents: price.price_cents,
        category,
        allergens,
        ...dietary,
        confidence: this.calculateLocalTextConfidence({
          name,
          description,
          explicitCurrency: price.explicitCurrency,
          category,
          allergens,
        }),
      };
      candidateDishes.push(extractedDish);
    }

    return this.normalizeTrustedLocalDishes(candidateDishes);
  }

  private static normalizeTrustedLocalDishes(dishes: ExtractedDish[]): ExtractedDish[] {
    const pricesByDishIdentity = new Map<string, Set<number>>();
    const dietaryEvidenceByDedupeKey = new Map<string, Set<string>>();
    const allergenEvidenceByDedupeKey = new Map<string, Set<string>>();
    for (const dish of dishes) {
      const identityKey = this.localDishIdentityKey(dish);
      const prices = pricesByDishIdentity.get(identityKey) ?? new Set<number>();
      prices.add(dish.price_cents);
      pricesByDishIdentity.set(identityKey, prices);

      const dedupeKey = this.localDishDedupeKey(dish);
      const dietaryEvidence = dietaryEvidenceByDedupeKey.get(dedupeKey) ?? new Set<string>();
      dietaryEvidence.add(this.providerDishDietaryEvidenceKey(dish));
      dietaryEvidenceByDedupeKey.set(dedupeKey, dietaryEvidence);

      const allergenEvidenceKey = this.providerDishAllergenEvidenceKey(dish);
      if (allergenEvidenceKey !== undefined) {
        const allergenEvidence = allergenEvidenceByDedupeKey.get(dedupeKey) ?? new Set<string>();
        allergenEvidence.add(allergenEvidenceKey);
        allergenEvidenceByDedupeKey.set(dedupeKey, allergenEvidence);
      }
    }
    const ambiguousIdentityKeys = new Set(
      [...pricesByDishIdentity.entries()]
        .filter(([, prices]) => prices.size > 1)
        .map(([identityKey]) => identityKey)
    );
    const ambiguousDedupeKeys = new Set<string>();
    for (const [dedupeKey, dietaryEvidence] of dietaryEvidenceByDedupeKey.entries()) {
      if (dietaryEvidence.size > 1) {
        ambiguousDedupeKeys.add(dedupeKey);
      }
    }
    for (const [dedupeKey, allergenEvidence] of allergenEvidenceByDedupeKey.entries()) {
      if (allergenEvidence.size > 1) {
        ambiguousDedupeKeys.add(dedupeKey);
      }
    }

    const trustedDishesByKey = new Map<string, ExtractedDish>();
    for (const dish of dishes) {
      if (ambiguousIdentityKeys.has(this.localDishIdentityKey(dish))) {
        continue;
      }
      const dedupeKey = this.localDishDedupeKey(dish);
      if (ambiguousDedupeKeys.has(dedupeKey)) {
        continue;
      }
      const existingDish = trustedDishesByKey.get(dedupeKey);
      if (!existingDish || this.isPreferredDuplicateEvidence(dish, existingDish)) {
        trustedDishesByKey.set(dedupeKey, dish);
      }
    }

    return [...trustedDishesByKey.values()];
  }

  private static localDishIdentityKey(dish: ExtractedDish): string {
    return [
      dish.name.toLowerCase().replace(/\s+/g, ' ').trim(),
      (dish.category || 'other').toLowerCase().trim(),
      (dish.description || '').toLowerCase().replace(/\s+/g, ' ').trim(),
    ].join('|');
  }

  private static localDishDedupeKey(dish: ExtractedDish): string {
    return [
      dish.name.toLowerCase().replace(/\s+/g, ' ').trim(),
      (dish.category || 'other').toLowerCase().trim(),
      dish.price_cents,
    ].join('|');
  }

  private static extractPrice(line: string): {
    price_cents: number;
    start: number;
    end: number;
    explicitCurrency: boolean;
  } | null {
    const amountPattern = this.ocrAmountPattern();
    const currencyPrice = this.explicitCurrencyPricePattern();
    const currencyMatch = currencyPrice.exec(line);
    if (currencyMatch?.index !== undefined) {
      const amount = currencyMatch[1] || currencyMatch[2];
      return {
        price_cents: this.majorUnitsToCents(amount),
        start: currencyMatch.index,
        end: currencyMatch.index + currencyMatch[0].length,
        explicitCurrency: true,
      };
    }

    const trailingPrice = new RegExp(String.raw`(?:^|\s)(${amountPattern})\s*$`).exec(line);
    if (!trailingPrice || !/[A-Za-z]/.test(line.slice(0, trailingPrice.index))) {
      return null;
    }

    const amountStart = trailingPrice.index + trailingPrice[0].search(/[0-9]/);
    return {
      price_cents: this.majorUnitsToCents(trailingPrice[1]),
      start: amountStart,
      end: line.length,
      explicitCurrency: false,
    };
  }

  private static ocrAmountPattern(): string {
    return String.raw`(?:[0-9]{1,3}(?:,[0-9]{2})+,[0-9]{3}(?:\.[0-9]{1,2})?|[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:[,.][0-9]{1,2})?)`;
  }

  private static explicitCurrencyPricePattern(global = false): RegExp {
    const amountPattern = this.ocrAmountPattern();
    return new RegExp(
      String.raw`(?:₹|rs\.?|inr|\$)\s*(${amountPattern})|(${amountPattern})\s*(?:₹|rs\.?|inr|\$)(?!\s*[0-9])`,
      global ? 'gi' : 'i'
    );
  }

  private static hasMultipleExplicitPriceSignals(line: string): boolean {
    return (line.match(this.explicitCurrencyPricePattern(true)) || []).length > 1;
  }

  private static hasResidualLocalPriceEvidence(
    line: string,
    trustedPrice: { start: number; end: number }
  ): boolean {
    const residualText = `${line.slice(0, trustedPrice.start)} ${line.slice(trustedPrice.end)}`
      .replace(/\s+/g, ' ')
      .trim();
    if (!residualText) return false;
    if (this.hasExplicitPriceSignal(residualText)) return true;

    const amountPattern = this.ocrAmountPattern();
    const residualAmount = new RegExp(
      String.raw`(?:^|[\s/|,;])${amountPattern}(?=$|[\s/|,;])`
    ).test(residualText);
    if (!residualAmount) return false;
    if (/[\/|;]/.test(residualText) || /\b(?:and|or)\b/i.test(residualText)) return true;

    return new RegExp(
      String.raw`\p{L}[\p{L}\s-]*\s${amountPattern}\s+[\p{L}]`,
      'u'
    ).test(residualText);
  }

  private static hasExplicitPriceSignal(text: string): boolean {
    return this.explicitCurrencyPricePattern().test(text);
  }

  private static hasUntrustedProviderBarePriceEvidence(name: string, description = ''): boolean {
    const text = `${name} ${description}`.replace(/\s+/g, ' ').trim();
    if (!text) return false;

    const amountPattern = this.ocrAmountPattern();
    const bareAmountPattern = new RegExp(
      String.raw`(^|[\s/|,;:()[\]-])(${amountPattern})(?=$|[\s/|,;:()[\]-])`,
      'g'
    );

    for (const match of text.matchAll(bareAmountPattern)) {
      const amountText = match[2];
      const amountStart = (match.index ?? 0) + match[1].length;
      const amountEnd = amountStart + amountText.length;
      const amountCents = this.majorUnitsToCents(amountText);
      if (!this.isValidPriceCents(amountCents) || amountCents < 1000) continue;
      if (this.isProviderNumberedDishToken(text, amountText, amountStart)) continue;
      if (this.isProviderSizeOrQuantityToken(text, amountStart, amountEnd)) continue;
      return true;
    }

    return false;
  }

  private static isProviderNumberedDishToken(
    text: string,
    amountText: string,
    amountStart: number
  ): boolean {
    if (this.majorUnitsToCents(amountText) !== 6500) return false;
    return this.hasKnownNumberedDishBase(text.slice(0, amountStart));
  }

  private static isProviderSizeOrQuantityToken(
    text: string,
    amountStart: number,
    amountEnd: number
  ): boolean {
    const before = text.slice(Math.max(0, amountStart - 20), amountStart).toLowerCase();
    const after = text.slice(amountEnd, amountEnd + 20).toLowerCase();
    const unitAfter = after.match(/^\s*(?:inches|inch|in|cm|mm|oz|ml|l|ltr|litre|liter|kg|g|gm|grams?|pcs?|pieces?|serves?|persons?|people|pax)\b/);
    const unitBefore = before.match(/\b(?:serves?|for|feeds|size)\s*$/);
    return Boolean(unitAfter || unitBefore);
  }

  private static majorUnitsToCents(value: string): number {
    const trimmed = value.trim();
    const hasComma = trimmed.includes(',');
    const hasDot = trimmed.includes('.');
    let normalized = trimmed;

    if (hasComma && hasDot) {
      normalized = trimmed.replace(/,/g, '');
    } else if (hasComma) {
      const usesGroupedThousands =
        /^[0-9]{1,3}(?:,[0-9]{3})+$/.test(trimmed) ||
        /^[0-9]{1,3}(?:,[0-9]{2})+,[0-9]{3}$/.test(trimmed);
      normalized = usesGroupedThousands ? trimmed.replace(/,/g, '') : trimmed.replace(',', '.');
    }

    const amount = Number.parseFloat(normalized);
    if (!Number.isFinite(amount)) return Number.NaN;
    return Math.round(amount * 100);
  }

  private static isValidPriceCents(priceCents: number): boolean {
    return Number.isSafeInteger(priceCents) && priceCents > 0 && priceCents <= MAX_OCR_PRICE_CENTS;
  }

  private static cleanMenuItemText(text: string): string {
    return text
      .replace(/^[\-–—•*\d.)\s]+/, '')
      .replace(/[\-–—:|. ]+$/, '')
      .replace(/\s+[\-–—:|]\s+$/, '')
      .trim();
  }

  private static splitNameAndDescription(text: string): { name: string; description: string } {
    const [namePart, ...descriptionParts] = text.split(/\s+[-–—:|]\s+/);
    return {
      name: this.titleCaseMenuName(namePart.trim()),
      description: descriptionParts.join(' - ').trim(),
    };
  }

  private static titleCaseMenuName(name: string): string {
    if (/[a-z]/.test(name) && /[A-Z]/.test(name)) return name.trim();
    return name
      .toLowerCase()
      .replace(/\b([a-z])/g, (match) => match.toUpperCase())
      .trim();
  }

  private static hasMeaningfulDishName(name: string): boolean {
    const letters = name.match(/\p{L}/gu)?.length ?? 0;
    if (letters < 2) return false;

    const signalChars = name.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
    return signalChars / name.length >= 0.5;
  }

  private static isLikelyBareNumberedDishName(
    itemText: string,
    priceCents: number,
    explicitCurrency: boolean
  ): boolean {
    if (explicitCurrency || priceCents !== 6500) return false;
    return this.hasKnownNumberedDishBase(itemText);
  }

  private static isLikelyProviderNumberedDishPriceEcho(name: string, priceCents: number): boolean {
    if (priceCents !== 6500) return false;
    const match = /\b65\s*$/i.exec(name);
    if (!match) return false;
    return this.hasKnownNumberedDishBase(name.slice(0, match.index));
  }

  private static hasKnownNumberedDishBase(value: string): boolean {
    const normalized = value
      .toLowerCase()
      .replace(/[^\p{L}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return [
      /\bchicken\b/,
      /\bgobi\b/,
      /\bgobhi\b/,
      /\bcauliflower\b/,
      /\bpaneer\b/,
      /\bmushroom\b/,
      /\bfish\b/,
      /\bprawn\b/,
      /\bveg\b/,
      /\bvegetable\b/,
    ].some((pattern) => pattern.test(normalized));
  }

  private static calculateLocalTextConfidence(input: {
    name: string;
    description: string;
    explicitCurrency: boolean;
    category: string;
    allergens: string[];
  }): number {
    let confidence = input.explicitCurrency ? 78 : 66;
    if (input.description) confidence += 5;
    if (input.category !== 'other') confidence += 5;
    if (input.allergens.length > 0) confidence += 2;
    if (input.name.length <= 3) confidence -= 6;

    return Math.max(50, Math.min(92, confidence));
  }

  private static detectCategoryHeader(line: string): string | null {
    if (this.extractPrice(line)) return null;
    const normalized = line.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    if (!normalized || normalized.split(/\s+/).length > 4) return null;
    return this.inferCategory(normalized, true);
  }

  private static inferCategory(text: string, headerOnly = false): string | null {
    const normalized = text.toLowerCase();
    const matches = (terms: string[]) => terms.some((term) => normalized.includes(term));
    const matchedCategories: string[] = [];

    if (matches(['starter', 'appetizer', 'snack', 'chaat'])) matchedCategories.push('appetizer');
    if (matches(['main', 'curry', 'biryani', 'rice', 'noodle', 'pasta', 'pizza', 'burger', 'dosa'])) {
      matchedCategories.push('main_course');
    }
    if (matches(['dessert', 'sweet', 'cake', 'ice cream', 'kulfi'])) matchedCategories.push('dessert');
    if (matches(['drink', 'beverage', 'tea', 'coffee', 'chai', 'juice', 'lassi', 'soda'])) {
      matchedCategories.push('beverage');
    }
    if (matches(['bread', 'roti', 'naan', 'paratha'])) matchedCategories.push('bread');
    if (headerOnly && new Set(matchedCategories).size > 1) return AMBIGUOUS_LOCAL_CATEGORY_HEADER;
    if (matchedCategories.length > 0) return matchedCategories[0];
    return headerOnly ? null : 'other';
  }

  private static detectAllergens(text: string): string[] {
    const normalized = text.toLowerCase();
    const allergenTerms: Record<string, RegExp[]> = {
      dairy: [
        /\bmilk\b/,
        /\bcheese\b/,
        /\bpaneer\b/,
        /\bghee\b/,
        /\bcream\b/,
        /\bbutter\b/,
        /\bcurd\b/,
        /\byogurt\b/,
        /\byoghurt\b/,
        /\blassi\b/,
      ],
      nuts: [
        /\bpeanut(s)?\b/,
        /\balmond(s)?\b/,
        /\bcashew(s)?\b/,
        /\bwalnut(s)?\b/,
        /\bpistachio(s)?\b/,
      ],
      gluten: [
        /\bwheat\b/,
        /\bflour\b/,
        /\bmaida\b/,
        /\bbread\b/,
        /\broti\b/,
        /\bchapati\b/,
        /\bparatha\b/,
        /\bnaan\b/,
        /\bpoori\b/,
        /\bpuri\b/,
        /\bkulcha\b/,
        /\bpasta\b/,
        /\bnoodle(s)?\b/,
      ],
      shellfish: [
        /\bprawn(s)?\b/,
        /\bshrimp\b/,
        /\bcrab\b/,
        /\blobster\b/,
      ],
      soy: [/\bsoy\b/, /\btofu\b/],
      eggs: [/\begg(s)?\b/, /\bomelette\b/],
    };

    return Object.entries(allergenTerms)
      .filter(([, terms]) => terms.some((term) => term.test(normalized)))
      .map(([allergen]) => allergen);
  }

  private static detectDietaryFlags(
    text: string,
    allergens: string[]
  ): Pick<ExtractedDish, 'is_vegetarian' | 'is_vegan' | 'is_gluten_free'> {
    const normalized = text.toLowerCase();
    const vegetarian = !this.hasAnimalProductTerms(normalized);
    const vegan = vegetarian && !allergens.includes('dairy') && !allergens.includes('eggs');

    return {
      is_vegetarian: vegetarian,
      is_vegan: vegan,
      is_gluten_free: !allergens.includes('gluten'),
    };
  }

  /**
   * Get prompt for image extraction
   */
  private static getImageExtractionPrompt(): string {
    return `You are a menu extraction assistant. Analyze this restaurant menu image and extract priced menu dishes/items with their details.

For each dish, extract:
- name (required)
- description (if available)
- price (required, convert to Indian Rupees cents - multiply by 100)
- category (appetizer, main course, dessert, beverage, etc.)
- allergens (list any: dairy, nuts, gluten, shellfish, soy, eggs, etc.)
- is_vegetarian (true/false, based on ingredients)
- is_vegan (true/false, based on ingredients)
- is_gluten_free (true/false, based on ingredients)
- confidence (0-100, your confidence in the extraction)

**IMPORTANT PRICE PARSING**:
- If price is "Rs. 50" or "₹50" → price_cents = 5000
- If price is "Rs. 12.50" or "₹12.50" → price_cents = 1250
- If price is "$5.99" → price_cents = 599 (assume USD converted to cents)
- If no positive price is visible, omit that row entirely. Do not emit price_cents = 0.
- Omit receipt/accounting rows such as subtotal, GST, service charge, delivery charge, discount, and grand total.

**CATEGORY DETECTION**:
- Look for section headers like "Starters", "Main Course", "Desserts", "Beverages"
- If no category visible, infer from dish name/description

**ALLERGEN DETECTION**:
- Scan description for: milk, cheese, cream, butter (dairy)
- paneer, curd, ghee (dairy)
- peanuts, almonds, cashews (nuts)
- wheat, bread, roti (gluten)
- prawns, fish, crab (shellfish)

Return ONLY a valid JSON array of dishes, no other text:

[
  {
    "name": "Paneer Tikka",
    "description": "Grilled cottage cheese with spices",
    "price_cents": 25000,
    "category": "appetizer",
    "allergens": ["dairy", "gluten"],
    "is_vegetarian": true,
    "is_vegan": false,
    "is_gluten_free": false,
    "confidence": 95
  },
  {
    "name": "Masala Dosa",
    "description": "Crispy rice crepe with potato filling",
    "price_cents": 8000,
    "category": "main_course",
    "allergens": [],
    "is_vegetarian": true,
    "is_vegan": true,
    "is_gluten_free": true,
    "confidence": 98
  }
]

Extract ALL visible priced menu items. Return valid JSON only.`;
  }

  /**
   * Get prompt for text extraction
   */
  private static getTextExtractionPrompt(menuText: string): string {
    return `You are a menu extraction assistant. Parse this menu text and extract priced menu dishes/items.

Menu Text:
"""
${menuText}
"""

For each dish, extract:
- name (required)
- description (if available)
- price (required, convert to cents - multiply rupees by 100)
- category (appetizer, main course, dessert, beverage, etc.)
- allergens (dairy, nuts, gluten, shellfish, soy, eggs, etc.)
- is_vegetarian (true/false)
- is_vegan (true/false)
- is_gluten_free (true/false)
- confidence (0-100)

**PRICE PARSING**:
- "Rs. 50" or "₹50" → 5000 cents
- "Rs. 12.50" → 1250 cents
- Handle formats: "50 Rs", "Rs 50", "₹ 50", etc.
- If no positive price is visible, omit that row entirely. Do not emit price_cents = 0.
- Omit receipt/accounting rows such as subtotal, GST, service charge, delivery charge, discount, and grand total.

**ALLERGEN DETECTION**:
- dairy: milk, cheese, paneer, ghee, cream, butter, curd
- nuts: peanuts, almonds, cashews, walnuts
- gluten: wheat, bread, roti, paratha
- shellfish: prawns, fish, crab

Return ONLY a valid JSON array:

[
  {
    "name": "Samosa",
    "description": "Fried pastry with potato filling",
    "price_cents": 2000,
    "category": "appetizer",
    "allergens": ["gluten"],
    "is_vegetarian": true,
    "is_vegan": true,
    "is_gluten_free": false,
    "confidence": 90
  }
]

Extract ALL priced menu items. Return valid JSON only.`;
  }

  /**
   * Parse extracted JSON from Claude response
   */
  private static parseExtractedJSON(extractedText: string): ExtractedDish[] {
    try {
      if (Buffer.byteLength(extractedText, 'utf8') > MAX_OCR_TEXT_BYTES) {
        console.error('Provider OCR response exceeded the 50KB parse limit');
        return [];
      }

      // Try to find the first valid JSON array in the response. Provider
      // wrappers may include harmless bracketed prose before or after the
      // actual menu payload, so avoid a greedy first-`[` to last-`]` slice.
      const dishArrays = this.extractJsonArrays(extractedText);
      if (!dishArrays.length) {
        console.error('No JSON array found in response');
        return [];
      }

      // Validate and clean dishes. Provider output is treated as untrusted:
      // malformed money/confidence values are skipped instead of rounded into
      // plausible production menu data.
      for (const dishes of dishArrays) {
        const trustedDishes = this.normalizeTrustedProviderDishes(dishes);
        if (trustedDishes.length > 0) {
          return trustedDishes;
        }
      }

      return [];
    } catch (error: any) {
      console.error('Failed to parse extracted JSON:', error.message);
      return [];
    }
  }

  private static extractJsonArrays(extractedText: string): unknown[][] {
    const arrays: unknown[][] = [];
    for (let start = extractedText.indexOf('['); start !== -1; start = extractedText.indexOf('[', start + 1)) {
      let depth = 0;
      let inString = false;
      let escaped = false;

      for (let cursor = start; cursor < extractedText.length; cursor++) {
        const char = extractedText[cursor];

        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (char === '\\') {
            escaped = true;
          } else if (char === '"') {
            inString = false;
          }
          continue;
        }

        if (char === '"') {
          inString = true;
          continue;
        }
        if (char === '[') {
          depth++;
          continue;
        }
        if (char !== ']') continue;

        depth--;
        if (depth !== 0) continue;

        const candidate = extractedText.slice(start, cursor + 1);
        try {
          const parsed = JSON.parse(candidate) as unknown;
          if (Array.isArray(parsed)) {
            arrays.push(parsed);
          }
        } catch {
          break;
        }
      }
    }

    return arrays;
  }

  private static extractProviderTextResponse(content: unknown, providerLabel: string): string {
    if (!Array.isArray(content)) {
      throw new Error(`${providerLabel} response content must be an array`);
    }

    const textBlocks: string[] = [];
    const unsupportedBlockTypes = new Set<string>();

    content.forEach((block, index) => {
      if (!this.isRecord(block)) {
        unsupportedBlockTypes.add(`non_object_${index + 1}`);
        return;
      }

      if (block.type !== 'text') {
        if (typeof block.type === 'string' && this.hasUnsafeProviderTextControls(block.type)) {
          throw new Error(`${providerLabel} response content block type must not include unsafe control characters`);
        }
        unsupportedBlockTypes.add(
          typeof block.type === 'string' && block.type.trim()
            ? block.type.trim()
            : `unknown_${index + 1}`
        );
        return;
      }

      const blockKeys = Object.keys(block);
      this.assertProviderFieldNamesAreSafe(`${providerLabel} response text block`, blockKeys);
      const unsupportedKeys = blockKeys.filter((key) => !OCR_PROVIDER_TEXT_BLOCK_KEYS.has(key));
      if (unsupportedKeys.length > 0) {
        throw new Error(
          `${providerLabel} response text block includes unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
        );
      }

      if (typeof block.text !== 'string') {
        throw new Error(`${providerLabel} response text must be a string`);
      }
      textBlocks.push(block.text);
    });

    if (unsupportedBlockTypes.size > 0) {
      throw new Error(
        `${providerLabel} response includes unsupported content block type(s): ${[...unsupportedBlockTypes].sort().join(', ')}`
      );
    }
    if (textBlocks.length !== 1) {
      throw new Error(`${providerLabel} response must include exactly one text block`);
    }

    const providerText = textBlocks[0];
    if (this.hasUnsafeProviderTextControls(providerText)) {
      throw new Error(`${providerLabel} response text must not include unsafe control characters`);
    }

    const normalizedText = providerText.trim();
    if (!normalizedText) {
      throw new Error(`${providerLabel} response text must be a non-empty string`);
    }
    if (Buffer.byteLength(normalizedText, 'utf8') > MAX_OCR_TEXT_BYTES) {
      throw new Error(`${providerLabel} response text exceeds the 50KB size limit`);
    }

    return normalizedText;
  }

  private static normalizeTrustedProviderDishes(dishes: unknown[]): ExtractedDish[] {
    this.assertProviderDishArrayEnvelope(dishes);
    const normalizedDishes = dishes
      .map((dish) => this.normalizeExtractedDish(dish))
      .filter((dish): dish is ExtractedDish => dish !== null);
    const pricesByDishIdentity = new Map<string, Set<number>>();
    const dietaryEvidenceByDishIdentity = new Map<string, Set<string>>();
    const allergenEvidenceByDishIdentity = new Map<string, Set<string>>();
    const dietaryEvidenceByDedupeKey = new Map<string, Set<string>>();
    const allergenEvidenceByDedupeKey = new Map<string, Set<string>>();
    const categoryEvidenceByDishIdentity = new Map<string, Set<string>>();
    const unsupportedAllergenEvidenceIdentityKeys = new Set<string>();
    for (const dish of normalizedDishes) {
      const identityKey = this.providerDishIdentityKey(dish);
      const prices = pricesByDishIdentity.get(identityKey) ?? new Set<number>();
      prices.add(dish.price_cents);
      pricesByDishIdentity.set(identityKey, prices);

      const categoryIdentityKey = this.providerDishCategoryIdentityKey(dish);
      const categoryEvidence = categoryEvidenceByDishIdentity.get(categoryIdentityKey) ?? new Set<string>();
      categoryEvidence.add((dish.category || 'other').toLowerCase().trim());
      categoryEvidenceByDishIdentity.set(categoryIdentityKey, categoryEvidence);

      const dietaryEvidence = dietaryEvidenceByDishIdentity.get(identityKey) ?? new Set<string>();
      const dietaryEvidenceKey = this.providerDishDietaryEvidenceKey(dish);
      dietaryEvidence.add(dietaryEvidenceKey);
      dietaryEvidenceByDishIdentity.set(identityKey, dietaryEvidence);

      const dedupeKey = this.localDishDedupeKey(dish);
      const dedupeDietaryEvidence = dietaryEvidenceByDedupeKey.get(dedupeKey) ?? new Set<string>();
      dedupeDietaryEvidence.add(dietaryEvidenceKey);
      dietaryEvidenceByDedupeKey.set(dedupeKey, dedupeDietaryEvidence);

      const allergenEvidenceKey = this.providerDishAllergenEvidenceKey(dish);
      if (allergenEvidenceKey !== undefined) {
        const allergenEvidence = allergenEvidenceByDishIdentity.get(identityKey) ?? new Set<string>();
        allergenEvidence.add(allergenEvidenceKey);
        allergenEvidenceByDishIdentity.set(identityKey, allergenEvidence);

        const dedupeAllergenEvidence = allergenEvidenceByDedupeKey.get(dedupeKey) ?? new Set<string>();
        dedupeAllergenEvidence.add(allergenEvidenceKey);
        allergenEvidenceByDedupeKey.set(dedupeKey, dedupeAllergenEvidence);
      }
      if (!this.hasSupportedProviderAllergenEvidence(dish)) {
        unsupportedAllergenEvidenceIdentityKeys.add(identityKey);
      }
    }
    const ambiguousIdentityKeys = new Set(
      [...pricesByDishIdentity.entries()]
        .filter(([, prices]) => prices.size > 1)
        .map(([identityKey]) => identityKey)
    );
    for (const identityKey of unsupportedAllergenEvidenceIdentityKeys) {
      ambiguousIdentityKeys.add(identityKey);
    }
    for (const [identityKey, dietaryEvidence] of dietaryEvidenceByDishIdentity.entries()) {
      if (dietaryEvidence.size > 1) {
        ambiguousIdentityKeys.add(identityKey);
      }
    }
    for (const [identityKey, allergenEvidence] of allergenEvidenceByDishIdentity.entries()) {
      if (allergenEvidence.size > 1) {
        ambiguousIdentityKeys.add(identityKey);
      }
    }
    const ambiguousCategoryIdentityKeys = new Set(
      [...categoryEvidenceByDishIdentity.entries()]
        .filter(([, categoryEvidence]) => categoryEvidence.size > 1)
        .map(([identityKey]) => identityKey)
    );
    const ambiguousDedupeKeys = new Set<string>();
    for (const [dedupeKey, dietaryEvidence] of dietaryEvidenceByDedupeKey.entries()) {
      if (dietaryEvidence.size > 1) {
        ambiguousDedupeKeys.add(dedupeKey);
      }
    }
    for (const [dedupeKey, allergenEvidence] of allergenEvidenceByDedupeKey.entries()) {
      if (allergenEvidence.size > 1) {
        ambiguousDedupeKeys.add(dedupeKey);
      }
    }

    const trustedDishesByKey = new Map<string, ExtractedDish>();
    for (const dish of normalizedDishes) {
      if (ambiguousIdentityKeys.has(this.providerDishIdentityKey(dish))) {
        continue;
      }
      if (ambiguousCategoryIdentityKeys.has(this.providerDishCategoryIdentityKey(dish))) {
        continue;
      }
      const dedupeKey = this.localDishDedupeKey(dish);
      if (ambiguousDedupeKeys.has(dedupeKey)) {
        continue;
      }
      const existingDish = trustedDishesByKey.get(dedupeKey);
      if (!existingDish || this.isPreferredDuplicateEvidence(dish, existingDish)) {
        trustedDishesByKey.set(dedupeKey, dish);
      }
    }

    return [...trustedDishesByKey.values()];
  }

  private static assertProviderDishArrayEnvelope(dishes: unknown[]): void {
    const containsDishRowCandidate = dishes.some((dish) => this.isRecord(dish));
    if (!containsDishRowCandidate) return;

    dishes.forEach((dish, index) => {
      if (!this.isRecord(dish)) {
        throw new Error(`OCR provider dish row ${index + 1} must be an object`);
      }
      const dishKeys = Object.keys(dish);
      this.assertProviderFieldNamesAreSafe(`OCR provider dish row ${index + 1}`, dishKeys);
      const unsupportedKeys = dishKeys.filter((key) => !OCR_PROVIDER_DISH_KEYS.has(key));
      if (unsupportedKeys.length > 0) {
        throw new Error(
          `OCR provider dish row ${index + 1} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
        );
      }
    });
  }

  private static providerDishIdentityKey(dish: ExtractedDish): string {
    return [
      dish.name.toLowerCase().replace(/\s+/g, ' ').trim(),
      (dish.category || 'other').toLowerCase().trim(),
      (dish.description || '').toLowerCase().replace(/\s+/g, ' ').trim(),
    ].join('|');
  }

  private static providerDishCategoryIdentityKey(dish: ExtractedDish): string {
    return [
      dish.name.toLowerCase().replace(/\s+/g, ' ').trim(),
      (dish.description || '').toLowerCase().replace(/\s+/g, ' ').trim(),
      dish.price_cents,
    ].join('|');
  }

  private static providerDishDietaryEvidenceKey(dish: ExtractedDish): string {
    return [
      dish.is_vegetarian ? 'vegetarian' : 'non_vegetarian',
      dish.is_vegan ? 'vegan' : 'non_vegan',
      dish.is_gluten_free ? 'gluten_free' : 'contains_or_unknown_gluten',
    ].join('|');
  }

  private static providerDishAllergenEvidenceKey(dish: ExtractedDish): string | undefined {
    if (!dish.allergens?.length) {
      return undefined;
    }
    return [...dish.allergens].sort().join('|');
  }

  private static hasSupportedProviderAllergenEvidence(dish: ExtractedDish): boolean {
    if (!dish.allergens?.length) return true;

    const detectedAllergens = new Set(
      this.detectAllergens(`${dish.name} ${dish.description || ''}`)
    );
    return dish.allergens.every((allergen) => detectedAllergens.has(allergen));
  }

  private static buildProviderExtractionResult(
    dishes: ExtractedDish[],
    extractionTimeMs: number,
    rawText: string,
    emptyError: string
  ): OCRResult {
    const trustedDishes = this.normalizeTrustedProviderDishes(dishes);
    const boundedRawText = this.normalizeProviderRawText(rawText);
    const boundedExtractionTimeMs = this.normalizeExtractionTimeMs(
      'OCR provider extraction_time_ms',
      extractionTimeMs
    );
    return {
      dishes: trustedDishes,
      total_extracted: trustedDishes.length,
      extraction_time_ms: boundedExtractionTimeMs,
      success: trustedDishes.length > 0,
      ...(trustedDishes.length > 0 ? {} : { error: emptyError }),
      ...(boundedRawText === undefined ? {} : { raw_text: boundedRawText }),
    };
  }

  private static normalizeExtractionTimeMs(label: string, value: number): number {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${label} must be a non-negative safe integer`);
    }
    return value;
  }

  private static normalizeProviderRawText(rawText: string): string | undefined {
    if (this.hasUnsafeProviderTextControls(rawText)) {
      return undefined;
    }
    const normalizedRawText = rawText.trim();
    if (!normalizedRawText) {
      return undefined;
    }
    if (Buffer.byteLength(normalizedRawText, 'utf8') > MAX_OCR_TEXT_BYTES) {
      return undefined;
    }
    return normalizedRawText;
  }

  private static normalizeProviderFailureMessage(error: unknown): string {
    const fallback = 'OCR provider request failed';
    const message = error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : fallback;
    if (this.hasUnsafeProviderTextControls(message)) {
      return fallback;
    }
    const normalizedMessage = message.trim();
    if (!normalizedMessage) {
      return fallback;
    }
    return normalizedMessage.slice(0, MAX_OCR_PROVIDER_ERROR_CHARS);
  }

  private static isPreferredDuplicateEvidence(
    candidate: ExtractedDish,
    existing: ExtractedDish
  ): boolean {
    const candidateEvidenceScore = this.extractionEvidenceScore(candidate);
    const existingEvidenceScore = this.extractionEvidenceScore(existing);
    if (candidateEvidenceScore !== existingEvidenceScore) {
      return candidateEvidenceScore > existingEvidenceScore;
    }
    if (candidate.confidence !== existing.confidence) {
      return candidate.confidence > existing.confidence;
    }
    const candidateDescriptionLength = candidate.description?.length ?? 0;
    const existingDescriptionLength = existing.description?.length ?? 0;
    if (candidateDescriptionLength !== existingDescriptionLength) {
      return candidateDescriptionLength > existingDescriptionLength;
    }
    return false;
  }

  private static extractionEvidenceScore(dish: ExtractedDish): number {
    let score = 0;
    score += dish.allergens?.length ?? 0;
    if (dish.is_vegetarian === true) score += 1;
    if (dish.is_vegan === true) score += 1;
    if (dish.is_gluten_free === true) score += 1;
    return score;
  }

  private static normalizeExtractedDish(dish: unknown): ExtractedDish | null {
    if (!this.isRecord(dish)) return null;
    if (Object.keys(dish).some((key) => !OCR_PROVIDER_DISH_KEYS.has(key))) {
      return null;
    }

    const name = this.normalizeProviderDishName(dish.name);
    const priceCents = typeof dish.price_cents === 'number' ? dish.price_cents : Number.NaN;
    const confidence = typeof dish.confidence === 'number' ? dish.confidence : Number.NaN;
    if (!name) return null;
    if (!this.isValidPriceCents(priceCents)) return null;
    if (!this.hasConsistentProviderPriceEvidence(dish, priceCents)) return null;
    if (this.isLikelyProviderNumberedDishPriceEcho(name, priceCents)) return null;
    if (!Number.isSafeInteger(confidence) || confidence < 0 || confidence > 100) return null;
    if (confidence < MIN_PROVIDER_DISH_CONFIDENCE) return null;
    const allergens = this.normalizeProviderAllergens(dish.allergens);
    if (!allergens) return null;
    const description = this.normalizeOptionalProviderText(dish.description, '');
    const category = this.normalizeProviderCategory(dish.category);
    if (description === null || category === null) return null;
    if (this.hasExplicitPriceSignal(`${name} ${description}`)) return null;
    if (this.hasUntrustedProviderBarePriceEvidence(name, description)) return null;
    if (this.isLikelyAccountingLine(name, description)) return null;
    if (this.isLikelyVariablePriceLine(`${name} ${description}`, name, description)) return null;
    if (
      !this.isBoolean(dish.is_vegetarian) ||
      !this.isBoolean(dish.is_vegan) ||
      !this.isBoolean(dish.is_gluten_free)
    ) {
      return null;
    }
    if (!this.hasConsistentDietaryFlags({
      text: `${name} ${description}`,
      allergens,
      is_vegetarian: dish.is_vegetarian,
      is_vegan: dish.is_vegan,
      is_gluten_free: dish.is_gluten_free,
    })) {
      return null;
    }

    return {
      name,
      ...(description ? { description } : {}),
      price_cents: priceCents,
      category,
      allergens,
      is_vegetarian: dish.is_vegetarian,
      is_vegan: dish.is_vegan,
      is_gluten_free: dish.is_gluten_free,
      confidence,
    };
  }

  private static hasConsistentProviderPriceEvidence(
    dish: Record<string, unknown>,
    priceCents: number
  ): boolean {
    for (const fieldName of ['price_text', 'price']) {
      if (dish[fieldName] === undefined || dish[fieldName] === null) continue;
      if (typeof dish[fieldName] !== 'string') return false;
      if (this.hasUnsafeProviderTextControls(dish[fieldName])) return false;

      const priceText = this.normalizeProviderText(dish[fieldName]);
      if (!priceText || this.hasMultipleExplicitPriceSignals(priceText)) return false;

      const parsedPrice = this.extractPrice(priceText);
      if (!parsedPrice || !this.isValidPriceCents(parsedPrice.price_cents)) return false;
      if (parsedPrice.price_cents !== priceCents) return false;
    }

    return true;
  }

  private static normalizeProviderDishName(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    if (this.hasUnsafeProviderTextControls(value)) return null;
    const name = this.normalizeProviderText(value);
    if (!name || name.length > MAX_OCR_DISH_NAME_CHARS) return null;
    if (/^\d+$/.test(name)) return null;
    if (!this.hasMeaningfulDishName(name)) return null;
    return name;
  }

  private static normalizeProviderAllergens(value: unknown): string[] | null {
    if (value === undefined) return [];
    if (!Array.isArray(value)) return null;

    const normalized: string[] = [];
    for (const allergen of value) {
      if (typeof allergen !== 'string') return null;
      if (this.hasUnsafeProviderTextControls(allergen)) return null;
      const label = allergen.trim().toLowerCase();
      if (!KNOWN_ALLERGENS.has(label)) return null;
      if (!normalized.includes(label)) {
        normalized.push(label);
      }
    }

    return normalized;
  }

  private static normalizeOptionalProviderText(value: unknown, fallback: string): string | null {
    if (value === undefined) return fallback;
    if (typeof value !== 'string') return null;
    if (this.hasUnsafeProviderTextControls(value)) return null;
    const text = this.normalizeProviderText(value);
    return text.length <= MAX_OCR_DISH_DESCRIPTION_CHARS ? text : null;
  }

  private static normalizeProviderText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private static hasUnsafeProviderTextControls(value: string): boolean {
    return UNSAFE_OCR_TEXT_CONTROLS.test(value);
  }

  private static assertProviderFieldNamesAreSafe(label: string, fieldNames: string[]): void {
    if (fieldNames.some((fieldName) => this.hasUnsafeProviderTextControls(fieldName))) {
      throw new Error(`${label} field names must not include unsafe control characters`);
    }
  }

  private static hasValidDishTextBounds(name: string, description?: string): boolean {
    return (
      name.length <= MAX_OCR_DISH_NAME_CHARS &&
      (description || '').length <= MAX_OCR_DISH_DESCRIPTION_CHARS
    );
  }

  private static isLikelyAccountingLine(name: string, description = ''): boolean {
    const normalized = `${name} ${description}`
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return false;

    return [
      /^sub\s*total\b/,
      /^subtotal\b/,
      /^grand\s+total\b/,
      /^total\b/,
      /^net\s+amount\b/,
      /^bill\s+amount\b/,
      /^amount\s+due\b/,
      /^balance\s+due\b/,
      /^gst\b/,
      /^cgst\b/,
      /^sgst\b/,
      /^igst\b/,
      /^vat\b/,
      /^tax\b/,
      /^service\s+charge\b/,
      /^packing\s+charge\b/,
      /^packaging\s+charge\b/,
      /^delivery\s+charge\b/,
      /^convenience\s+fee\b/,
      /^discount\b/,
      /^round\s+off\b/,
    ].some((pattern) => pattern.test(normalized));
  }

  private static isLikelyVariablePriceLine(line: string, name: string, description = ''): boolean {
    const normalized = `${line} ${name} ${description}`
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return false;

    return [
      /\bmarket\s+price\b/,
      /\bmkt\s+price\b/,
      /\bseasonal\s+price\b/,
      /\bpriced\s+daily\b/,
      /\bprice\s+varies\b/,
      /\bask\s+(?:your\s+)?server\b/,
      /\bask\s+staff\b/,
      /\bask\s+for\s+price\b/,
      /\bmp\b/,
      /(?:^|\s)m\.p\.(?:\s|$)/,
    ].some((pattern) => pattern.test(normalized));
  }

  private static normalizeProviderCategory(value: unknown): string | null {
    if (value === undefined) return 'other';
    if (typeof value !== 'string') return null;
    if (this.hasUnsafeProviderTextControls(value)) return null;

    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');

    if (!normalized) return 'other';
    const canonicalCategory = MENU_CATEGORY_ALIASES.get(normalized) ?? normalized;
    return KNOWN_MENU_CATEGORIES.has(canonicalCategory) ? canonicalCategory : null;
  }

  private static hasConsistentDietaryFlags(input: Pick<
    ExtractedDish,
    'allergens' | 'is_vegetarian' | 'is_vegan' | 'is_gluten_free'
  > & { text?: string }): boolean {
    const text = input.text || '';
    if (input.is_vegan && !input.is_vegetarian) return false;
    if (
      input.is_gluten_free &&
      (input.allergens?.includes('gluten') || this.hasGlutenProductTerms(text))
    ) {
      return false;
    }
    if (
      input.is_vegetarian &&
      (this.hasAnimalProductTerms(text) || input.allergens?.some((allergen) => ['eggs', 'shellfish'].includes(allergen)))
    ) {
      return false;
    }
    if (
      input.is_vegan &&
      (
        input.allergens?.some((allergen) => ['dairy', 'eggs', 'shellfish'].includes(allergen)) ||
        this.hasVeganContradictingTerms(text)
      )
    ) {
      return false;
    }
    return true;
  }

  private static hasGlutenProductTerms(text: string): boolean {
    const normalized = text.toLowerCase();
    return [
      /\bwheat\b/,
      /\bflour\b/,
      /\bmaida\b/,
      /\bbread\b/,
      /\broti\b/,
      /\bchapati\b/,
      /\bparatha\b/,
      /\bnaan\b/,
      /\bpoori\b/,
      /\bpuri\b/,
      /\bkulcha\b/,
    ].some((pattern) => pattern.test(normalized));
  }

  private static hasVeganContradictingTerms(text: string): boolean {
    const normalized = text.toLowerCase();
    return this.hasAnimalProductTerms(normalized) || [
      /\bmilk\b/,
      /\bcheese\b/,
      /\bpaneer\b/,
      /\bghee\b/,
      /\bcream\b/,
      /\bbutter\b/,
      /\bcurd\b/,
      /\byogurt\b/,
      /\byoghurt\b/,
    ].some((pattern) => pattern.test(normalized));
  }

  private static hasAnimalProductTerms(text: string): boolean {
    const normalized = text.toLowerCase();
    return [
      /\bchicken\b/,
      /\bmutton\b/,
      /\blamb\b/,
      /\bbeef\b/,
      /\bpork\b/,
      /\bfish\b/,
      /\bprawn(s)?\b/,
      /\bshrimp\b/,
      /\bcrab\b/,
      /\blobster\b/,
      /\begg(s)?\b/,
      /\bomelette\b/,
    ].some((pattern) => pattern.test(normalized));
  }

  private static isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private static validateImageInput(imageBuffer: Buffer, mimeType: string): string {
    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      throw new Error('OCR image must be a non-empty Buffer');
    }
    if (imageBuffer.length > MAX_OCR_IMAGE_BYTES) {
      throw new Error('OCR image exceeds the 10MB size limit');
    }
    if (typeof mimeType !== 'string') {
      throw new Error('OCR image MIME type is unsupported');
    }
    if (this.hasUnsafeProviderTextControls(mimeType)) {
      throw new Error('OCR image MIME type must not include unsafe control characters');
    }

    const normalizedMimeType = mimeType.trim().toLowerCase();
    if (!SUPPORTED_IMAGE_MIME_TYPES.has(normalizedMimeType)) {
      throw new Error('OCR image MIME type is unsupported');
    }
    return normalizedMimeType;
  }

  private static validateTextInput(text: string): string {
    if (typeof text !== 'string') {
      throw new Error('OCR menu text must be a non-empty string');
    }
    if (this.hasUnsafeProviderTextControls(text)) {
      throw new Error('OCR menu text must not include unsafe control characters');
    }
    const normalizedText = text.trim();
    if (normalizedText.length === 0) {
      throw new Error('OCR menu text must be a non-empty string');
    }
    if (Buffer.byteLength(normalizedText, 'utf8') > MAX_OCR_TEXT_BYTES) {
      throw new Error('OCR menu text exceeds the 50KB size limit');
    }
    return normalizedText;
  }

  /**
   * Estimate OCR cost (for analytics)
   */
  static estimateCost(imageCount: number): number {
    if (
      !Number.isFinite(imageCount) ||
	      !Number.isSafeInteger(imageCount) ||
	      imageCount <= 0 ||
	      !this.isOcrCapabilityEnabled() ||
	      !this.isProviderConfigured()
	    ) {
	      return 0;
    }

    // Claude Vision: ~$0.003 per image (input tokens)
    // Conservative estimate: $0.01 per image
    return imageCount * 0.01;
  }

  /**
   * Get OCR statistics
   */
  static getStats(): {
    enabled: boolean;
    provider: string;
    estimatedCostPerImage: number;
	  } {
	    const providerConfigured = this.isProviderConfigured();
	    const enabled = providerConfigured && this.isOcrCapabilityEnabled();
	    return {
	      enabled,
	      provider: enabled ? 'Anthropic Claude Vision' : 'Disabled',
	      estimatedCostPerImage: enabled ? 0.01 : 0,
	    };
	  }

	  private static isProviderConfigured(): boolean {
	    return OCR_ENABLED && anthropicClient !== null;
	  }

	  private static isOcrCapabilityEnabled(): boolean {
	    const capability = getCapability('ocr_import');
	    return capability ? capabilityReadiness(capability).enabled : false;
	  }

  private static assertOcrEnabled(options: OCRExtractionOptions): void {
    if (options.enforceCapability !== false) {
      assertCapabilityEnabled('ocr_import');
    }
  }

  private static normalizeExtractionOptions(options: OCRExtractionOptions | undefined): OCRExtractionOptions {
    if (options === undefined) return {};
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new Error('OCR extraction options must be an object');
    }
    const optionRecord = options as Record<string, unknown>;
    this.assertProviderFieldNamesAreSafe('OCR extraction options', Object.keys(optionRecord));
    const unsupportedKeys = Object.keys(optionRecord).filter(
      (key) => !OCR_EXTRACTION_OPTION_KEYS.has(key)
    );
    if (unsupportedKeys.length > 0) {
      throw new Error(
        `OCR extraction options include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
      );
    }
    if (
      optionRecord.enforceCapability !== undefined &&
      typeof optionRecord.enforceCapability !== 'boolean'
    ) {
      throw new Error('OCR extraction enforceCapability option must be a boolean');
    }
    return optionRecord as OCRExtractionOptions;
  }
}
