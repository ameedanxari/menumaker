import Anthropic from '@anthropic-ai/sdk';

// Environment variables
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const OCR_ENABLED = process.env.OCR_ENABLED === 'true';

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

/**
 * OCR Service for menu extraction using Claude Vision API
 */
export class OCRService {
  /**
   * Extract menu items from image using Claude Vision
   */
  static async extractFromImage(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg'
  ): Promise<OCRResult> {
    if (!OCR_ENABLED || !anthropicClient) {
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
                  media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
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

      // Extract text response
      const textContent = response.content.find((block) => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude Vision API');
      }

      const extractedText = textContent.text;

      // Parse JSON response
      const dishes = this.parseExtractedJSON(extractedText);

      const extractionTime = Date.now() - startTime;

      return {
        dishes,
        total_extracted: dishes.length,
        extraction_time_ms: extractionTime,
        success: true,
        raw_text: extractedText,
      };
    } catch (error: any) {
      console.error('❌ OCR extraction failed:', error.message);

      return {
        dishes: [],
        total_extracted: 0,
        extraction_time_ms: Date.now() - startTime,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Extract menu items from pasted text
   */
  static async extractFromText(text: string): Promise<OCRResult> {
    if (!OCR_ENABLED || !anthropicClient) {
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
      // Create text parsing prompt
      const response = await anthropicClient.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: this.getTextExtractionPrompt(text),
          },
        ],
      });

      // Extract response
      const textContent = response.content.find((block) => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude API');
      }

      const extractedText = textContent.text;

      // Parse JSON response
      const dishes = this.parseExtractedJSON(extractedText);

      const extractionTime = Date.now() - startTime;

      return {
        dishes,
        total_extracted: dishes.length,
        extraction_time_ms: extractionTime,
        success: true,
        raw_text: extractedText,
      };
    } catch (error: any) {
      console.error('❌ Text extraction failed:', error.message);

      return {
        dishes: [],
        total_extracted: 0,
        extraction_time_ms: Date.now() - startTime,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get prompt for image extraction
   */
  private static getImageExtractionPrompt(): string {
    return `You are a menu extraction assistant. Analyze this restaurant menu image and extract ALL dishes/items with their details.

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
- If no price visible → price_cents = 0, confidence = 50

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

Extract ALL visible items. Return valid JSON only.`;
  }

  /**
   * Get prompt for text extraction
   */
  private static getTextExtractionPrompt(menuText: string): string {
    return `You are a menu extraction assistant. Parse this menu text and extract ALL dishes/items.

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

Extract ALL items. Return valid JSON only.`;
  }

  /**
   * Parse extracted JSON from Claude response
   */
  private static parseExtractedJSON(extractedText: string): ExtractedDish[] {
    try {
      // Try to find JSON array in the response
      const jsonMatch = extractedText.match(/\[[\s\S]*\]/);

      if (!jsonMatch) {
        console.error('No JSON array found in response');
        return [];
      }

      const dishes = JSON.parse(jsonMatch[0]) as ExtractedDish[];

      // Validate and clean dishes
      return dishes
        .filter((dish) => dish.name && dish.price_cents !== undefined)
        .map((dish) => ({
          ...dish,
          name: dish.name.trim(),
          description: dish.description?.trim() || '',
          price_cents: Math.max(0, Math.round(dish.price_cents)),
          category: dish.category?.toLowerCase() || 'other',
          allergens: dish.allergens || [],
          is_vegetarian: dish.is_vegetarian ?? true,
          is_vegan: dish.is_vegan ?? false,
          is_gluten_free: dish.is_gluten_free ?? false,
          confidence: Math.min(100, Math.max(0, dish.confidence || 80)),
        }));
    } catch (error: any) {
      console.error('Failed to parse extracted JSON:', error.message);
      return [];
    }
  }

  /**
   * Estimate OCR cost (for analytics)
   */
  static estimateCost(imageCount: number): number {
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
    return {
      enabled: OCR_ENABLED,
      provider: OCR_ENABLED ? 'Anthropic Claude Vision' : 'Disabled',
      estimatedCostPerImage: 0.01,
    };
  }
}
