import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { OCRService, ExtractedDish } from '../services/OCRService.js';
import { AppDataSource } from '../config/database.js';
import { Dish } from '../models/Dish.js';
import { Business } from '../models/Business.js';
import { DishCategory } from '../models/DishCategory.js';
import { FeatureUnavailableError, assertCapabilityEnabled, requireCapability } from '../config/capabilities.js';

/**
 * OCR Routes (Phase 2.4)
 *
 * Endpoints for AI-assisted menu import via image or text
 */

interface ExtractFromImageRequest {
  image: string; // Base64 encoded image
  mime_type?: string;
}

interface ExtractFromTextRequest {
  menu_text: string;
}

interface BulkImportRequest {
  business_id: string;
  dishes: ExtractedDish[];
  create_categories?: boolean;
}

const OCR_IMAGE_BODY_FIELDS = new Set(['image', 'mime_type']);
const OCR_TEXT_BODY_FIELDS = new Set(['menu_text']);
const OCR_BULK_IMPORT_BODY_FIELDS = new Set(['business_id', 'dishes', 'create_categories']);
const OCR_BULK_IMPORT_DISH_FIELDS = new Set([
  'name',
  'description',
  'price_cents',
  'category',
  'allergens',
  'is_vegetarian',
  'is_vegan',
  'is_gluten_free',
  'confidence',
]);
const OCR_COMMAND_QUERY_FIELDS = new Set<string>();
const OCR_STATS_QUERY_FIELDS = new Set<string>();
const DEFAULT_OCR_IMAGE_MIME_TYPE = 'image/jpeg';
const MAX_OCR_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_OCR_TEXT_BYTES = 50 * 1024;
const MAX_OCR_BUSINESS_ID_CHARS = 255;
const MAX_OCR_USER_ID_CHARS = 255;
const MAX_OCR_DISH_NAME_CHARS = 120;
const MAX_OCR_DISH_DESCRIPTION_CHARS = 1000;
const MAX_OCR_DISH_CATEGORY_CHARS = 120;
const MAX_OCR_DISH_ALLERGEN_CHARS = 120;
const MAX_OCR_DISH_PRICE_CENTS = 100_000_000;
const SUPPORTED_OCR_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);
const UNSAFE_OCR_ROUTE_TEXT_CONTROLS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;

function unsupportedOcrRequestFields(body: unknown, allowedFields: Set<string>): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return [];
  }

  return Object.keys(body as Record<string, unknown>)
    .filter((field) => !allowedFields.has(field))
    .sort();
}

