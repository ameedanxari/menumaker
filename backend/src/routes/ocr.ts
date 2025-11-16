import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { OCRService, ExtractedDish } from '../services/OCRService.js';
import { AppDataSource } from '../config/database.js';
import { Dish } from '../models/Dish.js';
import { Business } from '../models/Business.js';
import { DishCategory } from '../models/DishCategory.js';

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

export default async function ocrRoutes(fastify: FastifyInstance) {
  const dishRepo = AppDataSource.getRepository(Dish);
  const businessRepo = AppDataSource.getRepository(Business);
  const categoryRepo = AppDataSource.getRepository(DishCategory);

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
        const { image, mime_type } = request.body;

        if (!image) {
          return reply.status(400).send({ error: 'Image data is required' });
        }

        // Convert base64 to buffer
        const imageBuffer = Buffer.from(image, 'base64');

        // Validate image size (max 10MB)
        if (imageBuffer.length > 10 * 1024 * 1024) {
          return reply.status(400).send({ error: 'Image too large. Maximum size is 10MB.' });
        }

        // Extract dishes using OCR
        const result = await OCRService.extractFromImage(
          imageBuffer,
          mime_type || 'image/jpeg'
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
        const { menu_text } = request.body;

        if (!menu_text || menu_text.trim().length === 0) {
          return reply.status(400).send({ error: 'Menu text is required' });
        }

        // Validate text length (max 50KB)
        if (menu_text.length > 50 * 1024) {
          return reply.status(400).send({
            error: 'Text too long. Maximum length is 50KB.',
          });
        }

        // Extract dishes using AI parsing
        const result = await OCRService.extractFromText(menu_text);

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
        const userId = request.user?.userId;
        const { business_id, dishes, create_categories } = request.body;

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        if (!business_id || !dishes || dishes.length === 0) {
          return reply.status(400).send({
            error: 'business_id and dishes array are required',
          });
        }

        // Verify business ownership
        const business = await businessRepo.findOne({
          where: { id: business_id },
        });

        if (!business) {
          return reply.status(404).send({ error: 'Business not found' });
        }

        // Verify ownership
        const ownerCheck = await AppDataSource.query(
          'SELECT id FROM businesses WHERE id = $1 AND owner_id = $2',
          [business_id, userId]
        );

        if (!ownerCheck || ownerCheck.length === 0) {
          return reply.status(403).send({
            error: 'You do not own this business',
          });
        }

        // Create categories if needed
        const categoryMap = new Map<string, string>();

        if (create_categories) {
          const uniqueCategories = [
            ...new Set(dishes.map((d) => d.category).filter((c) => c)),
          ];

          for (const categoryName of uniqueCategories) {
            if (!categoryName) continue;

            // Check if category exists
            let category = await categoryRepo.findOne({
              where: {
                business_id,
                name: categoryName,
              },
            });

            // Create if doesn't exist
            if (!category) {
              category = categoryRepo.create({
                business_id,
                name: categoryName.charAt(0).toUpperCase() + categoryName.slice(1),
                sort_order: 0,
              });
              await categoryRepo.save(category);
            }

            categoryMap.set(categoryName, category.id);
          }
        }

        // Import dishes
        const importedDishes: Dish[] = [];

        for (const extractedDish of dishes) {
          // Create dish
          const dish = dishRepo.create({
            business_id,
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
            categories_created: categoryMap.size,
          },
        });
      } catch (error: any) {
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
        const stats = OCRService.getStats();

        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error: any) {
        console.error('Error fetching OCR stats:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}