function normalizeOcrRequestBodyRecord(body: unknown): Record<string, unknown> | null {
  if (body === undefined || body === null) {
    return {};
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  return body as Record<string, unknown>;
}

function normalizeOptionalOcrQueryRecord(query: unknown): Record<string, unknown> | null {
  if (query === undefined || query === null) {
    return {};
  }

  if (typeof query !== 'object' || Array.isArray(query)) {
    return null;
  }

  return query as Record<string, unknown>;
}

function rejectUnsupportedOcrFields(reply: FastifyReply, fields: string[]): boolean {
  if (fields.length === 0) {
    return false;
  }

  reply.status(400).send({
    error: `Unsupported OCR request field(s): ${fields.join(', ')}`,
  });
  return true;
}

function rejectMalformedOcrBody(reply: FastifyReply, body: Record<string, unknown> | null): body is null {
  if (body !== null) {
    return false;
  }

  reply.status(400).send({
    error: 'OCR request body must be an object',
  });
  return true;
}

function rejectUnsupportedOcrQueryFields(reply: FastifyReply, fields: string[]): boolean {
  if (fields.length === 0) {
    return false;
  }

  reply.status(400).send({
    error: `Unsupported OCR query field(s): ${fields.join(', ')}`,
  });
  return true;
}

function rejectUnsafeOcrRequestFieldNames(
  reply: FastifyReply,
  label: string,
  record: Record<string, unknown>
): boolean {
  if (!Object.keys(record).some(hasUnsafeOcrRouteTextControls)) {
    return false;
  }

  reply.status(400).send({
    error: `${label} field names must not include unsafe control characters`,
  });
  return true;
}

function rejectInvalidOcrCommandQuery(reply: FastifyReply, query: unknown): boolean {
  const normalizedQuery = normalizeOptionalOcrQueryRecord(query);
  if (normalizedQuery === null) {
    reply.status(400).send({ error: 'OCR query must be an object' });
    return true;
  }

  if (rejectUnsafeOcrRequestFieldNames(reply, 'OCR query', normalizedQuery)) {
    return true;
  }

  const unsupportedFields = unsupportedOcrRequestFields(normalizedQuery, OCR_COMMAND_QUERY_FIELDS);
  return rejectUnsupportedOcrQueryFields(reply, unsupportedFields);
}

function hasUnsafeOcrRouteTextControls(value: string): boolean {
  return UNSAFE_OCR_ROUTE_TEXT_CONTROLS.test(value);
}

export function normalizeRequiredOcrString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  if (hasUnsafeOcrRouteTextControls(value)) {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function rejectUnsafeOcrTextField(reply: FastifyReply, label: string, value: string | undefined | null): boolean {
  if (value === undefined || value === null || !UNSAFE_OCR_ROUTE_TEXT_CONTROLS.test(value)) {
    return false;
  }

  reply.status(400).send({
    error: `${label} must not include unsafe control characters`,
  });
  return true;
}

function rejectOversizedOcrTextField(
  reply: FastifyReply,
  label: string,
  value: string | undefined | null,
  maxChars: number
): boolean {
  if (value === undefined || value === null || value.length <= maxChars) {
    return false;
  }

  reply.status(400).send({
    error: `${label} must be at most ${maxChars} characters`,
  });
  return true;
}

function normalizeAuthenticatedOcrUserId(user: unknown): string | null {
  if (!user || typeof user !== 'object') {
    return null;
  }

  const userRecord = user as { userId?: unknown; id?: unknown };
  return normalizeRequiredOcrString(userRecord.userId) ?? normalizeRequiredOcrString(userRecord.id);
}

function rejectInvalidAuthenticatedOcrUserId(reply: FastifyReply, user: unknown): string | null {
  const userId = normalizeAuthenticatedOcrUserId(user);
  if (!userId) {
    reply.status(401).send({ error: 'Unauthorized' });
    return null;
  }

  if (
    rejectUnsafeOcrTextField(reply, 'OCR user ID', userId) ||
    rejectOversizedOcrTextField(reply, 'OCR user ID', userId, MAX_OCR_USER_ID_CHARS)
  ) {
    return null;
  }

  return userId;
}

export function normalizeOptionalOcrImageMimeType(value: unknown): string | null {
  if (value === undefined) {
    return DEFAULT_OCR_IMAGE_MIME_TYPE;
  }

  if (typeof value === 'string' && hasUnsafeOcrRouteTextControls(value)) {
    return null;
  }

  const normalizedMimeType = normalizeRequiredOcrString(value)?.toLowerCase();
  if (!normalizedMimeType || !SUPPORTED_OCR_IMAGE_MIME_TYPES.has(normalizedMimeType)) {
    return null;
  }

  return normalizedMimeType;
}

function normalizeOptionalOcrBoolean(value: unknown): boolean | null {
  if (value === undefined) {
    return false;
  }

  return typeof value === 'boolean' ? value : null;
}

function normalizeOptionalOcrDishString(value: unknown): string | undefined | null {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = normalizeRequiredOcrString(value);
  return normalized ?? null;
}

function normalizeOptionalOcrDishBoolean(value: unknown): boolean | undefined | null {
  if (value === undefined || value === null) {
    return undefined;
  }

  return typeof value === 'boolean' ? value : null;
}

function normalizeOcrDishPriceCents(value: unknown): number | null {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > MAX_OCR_DISH_PRICE_CENTS
  ) {
    return null;
  }

  return value;
}

function normalizeOcrDishConfidence(value: unknown): number | null {
  if (value === undefined || value === null) {
    return 100;
  }

  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > 100
  ) {
    return null;
  }

  return value;
}

function normalizeOcrDishAllergens(value: unknown): string[] | undefined | null {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const normalizedAllergens: string[] = [];
  const seenAllergens = new Set<string>();
  for (const allergen of value) {
    const normalizedAllergen = normalizeRequiredOcrString(allergen);
    if (!normalizedAllergen) {
      return null;
    }

    const dedupeKey = normalizedAllergen.toLowerCase();
    if (seenAllergens.has(dedupeKey)) {
      continue;
    }

    seenAllergens.add(dedupeKey);
    normalizedAllergens.push(normalizedAllergen);
  }

  return normalizedAllergens;
}

function normalizeOcrBulkImportDishes(dishes: unknown): ExtractedDish[] | null {
  if (!Array.isArray(dishes) || dishes.length === 0) {
    return null;
  }

  const normalizedDishes: ExtractedDish[] = [];
  const dishIdentityIndexes = new Map<string, number>();
  for (const dish of dishes) {
    if (!dish || typeof dish !== 'object' || Array.isArray(dish)) {
      return null;
    }

    const dishRecord = dish as Record<string, unknown>;
    const normalizedName = normalizeRequiredOcrString(dishRecord.name);
    const normalizedDescription = normalizeOptionalOcrDishString(dishRecord.description);
    const normalizedPriceCents = normalizeOcrDishPriceCents(dishRecord.price_cents);
    const normalizedCategory = normalizeOptionalOcrDishString(dishRecord.category);
    const normalizedAllergens = normalizeOcrDishAllergens(dishRecord.allergens);
    const normalizedIsVegetarian = normalizeOptionalOcrDishBoolean(dishRecord.is_vegetarian);
    const normalizedIsVegan = normalizeOptionalOcrDishBoolean(dishRecord.is_vegan);
    const normalizedIsGlutenFree = normalizeOptionalOcrDishBoolean(dishRecord.is_gluten_free);
    const normalizedConfidence = normalizeOcrDishConfidence(dishRecord.confidence);

    if (
      !normalizedName ||
      normalizedDescription === null ||
      normalizedPriceCents === null ||
      normalizedCategory === null ||
      normalizedAllergens === null ||
      normalizedIsVegetarian === null ||
      normalizedIsVegan === null ||
      normalizedIsGlutenFree === null ||
      normalizedConfidence === null
    ) {
      return null;
    }

    normalizedDishes.push({
      name: normalizedName,
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      price_cents: normalizedPriceCents,
      ...(normalizedCategory ? { category: normalizedCategory } : {}),
      ...(normalizedAllergens ? { allergens: normalizedAllergens } : {}),
      ...(normalizedIsVegetarian !== undefined ? { is_vegetarian: normalizedIsVegetarian } : {}),
      ...(normalizedIsVegan !== undefined ? { is_vegan: normalizedIsVegan } : {}),
      ...(normalizedIsGlutenFree !== undefined ? { is_gluten_free: normalizedIsGlutenFree } : {}),
      confidence: normalizedConfidence,
    });

    const identityKey = [
      normalizedName.toLocaleLowerCase('en-US'),
      (normalizedCategory ?? '').toLocaleLowerCase('en-US'),
    ].join('\u0000');
    const firstIdentityIndex = dishIdentityIndexes.get(identityKey);
    if (firstIdentityIndex !== undefined) {
      throw new Error(
        `OCR bulk import dish ${normalizedDishes.length} duplicates dish ${firstIdentityIndex} identity`
      );
    }
    dishIdentityIndexes.set(identityKey, normalizedDishes.length);
  }

  return normalizedDishes;
}

function rejectUnsafeOcrBulkImportDishFieldNames(reply: FastifyReply, dishes: unknown): boolean {
  if (!Array.isArray(dishes)) {
    return false;
  }

  for (const [index, dish] of dishes.entries()) {
    if (!dish || typeof dish !== 'object' || Array.isArray(dish)) {
      continue;
    }

    if (Object.keys(dish as Record<string, unknown>).some(hasUnsafeOcrRouteTextControls)) {
      reply.status(400).send({
        error: `OCR bulk import dish ${index + 1} field names must not include unsafe control characters`,
      });
      return true;
    }
  }

  return false;
}

function rejectUnsupportedOcrBulkImportDishFields(reply: FastifyReply, dishes: unknown): boolean {
  if (!Array.isArray(dishes)) {
    return false;
  }

  for (const [index, dish] of dishes.entries()) {
    if (!dish || typeof dish !== 'object' || Array.isArray(dish)) {
      continue;
    }

    const unsupportedFields = Object.keys(dish as Record<string, unknown>)
      .filter((field) => !OCR_BULK_IMPORT_DISH_FIELDS.has(field))
      .sort();
    if (unsupportedFields.length > 0) {
      reply.status(400).send({
        error: `OCR bulk import dish ${index + 1} include unsupported field(s): ${unsupportedFields.join(', ')}`,
      });
      return true;
    }
  }

  return false;
}

function rejectUnsafeOcrBulkImportDishText(reply: FastifyReply, dishes: ExtractedDish[]): boolean {
  for (const [index, dish] of dishes.entries()) {
    const rowLabel = `OCR bulk import dish ${index + 1}`;
    if (
      rejectUnsafeOcrTextField(reply, `${rowLabel} name`, dish.name) ||
      rejectUnsafeOcrTextField(reply, `${rowLabel} description`, dish.description) ||
      rejectUnsafeOcrTextField(reply, `${rowLabel} category`, dish.category)
    ) {
      return true;
    }

    for (const allergen of dish.allergens ?? []) {
      if (rejectUnsafeOcrTextField(reply, `${rowLabel} allergen`, allergen)) {
        return true;
      }
    }
  }

  return false;
}

function rejectOversizedOcrBulkImportDishText(reply: FastifyReply, dishes: ExtractedDish[]): boolean {
  for (const [index, dish] of dishes.entries()) {
    const rowLabel = `OCR bulk import dish ${index + 1}`;
    if (dish.name.length > MAX_OCR_DISH_NAME_CHARS) {
      reply.status(400).send({
        error: `${rowLabel} name must be at most ${MAX_OCR_DISH_NAME_CHARS} characters`,
      });
      return true;
    }

    if ((dish.description?.length ?? 0) > MAX_OCR_DISH_DESCRIPTION_CHARS) {
      reply.status(400).send({
        error: `${rowLabel} description must be at most ${MAX_OCR_DISH_DESCRIPTION_CHARS} characters`,
      });
      return true;
    }

    if ((dish.category?.length ?? 0) > MAX_OCR_DISH_CATEGORY_CHARS) {
      reply.status(400).send({
        error: `${rowLabel} category must be at most ${MAX_OCR_DISH_CATEGORY_CHARS} characters`,
      });
      return true;
    }

    for (const allergen of dish.allergens ?? []) {
      if (allergen.length > MAX_OCR_DISH_ALLERGEN_CHARS) {
        reply.status(400).send({
          error: `${rowLabel} allergen must be at most ${MAX_OCR_DISH_ALLERGEN_CHARS} characters`,
        });
        return true;
      }
    }
  }

  return false;
}

function decodeBase64ImagePayload(image: string): Buffer | null {
  const normalized = image.trim();
  if (normalized.length === 0 || normalized.length % 4 === 1) {
    return null;
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    return null;
  }

  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const imageBuffer = Buffer.from(padded, 'base64');
  if (imageBuffer.length === 0 || imageBuffer.toString('base64') !== padded) {
    return null;
  }

  return imageBuffer;
}

function estimateBase64ImagePayloadBytes(image: string): number | null {
  const normalized = image.trim();
  if (normalized.length === 0 || normalized.length % 4 === 1) {
    return null;
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    return null;
  }

  const paddedLength = Math.ceil(normalized.length / 4) * 4;
  const explicitPadding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  const implicitPadding = paddedLength - normalized.length;
  return (paddedLength / 4) * 3 - Math.max(explicitPadding, implicitPadding);
}

export default async function ocrRoutes(fastify: FastifyInstance) {
  fastify.addHook?.('onRequest', requireCapability('ocr_import'));

  const sendFeatureUnavailable = (reply: FastifyReply, error: FeatureUnavailableError) =>
    reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        capability: error.capability,
      },
    });

  /**
   * POST /ocr/extract-from-image
   * Extract menu items from uploaded image
   */
  fastify.post<{ Body: ExtractFromImageRequest }>(
    '/extract-from-image',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest<{ Body: ExtractFromImageRequest }>, reply: FastifyReply) => {
      try {
        if (rejectInvalidOcrCommandQuery(reply, request.query)) {
          return;
        }

        const body = normalizeOcrRequestBodyRecord(request.body);
        if (rejectMalformedOcrBody(reply, body)) {
          return;
        }

        if (rejectUnsafeOcrRequestFieldNames(reply, 'OCR image request', body)) {
          return;
        }
        const unsupportedFields = unsupportedOcrRequestFields(body, OCR_IMAGE_BODY_FIELDS);
        if (rejectUnsupportedOcrFields(reply, unsupportedFields)) {
          return;
        }

        const { image, mime_type } = body;

        const normalizedImage = normalizeRequiredOcrString(image);
        if (!normalizedImage) {
          return reply.status(400).send({ error: 'Image data is required' });
        }
        if (rejectUnsafeOcrTextField(reply, 'OCR image data', normalizedImage)) {
          return;
        }

        const estimatedImageBytes = estimateBase64ImagePayloadBytes(normalizedImage);
        if (estimatedImageBytes === null) {
          return reply.status(400).send({ error: 'Image data must be valid base64.' });
        }
        if (estimatedImageBytes > MAX_OCR_IMAGE_BYTES) {
          return reply.status(400).send({ error: 'Image too large. Maximum size is 10MB.' });
        }

        const imageBuffer = decodeBase64ImagePayload(normalizedImage);
        if (!imageBuffer) {
          return reply.status(400).send({ error: 'Image data must be valid base64.' });
        }

        // Validate image size (max 10MB)
        if (imageBuffer.length > MAX_OCR_IMAGE_BYTES) {
          return reply.status(400).send({ error: 'Image too large. Maximum size is 10MB.' });
        }

        if (rejectUnsafeOcrTextField(reply, 'OCR image MIME type', normalizeRequiredOcrString(mime_type))) {
          return;
        }

        const normalizedMimeType = normalizeOptionalOcrImageMimeType(mime_type);
        if (!normalizedMimeType) {
          return reply.status(400).send({ error: 'OCR image MIME type is unsupported' });
        }

        const userId = rejectInvalidAuthenticatedOcrUserId(reply, request.user);
        if (!userId) {
          return;
        }

        assertCapabilityEnabled('ocr_import');

        // Extract dishes using OCR
        const result = await OCRService.extractFromImage(
          imageBuffer,
          normalizedMimeType
        );

        if (!result.success) {
          return reply.status(500).send({
            error: result.error || 'OCR extraction failed',
          });
        }

        return reply.send({
          success: true,
          data: {
            dishes: result.dishes,
            total_extracted: result.total_extracted,
            extraction_time_ms: result.extraction_time_ms,
          },
        });
      } catch (error: any) {
        if (error instanceof FeatureUnavailableError) {
          return sendFeatureUnavailable(reply, error);
        }
        console.error('Error in OCR image extraction:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /ocr/extract-from-text
   * Extract menu items from pasted text
   */
  fastify.post<{ Body: ExtractFromTextRequest }>(
    '/extract-from-text',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest<{ Body: ExtractFromTextRequest }>, reply: FastifyReply) => {
      try {
        if (rejectInvalidOcrCommandQuery(reply, request.query)) {
          return;
        }

        const body = normalizeOcrRequestBodyRecord(request.body);
        if (rejectMalformedOcrBody(reply, body)) {
          return;
        }

        if (rejectUnsafeOcrRequestFieldNames(reply, 'OCR text request', body)) {
          return;
        }
        const unsupportedFields = unsupportedOcrRequestFields(body, OCR_TEXT_BODY_FIELDS);
        if (rejectUnsupportedOcrFields(reply, unsupportedFields)) {
          return;
        }

        const normalizedMenuText = normalizeRequiredOcrString(body.menu_text);
        if (!normalizedMenuText) {
          return reply.status(400).send({ error: 'Menu text is required' });
        }
        if (rejectUnsafeOcrTextField(reply, 'OCR menu text', normalizedMenuText)) {
          return;
        }

        // Validate UTF-8 text size (max 50KB)
        if (Buffer.byteLength(normalizedMenuText, 'utf8') > MAX_OCR_TEXT_BYTES) {
          return reply.status(400).send({
            error: 'Text too long. Maximum length is 50KB.',
          });
        }

        const userId = rejectInvalidAuthenticatedOcrUserId(reply, request.user);
        if (!userId) {
          return;
        }

        assertCapabilityEnabled('ocr_import');

        // Extract dishes using AI parsing
        const result = await OCRService.extractFromText(normalizedMenuText);

        if (!result.success) {
          return reply.status(500).send({
            error: result.error || 'Text extraction failed',
          });
        }

        return reply.send({
          success: true,
          data: {
            dishes: result.dishes,
            total_extracted: result.total_extracted,
            extraction_time_ms: result.extraction_time_ms,
          },
        });
      } catch (error: any) {
        if (error instanceof FeatureUnavailableError) {
          return sendFeatureUnavailable(reply, error);
        }
        console.error('Error in OCR text extraction:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /ocr/bulk-import
   * Bulk import extracted dishes to business menu
   */
  fastify.post<{ Body: BulkImportRequest }>(
    '/bulk-import',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest<{ Body: BulkImportRequest }>, reply: FastifyReply) => {
      try {
        if (rejectInvalidOcrCommandQuery(reply, request.query)) {
          return;
        }

        const body = normalizeOcrRequestBodyRecord(request.body);
        if (rejectMalformedOcrBody(reply, body)) {
          return;
        }

        if (rejectUnsafeOcrRequestFieldNames(reply, 'OCR bulk import request', body)) {
          return;
        }
        const unsupportedFields = unsupportedOcrRequestFields(body, OCR_BULK_IMPORT_BODY_FIELDS);
        if (rejectUnsupportedOcrFields(reply, unsupportedFields)) {
          return;
        }

        const userId = rejectInvalidAuthenticatedOcrUserId(reply, request.user);
        const normalizedBusinessId = normalizeRequiredOcrString(body.business_id);
        const dishes = Array.isArray(body.dishes) ? body.dishes : null;
        const createCategories = normalizeOptionalOcrBoolean(body.create_categories);

        if (!userId) {
          return;
        }

        if (rejectUnsafeOcrBulkImportDishFieldNames(reply, dishes)) {
          return;
        }
        if (rejectUnsupportedOcrBulkImportDishFields(reply, dishes)) {
          return;
        }

        let normalizedDishes: ExtractedDish[] | null;
        try {
          normalizedDishes = normalizeOcrBulkImportDishes(dishes);
        } catch (error) {
          return reply.status(400).send({
            error: error instanceof Error ? error.message : 'business_id and dishes array are required',
          });
        }
        if (!normalizedBusinessId || !normalizedDishes) {
          return reply.status(400).send({
            error: 'business_id and dishes array are required',
          });
        }
        if (
          rejectUnsafeOcrTextField(reply, 'OCR business ID', normalizedBusinessId) ||
          rejectOversizedOcrTextField(
            reply,
            'OCR business ID',
            normalizedBusinessId,
            MAX_OCR_BUSINESS_ID_CHARS
          ) ||
          rejectUnsafeOcrBulkImportDishText(reply, normalizedDishes) ||
          rejectOversizedOcrBulkImportDishText(reply, normalizedDishes)
        ) {
          return;
        }

        if (createCategories === null) {
          return reply.status(400).send({
            error: 'create_categories must be a boolean when provided',
          });
        }

        assertCapabilityEnabled('ocr_import');
        const dishRepo = AppDataSource.getRepository(Dish);
        const businessRepo = AppDataSource.getRepository(Business);
        const categoryRepo = AppDataSource.getRepository(DishCategory);

        // Verify business ownership
        const business = await businessRepo.findOne({
          where: { id: normalizedBusinessId },
        });

        if (!business) {
          return reply.status(404).send({ error: 'Business not found' });
        }

        // Verify ownership
        const ownerCheck = await AppDataSource.query(
          'SELECT id FROM businesses WHERE id = $1 AND owner_id = $2',
          [normalizedBusinessId, userId]
        );

        if (!ownerCheck || ownerCheck.length === 0) {
          return reply.status(403).send({
            error: 'You do not own this business',
          });
        }

        // Create categories if needed
        const categoryMap = new Map<string, string>();
        let categoriesCreated = 0;

        const uniqueCategories = [
          ...new Set(normalizedDishes.map((d) => d.category).filter((c) => c)),
        ];

        for (const categoryName of uniqueCategories) {
          if (!categoryName) continue;

          // Check if category exists
          let category = await categoryRepo.findOne({
            where: {
              business_id: normalizedBusinessId,
              name: categoryName,
            },
          });

          // Create if allowed and it doesn't exist. When category creation is disabled,
          // still preserve existing category evidence instead of dropping it.
          if (!category && createCategories) {
            category = categoryRepo.create({
              business_id: normalizedBusinessId,
              name: categoryName.charAt(0).toUpperCase() + categoryName.slice(1),
              sort_order: 0,
            });
            await categoryRepo.save(category);
            categoriesCreated++;
          }

          if (category) {
            categoryMap.set(categoryName, category.id);
          }
        }

        // Import dishes
        const importedDishes: Dish[] = [];

        for (const extractedDish of normalizedDishes) {
          // Create dish
          const dish = dishRepo.create({
            business_id: normalizedBusinessId,
            name: extractedDish.name,
            description: extractedDish.description || '',
            price_cents: extractedDish.price_cents,
            category_id: extractedDish.category
              ? categoryMap.get(extractedDish.category)
              : undefined,
            is_available: true,
            allergen_tags: extractedDish.allergens || [],
            metadata: {
              is_vegetarian: extractedDish.is_vegetarian ?? true,
              is_vegan: extractedDish.is_vegan ?? false,
              is_gluten_free: extractedDish.is_gluten_free ?? false,
            },
          });

          await dishRepo.save(dish);
          importedDishes.push(dish);
        }

        return reply.send({
          success: true,
          data: {
            imported_count: importedDishes.length,
            dishes: importedDishes,
            categories_created: categoriesCreated,
          },
        });
      } catch (error: any) {
        if (error instanceof FeatureUnavailableError) {
          return sendFeatureUnavailable(reply, error);
        }
        console.error('Error in bulk import:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * GET /ocr/stats
   * Get OCR service statistics and status
   */
  fastify.get(
    '/stats',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = normalizeOptionalOcrQueryRecord(request.query);
        if (query === null) {
          return reply.status(400).send({ error: 'OCR stats query must be an object' });
        }

        if (rejectUnsafeOcrRequestFieldNames(reply, 'OCR stats query', query)) {
          return;
        }
        const unsupportedFields = unsupportedOcrRequestFields(query, OCR_STATS_QUERY_FIELDS);
        if (rejectUnsupportedOcrQueryFields(reply, unsupportedFields)) {
          return;
        }

        const userId = rejectInvalidAuthenticatedOcrUserId(reply, request.user);
        if (!userId) {
          return;
        }

        assertCapabilityEnabled('ocr_import');
        const stats = OCRService.getStats();

        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error: any) {
        if (error instanceof FeatureUnavailableError) {
          return sendFeatureUnavailable(reply, error);
        }
        console.error('Error fetching OCR stats:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}
