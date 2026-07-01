import { describe, expect, it, jest } from '@jest/globals';
import { OCRService } from '../src/services/OCRService';

describe('OCRService local text extraction', () => {
  it('reports a fully disabled OCR stats boundary when the capability is not enabled', () => {
    expect(OCRService.getStats()).toEqual({
      enabled: false,
      provider: 'Disabled',
      estimatedCostPerImage: 0,
    });
    expect(OCRService.estimateCost(25)).toBe(0);
  });

  it('reports OCR stats as disabled when the flag is enabled without provider credentials', async () => {
    const previousOcrEnabled = process.env.OCR_ENABLED;
    const previousAnthropicApiKey = process.env.ANTHROPIC_API_KEY;

    try {
      jest.resetModules();
      process.env.OCR_ENABLED = 'true';
      delete process.env.ANTHROPIC_API_KEY;

      const { OCRService: ReloadedOCRService } = await import('../src/services/OCRService');

      expect(ReloadedOCRService.getStats()).toEqual({
        enabled: false,
        provider: 'Disabled',
        estimatedCostPerImage: 0,
      });
      expect(ReloadedOCRService.estimateCost(25)).toBe(0);
      await expect(
        ReloadedOCRService.extractFromImage(Buffer.from('image'), 'image/jpeg', {
          enforceCapability: false,
        })
      ).resolves.toMatchObject({
        success: false,
        error: 'OCR not configured. Please set ANTHROPIC_API_KEY.',
      });
    } finally {
      if (previousOcrEnabled === undefined) {
        delete process.env.OCR_ENABLED;
      } else {
        process.env.OCR_ENABLED = previousOcrEnabled;
      }
      if (previousAnthropicApiKey === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = previousAnthropicApiKey;
      }
      jest.resetModules();
    }
  });

  it('normalizes unusable OCR cost inputs to zero', () => {
    expect(OCRService.estimateCost(0)).toBe(0);
    expect(OCRService.estimateCost(-3)).toBe(0);
    expect(OCRService.estimateCost(Number.NaN)).toBe(0);
  });

  it('keeps OCR stats and cost disabled when provider credentials exist but the registry disables OCR', async () => {
    const previousOcrEnabled = process.env.OCR_ENABLED;
    const previousAnthropicApiKey = process.env.ANTHROPIC_API_KEY;

    try {
      jest.resetModules();
      process.env.OCR_ENABLED = 'true';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      const { OCRService: ReloadedOCRService } = await import('../src/services/OCRService');

      expect(ReloadedOCRService.getStats()).toEqual({
        enabled: false,
        provider: 'Disabled',
        estimatedCostPerImage: 0,
      });
      expect(ReloadedOCRService.estimateCost(3)).toBe(0);
      expect(ReloadedOCRService.estimateCost(1.5)).toBe(0);
      expect(ReloadedOCRService.estimateCost(Number.MAX_SAFE_INTEGER + 1)).toBe(0);
    } finally {
      if (previousOcrEnabled === undefined) {
        delete process.env.OCR_ENABLED;
      } else {
        process.env.OCR_ENABLED = previousOcrEnabled;
      }
      if (previousAnthropicApiKey === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = previousAnthropicApiKey;
      }
      jest.resetModules();
    }
  });

  it('fails extraction entry points through the capability registry by default while OCR is disabled', async () => {
    await expect(OCRService.extractFromText('Samosa ₹20')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'ocr_import',
    });
    await expect(OCRService.extractFromImage(Buffer.from('image'))).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'ocr_import',
    });
  });

  it('rejects malformed extraction options before capability or provider checks', async () => {
    await expect(
      OCRService.extractFromText('Samosa ₹20', null as any)
    ).rejects.toThrow('OCR extraction options must be an object');

    await expect(
      OCRService.extractFromImage(Buffer.from('image'), 'image/jpeg', [] as any)
    ).rejects.toThrow('OCR extraction options must be an object');

    await expect(
      OCRService.extractFromText('Samosa ₹20', {
        enforceCapability: false,
        providerOverride: 'shadow-ocr',
      } as any)
    ).rejects.toThrow(
      'OCR extraction options include unsupported field(s): providerOverride'
    );

    await expect(
      OCRService.extractFromText('Samosa ₹20', {
        enforceCapability: false,
        ['providerOverride\uFEFF']: 'shadow-ocr',
      } as any)
    ).rejects.toThrow(
      'OCR extraction options field names must not include unsafe control characters'
    );

    await expect(
      OCRService.extractFromText('Samosa ₹20', {
        enforceCapability: 'false',
      } as any)
    ).rejects.toThrow('OCR extraction enforceCapability option must be a boolean');

    await expect(
      OCRService.extractFromImage(Buffer.from('image'), 'image/jpeg', {
        enforceCapability: 0,
      } as any)
    ).rejects.toThrow('OCR extraction enforceCapability option must be a boolean');
  });

  it('rejects invalid image inputs at the service boundary before provider configuration checks', async () => {
    await expect(
      OCRService.extractFromImage(Buffer.alloc(0), 'image/jpeg', { enforceCapability: false })
    ).rejects.toThrow('OCR image must be a non-empty Buffer');

    await expect(
      OCRService.extractFromImage(
        Buffer.alloc(10 * 1024 * 1024 + 1),
        'image/jpeg',
        { enforceCapability: false }
      )
    ).rejects.toThrow('OCR image exceeds the 10MB size limit');

    await expect(
      OCRService.extractFromImage(Buffer.from('image'), 'text/html', {
        enforceCapability: false,
      })
    ).rejects.toThrow('OCR image MIME type is unsupported');

    await expect(
      OCRService.extractFromImage(Buffer.from('image'), '\uFEFFimage/png', {
        enforceCapability: false,
      })
    ).rejects.toThrow('OCR image MIME type must not include unsafe control characters');
  });

  it('accepts normalized supported image MIME types before reporting disabled provider configuration', async () => {
    await expect(
      OCRService.extractFromImage(Buffer.from('image'), ' IMAGE/PNG ', {
        enforceCapability: false,
      })
    ).resolves.toMatchObject({
      success: false,
      error: 'OCR not configured. Please set ANTHROPIC_API_KEY.',
    });
  });

  it('rejects empty and oversized UTF-8 menu text before local parsing or provider dispatch', async () => {
    await expect(
      OCRService.extractFromText('   ', { enforceCapability: false })
    ).rejects.toThrow('OCR menu text must be a non-empty string');

    const oversizedUnicodeText = '₹'.repeat(Math.floor((50 * 1024) / 3) + 1);
    expect(oversizedUnicodeText.length).toBeLessThan(50 * 1024);
    await expect(
      OCRService.extractFromText(oversizedUnicodeText, { enforceCapability: false })
    ).rejects.toThrow('OCR menu text exceeds the 50KB size limit');

    expect(() => OCRService.extractMenuItemsFromPlainText(oversizedUnicodeText))
      .toThrow('OCR menu text exceeds the 50KB size limit');

    await expect(
      OCRService.extractFromText('Samosa\u0000 ₹20', { enforceCapability: false })
    ).rejects.toThrow('OCR menu text must not include unsafe control characters');

    expect(() => OCRService.extractMenuItemsFromPlainText('Samosa\u0007 ₹20'))
      .toThrow('OCR menu text must not include unsafe control characters');

    await expect(
      OCRService.extractFromText('Samosa\u202E ₹20', { enforceCapability: false })
    ).rejects.toThrow('OCR menu text must not include unsafe control characters');

    await expect(
      OCRService.extractFromText('\uFEFFSamosa ₹20', { enforceCapability: false })
    ).rejects.toThrow('OCR menu text must not include unsafe control characters');

    expect(() => OCRService.extractMenuItemsFromPlainText('Samosa\u200B ₹20'))
      .toThrow('OCR menu text must not include unsafe control characters');

    expect(() => OCRService.extractMenuItemsFromPlainText('Samosa ₹20\uFEFF'))
      .toThrow('OCR menu text must not include unsafe control characters');
  });

  it('normalizes OCR text boundaries before parsing, raw-text audit output, and size validation', async () => {
    const paddedText = `

        Starters
        Samosa ₹20

    `;
    const result = await OCRService.extractFromText(paddedText, { enforceCapability: false });

    expect(result.success).toBe(true);
    expect(result.raw_text).toBe('Starters\n        Samosa ₹20');
    expect(result.dishes).toEqual([
      expect.objectContaining({
        name: 'Samosa',
        price_cents: 2000,
        category: 'appetizer',
      }),
    ]);

    expect(OCRService.extractMenuItemsFromPlainText(' \n Masala Chai 35 \n ')).toEqual([
      expect.objectContaining({
        name: 'Masala Chai',
        price_cents: 3500,
      }),
    ]);

    const maximumTextAfterTrim = `${'₹'.repeat(Math.floor((50 * 1024) / 3))}  `;
    expect(() => OCRService.extractMenuItemsFromPlainText(maximumTextAfterTrim))
      .not.toThrow('OCR menu text exceeds the 50KB size limit');
  });

  it('extracts priced menu items from pasted text without an external AI provider', async () => {
    const result = await OCRService.extractFromText(`
      Starters
      Samosa - Crispy wheat pastry with potato filling ₹20
      Paneer Tikka - Grilled cottage cheese with spices Rs. 250

      Beverages
      Masala Chai 35
    `, { enforceCapability: false });

    expect(result.success).toBe(true);
    expect(result.total_extracted).toBe(3);
    expect(result).not.toHaveProperty('error');
    expect(result.dishes).toEqual([
      expect.objectContaining({
        name: 'Samosa',
        description: 'Crispy wheat pastry with potato filling',
        price_cents: 2000,
        category: 'appetizer',
        allergens: expect.arrayContaining(['gluten']),
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: false,
      }),
      expect.objectContaining({
        name: 'Paneer Tikka',
        price_cents: 25000,
        category: 'appetizer',
        allergens: expect.arrayContaining(['dairy']),
        is_vegan: false,
      }),
      expect.objectContaining({
        name: 'Masala Chai',
        price_cents: 3500,
        category: 'beverage',
        allergens: [],
      }),
    ]);
  });

  it('skips unpriced prose instead of fabricating dishes', async () => {
    const result = await OCRService.extractFromText(`
      Our chef recommends asking your server about today's specials.
      Fresh seasonal ingredients available while supplies last.
    `, { enforceCapability: false });

    expect(result.success).toBe(false);
    expect(result.total_extracted).toBe(0);
    expect(result.dishes).toEqual([]);
    expect(result.error).toMatch(/No menu items with prices/);
  });

  it('skips bare numbered dish names instead of treating the dish number as a price', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Specials
      Chicken 65
      Gobi 65
      Tea 35
      Chicken 65 ₹180
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Tea',
        price_cents: 3500,
      }),
      expect.objectContaining({
        name: 'Chicken 65',
        price_cents: 18000,
      }),
    ]);
  });

  it('normalizes decimal and suffix currency prices', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Desserts
      Gulab Jamun 75 Rs
      Brownie - chocolate walnut cake $4.50
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Gulab Jamun',
        price_cents: 7500,
        category: 'dessert',
      }),
      expect.objectContaining({
        name: 'Brownie',
        description: 'chocolate walnut cake',
        price_cents: 450,
        category: 'dessert',
        allergens: expect.arrayContaining(['nuts']),
      }),
    ]);
  });

  it('keeps grouped thousands distinct from decimal comma prices', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Specials
      Family Biryani ₹1,200
      Catering Platter 1,250 Rs
      Wedding Buffet INR 1,20,000
      Sparkling Water 4,50
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Family Biryani',
        price_cents: 120_000,
      }),
      expect.objectContaining({
        name: 'Catering Platter',
        price_cents: 125_000,
      }),
      expect.objectContaining({
        name: 'Wedding Buffet',
        price_cents: 12_000_000,
      }),
      expect.objectContaining({
        name: 'Sparkling Water',
        price_cents: 450,
      }),
    ]);
  });

  it('fails closed on ambiguous local OCR category headers instead of trusting first-match evidence', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Desserts and Beverages
      Mango Lassi ₹80
      Starters
      Samosa ₹20
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Mango Lassi',
        price_cents: 8000,
        category: 'other',
      }),
      expect.objectContaining({
        name: 'Samosa',
        price_cents: 2000,
        category: 'appetizer',
      }),
    ]);
  });

  it('deduplicates repeated local OCR lines without dropping distinct category entries', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Starters
      Samosa - Crispy wheat pastry ₹20
      samosa - crispy wheat pastry ₹20
      Beverages
      Samosa ₹20
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Samosa',
        description: 'Crispy wheat pastry',
        price_cents: 2000,
        category: 'appetizer',
      }),
      expect.objectContaining({
        name: 'Samosa',
        price_cents: 2000,
        category: 'beverage',
      }),
    ]);
  });

  it('deduplicates local OCR lines by keeping the strongest extraction evidence', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Mains
      Masala Dosa 80
      masala dosa - crispy rice crepe with potato filling ₹80
      Masala Dosa - weaker duplicate should not replace stronger evidence 80
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Masala Dosa',
        description: 'crispy rice crepe with potato filling',
        price_cents: 8000,
        category: 'main_course',
      }),
    ]);
    expect(dishes[0].confidence).toBeGreaterThan(80);
  });

  it('rejects local OCR duplicate dish rows with conflicting safety evidence', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Mains
      Safe Dal ₹99
      House Curry - vegan tofu curry ₹129
      House Curry - chicken curry ₹129
      Paneer Tikka - smoky paneer ₹120
      Paneer Tikka - cashew paneer ₹120
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
      }),
    ]);
  });

  it('rejects local OCR lines with conflicting prices for the same dish identity', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Starters
      Safe Dal ₹99
      Samosa - Crispy wheat pastry ₹20
      samosa - crispy wheat pastry ₹30

      Beverages
      Mango Lassi - Small ₹50
      Mango Lassi - Large ₹70
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'appetizer',
      }),
      expect.objectContaining({
        name: 'Mango Lassi',
        description: 'Small',
        price_cents: 5000,
        category: 'beverage',
      }),
      expect.objectContaining({
        name: 'Mango Lassi',
        description: 'Large',
        price_cents: 7000,
        category: 'beverage',
      }),
    ]);
  });

  it('skips OCR text prices that overflow safe integer cents', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Specials
      Normal Thali ₹120
      Precision Bomb Curry ₹90071992547409.93
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Normal Thali',
        price_cents: 12000,
      }),
    ]);
  });

  it('skips OCR text values that are safe integers but implausible menu prices', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Specials
      Normal Thali ₹120
      Call 9876543210
      Catering Hall Phone 08012345678
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Normal Thali',
        price_cents: 12000,
      }),
    ]);
  });

  it('skips oversized local OCR dish text before returning import candidates', () => {
    const oversizedName = 'A'.repeat(121);
    const oversizedDescription = 'B'.repeat(1001);

    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Specials
      ${oversizedName} ₹120
      Normal Thali - ${oversizedDescription} ₹130
      Safe Dal ₹99
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Dal',
        price_cents: 9900,
      }),
    ]);
  });

  it('skips noisy local OCR names instead of importing punctuation as dishes', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Specials
      !!! ### ₹120
      * * * Rs. 99
      Safe Dal ₹99
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Dal',
        price_cents: 9900,
      }),
    ]);
  });

  it('scores local OCR confidence from multiple text signals instead of currency alone', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Starters
      Samosa - Crispy wheat pastry ₹20
      Tea 35
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Samosa',
        confidence: 90,
      }),
      expect.objectContaining({
        name: 'Tea',
        confidence: 65,
      }),
    ]);
    expect(dishes[0].confidence).toBeGreaterThan(dishes[1].confidence);
  });

  it('skips no-price OCR items encoded as zero cents instead of importing them as free dishes', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Specials
      No Price Soup ₹0
      Normal Thali ₹120
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Normal Thali',
        price_cents: 12000,
      }),
    ]);
  });

  it('instructs OCR providers to omit no-price and accounting rows instead of emitting zero-priced dishes', () => {
    const imagePrompt = (OCRService as any).getImageExtractionPrompt();
    const textPrompt = (OCRService as any).getTextExtractionPrompt('Subtotal ₹450\nMystery Soup');

    for (const prompt of [imagePrompt, textPrompt]) {
      expect(prompt).toContain('If no positive price is visible, omit that row entirely');
      expect(prompt).toContain('Do not emit price_cents = 0');
      expect(prompt).toContain('Omit receipt/accounting rows');
      expect(prompt).toContain('priced menu items');
    }
    expect(imagePrompt).not.toContain('If no price visible → price_cents = 0');
    expect(textPrompt).toContain('Subtotal ₹450\nMystery Soup');
  });

  it('skips receipt accounting rows instead of importing totals and taxes as dishes', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      South Indian
      Masala Dosa ₹120
      Subtotal ₹450
      GST 5% ₹22.50
      Service Charge ₹40
      Grand Total ₹512.50
      Delivery Charge ₹35
      Filter Coffee ₹45
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Masala Dosa',
        price_cents: 12000,
      }),
      expect.objectContaining({
        name: 'Filter Coffee',
        price_cents: 4500,
      }),
    ]);
  });

  it('skips variable-price local OCR rows even when nearby numbers look like prices', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Seafood
      Lobster Market Price 200
      Seasonal Crab - ask server 300
      Oysters MP 6
      Daily Fish M.P. 4
      Safe Dal ₹99
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Dal',
        price_cents: 9900,
      }),
    ]);
  });

  it('skips ambiguous local OCR rows with multiple explicit prices', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Snacks
      Idli ₹40 / Vada ₹50
      Samosa Rs 20 Chai Rs 10
      Masala Dosa ₹120
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Masala Dosa',
        price_cents: 12000,
      }),
    ]);
  });

  it('skips ambiguous local OCR rows with residual bare price evidence', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Snacks
      Idli 40 / Vada 50
      Samosa 20 Chai 10
      Combo Rice 80 and Curry 120
      Chicken 65 ₹180
      Masala Dosa 120
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Chicken 65',
        price_cents: 18000,
      }),
      expect.objectContaining({
        name: 'Masala Dosa',
        price_cents: 12000,
      }),
    ]);
  });

  it('does not infer egg allergens or non-vegetarian flags from eggplant substrings', () => {
    const dishes = OCRService.extractMenuItemsFromPlainText(`
      Mains
      Eggplant Curry - roasted aubergine with spices ₹120
      Egg Curry - boiled eggs in masala ₹90
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Eggplant Curry',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
      }),
      expect.objectContaining({
        name: 'Egg Curry',
        allergens: ['eggs'],
        is_vegetarian: false,
        is_vegan: false,
      }),
    ]);
  });

  it('rejects malformed provider JSON money, confidence, and dietary values instead of clamping them', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Valid Thali',
        description: 'served with curd',
        price_cents: 14900,
        category: ' MAIN_COURSE ',
        allergens: [' Dairy ', 'dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: false,
        confidence: 91,
      },
      {
        name: 'Negative Price Curry',
        price_cents: -100,
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 90,
      },
      {
        name: 'No Visible Price Soup',
        price_cents: 0,
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 50,
      },
      {
        name: 'Rounded Price Noodles',
        price_cents: 1250.5,
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: false,
        confidence: 90,
      },
      {
        name: 'Overconfident Dessert',
        price_cents: 5000,
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: false,
        confidence: 130,
      },
      {
        name: 'Missing Confidence Chaat',
        price_cents: 3000,
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: false,
      },
      {
        name: 'Low Confidence Curry',
        price_cents: 8800,
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 49,
      },
      {
        name: 'Fractional Confidence Curry',
        price_cents: 4500,
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89.5,
      },
      {
        name: 'Unsafe Precision Feast',
        price_cents: Number.MAX_SAFE_INTEGER + 1,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        confidence: 90,
      },
      {
        name: 'String Vegan Flag',
        price_cents: 4500,
        is_vegetarian: true,
        is_vegan: 'false',
        is_gluten_free: true,
        confidence: 90,
      },
      {
        name: 'Hidden\u0000Control Curry',
        price_cents: 4500,
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 90,
      },
      {
        name: 'Control Description Curry',
        description: 'Safe looking\u0007description',
        price_cents: 4500,
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 90,
      },
      {
        name: 'Control Category Curry',
        price_cents: 4500,
        category: 'main\u0000course',
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 90,
      },
      {
        name: 'Control Allergen Curry',
        price_cents: 4500,
        allergens: ['dairy\u0000'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 90,
      },
      {
        name: 'Missing Dietary Dessert',
        price_cents: 6500,
        is_vegetarian: true,
        confidence: 90,
      },
      {
        name: 'Unknown Allergen Soup',
        price_cents: 5500,
        allergens: ['sesame'],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 90,
      },
      {
        name: 'Phone Number Curry',
        price_cents: 987654321000,
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 90,
      },
      {
        name: 'Numeric Allergen Salad',
        price_cents: 4500,
        allergens: ['nuts', 123],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 90,
      },
      {
        name: 'Allergen Object Curry',
        price_cents: 7500,
        allergens: { contains: ['dairy'] },
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 90,
      },
      {
        name: 'Mismatched Price Text Curry',
        price_cents: 9900,
        price_text: '₹149',
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 90,
      },
      {
        name: 'Mismatched Price Field Curry',
        price_cents: 9900,
        price: 'Rs. 149',
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 90,
      },
      {
        name: 'Malformed Price Text Curry',
        price_cents: 9900,
        price_text: { visible: '₹99' },
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 90,
      },
      {
        name: 'Control Price Text Curry',
        price_cents: 9900,
        price_text: '₹99\u0000',
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 90,
      },
      {
        name: 'Ambiguous Price Text Curry',
        price_cents: 9900,
        price_text: '₹99 / ₹149',
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 90,
      },
      {
        name: 'Matching Price Text Chaat',
        price_cents: 9900,
        price_text: ' ₹99 ',
        category: 'appetizer',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
      {
        name: 'Matching Price Field Lassi',
        price_cents: 1250,
        price: 'Rs. 12.50',
        category: 'beverage',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 88,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Valid Thali',
        price_cents: 14900,
        category: 'main_course',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: false,
        confidence: 91,
      }),
      expect.objectContaining({
        name: 'Matching Price Text Chaat',
        price_cents: 9900,
        category: 'appetizer',
        confidence: 89,
      }),
      expect.objectContaining({
        name: 'Matching Price Field Lassi',
        price_cents: 1250,
        category: 'beverage',
        allergens: ['dairy'],
        confidence: 88,
      }),
    ]);
  });

  it('rejects provider JSON accounting rows instead of laundering receipt totals into dishes', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Paneer Butter Masala',
        price_cents: 22000,
        category: 'main_course',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 92,
      },
      {
        name: 'Grand Total',
        price_cents: 51250,
        category: 'other',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 81,
      },
      {
        name: 'GST 5%',
        price_cents: 2250,
        category: 'other',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 79,
      },
      {
        name: 'Service Charge',
        price_cents: 4000,
        category: 'other',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 78,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Paneer Butter Masala',
        price_cents: 22000,
        category: 'main_course',
      }),
    ]);
  });

  it('trims and bounds provider raw text before returning OCR audit output', () => {
    const dishes = [
      {
        name: 'Paneer Butter Masala',
        price_cents: 22000,
        category: 'main_course',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 92,
      },
    ];

    expect(
      (OCRService as any).buildProviderExtractionResult(
        dishes,
        12,
        '  trusted provider JSON  ',
        'No trusted menu items could be extracted.'
      )
    ).toMatchObject({
      dishes,
      total_extracted: 1,
      success: true,
      raw_text: 'trusted provider JSON',
    });

    expect(
      (OCRService as any).buildProviderExtractionResult(
        dishes,
        12,
        'provider prose\u0000with unsafe controls',
        'No trusted menu items could be extracted.'
      )
    ).not.toHaveProperty('raw_text');

    expect(
      (OCRService as any).buildProviderExtractionResult(
        dishes,
        12,
        '\uFEFFtrusted provider JSON',
        'No trusted menu items could be extracted.'
      )
    ).not.toHaveProperty('raw_text');

    expect(
      (OCRService as any).buildProviderExtractionResult(
        dishes,
        12,
        `${'₹'.repeat(Math.floor((50 * 1024) / 3) + 1)}`,
        'No trusted menu items could be extracted.'
      )
    ).not.toHaveProperty('raw_text');
  });

  it('bounds provider failure messages before returning OCR errors', () => {
    expect((OCRService as any).normalizeProviderFailureMessage(
      new Error('  provider timeout after 30s  ')
    )).toBe('provider timeout after 30s');

    const oversizedMessage = (OCRService as any).normalizeProviderFailureMessage(
      new Error(`provider-${'x'.repeat(1001)}`)
    );
    expect(oversizedMessage).toHaveLength(1000);
    expect(oversizedMessage).toBe(`provider-${'x'.repeat(991)}`);

    expect((OCRService as any).normalizeProviderFailureMessage(
      new Error('provider\u0000diagnostic')
    )).toBe('OCR provider request failed');

    expect((OCRService as any).normalizeProviderFailureMessage('   '))
      .toBe('OCR provider request failed');
    expect((OCRService as any).normalizeProviderFailureMessage({ message: 'not trusted' }))
      .toBe('OCR provider request failed');
  });

  it('rejects malformed provider response content envelopes before parsing menu facts', () => {
    expect(() => (OCRService as any).extractProviderTextResponse(
      null,
      'Claude API'
    )).toThrow('Claude API response content must be an array');

    expect(() => (OCRService as any).extractProviderTextResponse(
      [
        { type: 'text', text: '[{"name":"Safe Dal"}]' },
        { type: 'tool_use', id: 'tool-1' },
      ],
      'Claude API'
    )).toThrow('Claude API response includes unsupported content block type(s): tool_use');

    expect(() => (OCRService as any).extractProviderTextResponse(
      [
        { type: 'text', text: '[{"name":"Safe Dal"}]' },
        { type: '\uFEFFtool_use', id: 'tool-1' },
      ],
      'Claude API'
    )).toThrow('Claude API response content block type must not include unsafe control characters');

    expect(() => (OCRService as any).extractProviderTextResponse(
      [
        { type: 'text', text: '[{"name":"Safe Dal"}]' },
        { type: 'tool_use\uFEFF', id: 'tool-1' },
      ],
      'Claude API'
    )).toThrow('Claude API response content block type must not include unsafe control characters');

    expect(() => (OCRService as any).extractProviderTextResponse(
      [
        {
          type: 'text',
          text: '[{"name":"Safe Dal"}]',
          provider_trace_id: 'trace-1',
        },
      ],
      'Claude API'
    )).toThrow('Claude API response text block includes unsupported field(s): provider_trace_id');

    expect(() => (OCRService as any).extractProviderTextResponse(
      [
        {
          type: 'text',
          text: '[{"name":"Safe Dal"}]',
          '\uFEFFprovider_trace_id': 'trace-1',
        },
      ],
      'Claude API'
    )).toThrow('Claude API response text block field names must not include unsafe control characters');

    expect(() => (OCRService as any).extractProviderTextResponse(
      [
        { type: 'text', text: '[{"name":"Safe Dal"}]' },
        { type: 'text', text: '[{"provider_trace_id":"trace-1"}]' },
      ],
      'Claude API'
    )).toThrow('Claude API response must include exactly one text block');

    expect(() => (OCRService as any).extractProviderTextResponse(
      [{ type: 'text', text: 'provider\u0000payload' }],
      'Claude API'
    )).toThrow('Claude API response text must not include unsafe control characters');

    expect(() => (OCRService as any).extractProviderTextResponse(
      [{ type: 'text', text: 'provider\u202Epayload' }],
      'Claude API'
    )).toThrow('Claude API response text must not include unsafe control characters');

    expect(() => (OCRService as any).extractProviderTextResponse(
      [{ type: 'text', text: '\uFEFF[{"name":"Safe Dal"}]' }],
      'Claude API'
    )).toThrow('Claude API response text must not include unsafe control characters');
  });

  it('normalizes the single trusted provider text block before JSON parsing', () => {
    expect((OCRService as any).extractProviderTextResponse(
      [{ type: 'text', text: ' \n [{"name":"Safe Dal"}] \t ' }],
      'Claude API'
    )).toBe('[{"name":"Safe Dal"}]');
  });

  it('rejects provider variable-price rows before returning import candidates', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
      {
        name: 'Lobster Market Price',
        price_cents: 20000,
        category: 'main_course',
        allergens: ['shellfish'],
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 88,
      },
      {
        name: 'Seasonal Crab',
        description: 'ask server for today price',
        price_cents: 30000,
        category: 'main_course',
        allergens: ['shellfish'],
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 87,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Dal',
        price_cents: 9900,
      }),
    ]);
  });

  it('rejects provider rows that still contain explicit price evidence in dish text', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
      {
        name: 'Chicken 65',
        price_cents: 18000,
        category: 'appetizer',
        allergens: [],
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 88,
      },
      {
        name: 'Idli ₹40 / Vada ₹50',
        price_cents: 4000,
        category: 'appetizer',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 88,
      },
      {
        name: 'Samosa',
        description: 'provider left alternate price Rs 20 in description',
        price_cents: 2500,
        category: 'appetizer',
        allergens: ['gluten'],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: false,
        confidence: 87,
      },
      {
        name: 'Idli 40 Vada',
        price_cents: 5000,
        category: 'appetizer',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 86,
      },
      {
        name: 'Samosa',
        description: 'provider left alternate bare price 20 in description',
        price_cents: 2500,
        category: 'appetizer',
        allergens: ['gluten'],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: false,
        confidence: 85,
      },
      {
        name: '12 inch Garden Salad',
        description: 'serves 2',
        price_cents: 49000,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 84,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Dal',
        price_cents: 9900,
      }),
      expect.objectContaining({
        name: 'Chicken 65',
        price_cents: 18000,
      }),
      expect.objectContaining({
        name: '12 inch Garden Salad',
        price_cents: 49000,
      }),
    ]);
  });

  it('rejects malformed provider text metadata instead of laundering it into menu facts', () => {
    const oversizedProviderName = 'N'.repeat(121);
    const oversizedProviderDescription = 'D'.repeat(1001);
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Valid Curry',
        description: '  slow cooked tomato gravy  ',
        price_cents: 12900,
        category: ' Main Course ',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 87,
      },
      {
        name: 'Object Description Curry',
        description: { text: 'provider should not return objects here' },
        price_cents: 11900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 86,
      },
      {
        name: 'Array Category Curry',
        description: 'spiced gravy',
        price_cents: 10900,
        category: ['main_course'],
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 85,
      },
      {
        name: oversizedProviderName,
        description: 'provider returned a menu-sized paragraph as the item name',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 82,
      },
      {
        name: '!!! ###',
        description: 'provider returned OCR punctuation as a menu item',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 82,
      },
      {
        name: '12345',
        description: 'provider returned a menu item number without dish text',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 82,
      },
      {
        name: 'Oversized Description Curry',
        description: oversizedProviderDescription,
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 82,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Valid Curry',
        description: 'slow cooked tomato gravy',
        price_cents: 12900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 87,
      }),
    ]);
  });

  it('normalizes provider text whitespace before returning trusted menu fields', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: '  Provider\n\tDal  ',
        description: ' yellow\tlentils\nwith   cumin ',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Provider Dal',
        description: 'yellow lentils with cumin',
        price_cents: 9900,
      }),
    ]);
  });

  it('omits blank provider descriptions instead of returning empty optional fields', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Plain Dal',
        description: '   ',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
      {
        name: 'Steamed Rice',
        price_cents: 4900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 88,
      },
    ]));

    expect(dishes).toHaveLength(2);
    expect(dishes[0]).toEqual(expect.objectContaining({
      name: 'Plain Dal',
      price_cents: 9900,
    }));
    expect(dishes[0]).not.toHaveProperty('description');
    expect(dishes[1]).toEqual(expect.objectContaining({
      name: 'Steamed Rice',
      price_cents: 4900,
    }));
    expect(dishes[1]).not.toHaveProperty('description');
  });

  it('extracts the first valid provider JSON array without greedy bracket capture', () => {
    const dishes = (OCRService as any).parseExtractedJSON(`
      Provider preamble [not-json metadata].
      [
        {
          "name": "Safe Dal",
          "price_cents": 9900,
          "category": "main_course",
          "allergens": [],
          "is_vegetarian": true,
          "is_vegan": true,
          "is_gluten_free": true,
          "confidence": 89
        }
      ]
      Provider footer [audit-note].
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      }),
    ]);
  });

  it('skips valid provider metadata arrays before the first trusted menu array', () => {
    const dishes = (OCRService as any).parseExtractedJSON(`
      Provider diagnostics: ["trace", "not-menu-data"]
      Provider confidence buckets: [1, 2, 3]
      [
        {
          "name": "Trusted Chaat",
          "description": "topped with curd",
          "price_cents": 6900,
          "category": "appetizer",
          "allergens": ["dairy"],
          "is_vegetarian": true,
          "is_vegan": false,
          "is_gluten_free": true,
          "confidence": 90
        }
      ]
    `);

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Trusted Chaat',
        price_cents: 6900,
        category: 'appetizer',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 90,
      }),
    ]);
  });

  it('rejects unknown provider categories instead of persisting hallucinated labels', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Safe Lassi',
        price_cents: 7900,
        category: ' beverage ',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 91,
      },
      {
        name: 'Mystery Curry',
        price_cents: 11900,
        category: 'provider-special-unknown-bucket',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 86,
      },
      {
        name: 'Fallback Roti',
        price_cents: 4900,
        category: '   ',
        allergens: ['gluten'],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: false,
        confidence: 84,
      },
      {
        name: 'Alias Samosa',
        description: 'crispy wheat snack',
        price_cents: 3900,
        category: 'Starters',
        allergens: ['gluten'],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: false,
        confidence: 83,
      },
      {
        name: 'Alias Thali',
        price_cents: 15900,
        category: 'mains',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 82,
      },
      {
        name: 'Alias Juice',
        price_cents: 6900,
        category: 'Drinks',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 81,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Lassi',
        price_cents: 7900,
        category: 'beverage',
        allergens: ['dairy'],
      }),
      expect.objectContaining({
        name: 'Fallback Roti',
        price_cents: 4900,
        category: 'other',
        allergens: ['gluten'],
      }),
      expect.objectContaining({
        name: 'Alias Samosa',
        price_cents: 3900,
        category: 'appetizer',
      }),
      expect.objectContaining({
        name: 'Alias Thali',
        price_cents: 15900,
        category: 'main_course',
      }),
      expect.objectContaining({
        name: 'Alias Juice',
        price_cents: 6900,
        category: 'beverage',
      }),
    ]);
  });

  it('rejects provider allergen labels without matching dish text evidence', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
      {
        name: 'House Dal',
        description: 'slow cooked lentils with cumin',
        price_cents: 11900,
        category: 'main_course',
        allergens: ['nuts'],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 88,
      },
      {
        name: 'Cashew Korma',
        description: 'cashew curry with cream',
        price_cents: 13900,
        category: 'main_course',
        allergens: ['nuts', 'dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 87,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Dal',
        price_cents: 9900,
        allergens: [],
      }),
      expect.objectContaining({
        name: 'Cashew Korma',
        price_cents: 13900,
        allergens: ['nuts', 'dairy'],
      }),
    ]);
  });

  it('rejects inconsistent provider dietary flags before returning import candidates', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
      {
        name: 'Impossible Vegan Paneer',
        price_cents: 12900,
        category: 'main_course',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 88,
      },
      {
        name: 'Impossible Vegan Chicken',
        price_cents: 14900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: false,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 87,
      },
      {
        name: 'Impossible Gluten Free Roti',
        price_cents: 5900,
        category: 'bread',
        allergens: ['gluten'],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 86,
      },
      {
        name: 'Impossible Gluten Free Naan',
        price_cents: 6900,
        category: 'bread',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 85,
      },
      {
        name: 'Impossible Vegan Paneer Tikka',
        price_cents: 10900,
        category: 'appetizer',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 84,
      },
      {
        name: 'Impossible Vegan Butter Naan',
        price_cents: 7900,
        category: 'bread',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: false,
        confidence: 83,
      },
      {
        name: 'Breakfast Roll',
        description: 'provider omitted the egg word from text but included allergen evidence',
        price_cents: 8900,
        category: 'appetizer',
        allergens: ['eggs'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 82,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
      }),
    ]);
  });

  it('rejects provider vegetarian claims that contradict animal-product dish text', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Safe Paneer Tikka',
        price_cents: 9900,
        category: 'appetizer',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 89,
      },
      {
        name: 'Vegetarian Chicken Curry',
        description: 'provider marked this chicken curry as vegetarian',
        price_cents: 12900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 88,
      },
      {
        name: 'Vegan Egg Roll',
        price_cents: 6900,
        category: 'appetizer',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 87,
      },
      {
        name: 'Vegetarian Crab Soup',
        price_cents: 14900,
        category: 'main_course',
        allergens: ['shellfish'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 86,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Paneer Tikka',
        price_cents: 9900,
        category: 'appetizer',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: false,
      }),
    ]);
  });

  it('rejects provider rows where a numbered dish name is echoed as the price', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
      {
        name: 'Chicken 65',
        price_cents: 6500,
        category: 'main_course',
        allergens: [],
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 88,
      },
      {
        name: 'Gobi 65',
        price_cents: 6500,
        category: 'appetizer',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 87,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Dal',
        price_cents: 9900,
      }),
    ]);
  });

  it('deduplicates repeated provider JSON dishes without dropping distinct category entries', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Samosa',
        description: 'Crispy wheat pastry',
        price_cents: 2000,
        category: 'appetizer',
        allergens: ['gluten'],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: false,
        confidence: 91,
      },
      {
        name: '  samosa  ',
        description: 'Repeated provider row',
        price_cents: 2000,
        category: ' appetizer ',
        allergens: ['gluten'],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: false,
        confidence: 87,
      },
      {
        name: 'Samosa',
        description: 'Beverage section duplicate should remain distinct',
        price_cents: 2000,
        category: 'beverage',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 83,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Samosa',
        description: 'Crispy wheat pastry',
        price_cents: 2000,
        category: 'appetizer',
      }),
      expect.objectContaining({
        name: 'Samosa',
        description: 'Beverage section duplicate should remain distinct',
        price_cents: 2000,
        category: 'beverage',
      }),
    ]);
  });

  it('rejects provider rows with conflicting structured prices for the same dish identity', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
      {
        name: 'Samosa',
        description: 'Crispy wheat pastry',
        price_cents: 2500,
        category: 'appetizer',
        allergens: ['gluten'],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: false,
        confidence: 92,
      },
      {
        name: '  samosa  ',
        description: 'crispy   wheat pastry',
        price_cents: 3000,
        category: 'APPETIZER',
        allergens: ['gluten'],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: false,
        confidence: 94,
      },
      {
        name: 'Mango Lassi',
        description: 'Small',
        price_cents: 5000,
        category: 'beverage',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 88,
      },
      {
        name: 'Mango Lassi',
        description: 'Large',
        price_cents: 7000,
        category: 'beverage',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 87,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Dal',
        price_cents: 9900,
      }),
      expect.objectContaining({
        name: 'Mango Lassi',
        description: 'Small',
        price_cents: 5000,
      }),
      expect.objectContaining({
        name: 'Mango Lassi',
        description: 'Large',
        price_cents: 7000,
      }),
    ]);
  });

  it('deduplicates provider JSON dishes by keeping the strongest trusted evidence', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Masala Dosa',
        price_cents: 8000,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 55,
      },
      {
        name: '  Masala   Dosa ',
        description: 'crispy rice crepe with potato filling',
        price_cents: 8000,
        category: ' main course ',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 93,
      },
      {
        name: 'Masala Dosa',
        description: 'weaker duplicate should not replace stronger evidence',
        price_cents: 8000,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 88,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Masala Dosa',
        description: 'crispy rice crepe with potato filling',
        price_cents: 8000,
        category: 'main_course',
        confidence: 93,
      }),
    ]);
  });

  it('deduplicates provider JSON dishes by preferring richer metadata when confidence and description tie', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Paneer Tikka',
        description: 'smoky clay-oven paneer',
        price_cents: 12000,
        category: 'appetizer',
        allergens: [],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 88,
      },
      {
        name: 'Paneer Tikka',
        description: 'smoky clay-oven paneer',
        price_cents: 12000,
        category: 'appetizer',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 88,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Paneer Tikka',
        description: 'smoky clay-oven paneer',
        price_cents: 12000,
        category: 'appetizer',
        allergens: ['dairy'],
        confidence: 88,
      }),
    ]);
  });

  it('deduplicates provider JSON dishes by preserving richer safety evidence over confidence alone', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Paneer Tikka',
        description: 'smoky clay-oven paneer',
        price_cents: 12000,
        category: 'appetizer',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 96,
      },
      {
        name: 'Paneer Tikka',
        description: 'smoky clay-oven paneer',
        price_cents: 12000,
        category: 'appetizer',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 88,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Paneer Tikka',
        description: 'smoky clay-oven paneer',
        price_cents: 12000,
        category: 'appetizer',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 88,
      }),
    ]);
  });

  it('rejects provider duplicate dish identities with conflicting dietary evidence', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
      {
        name: 'House Curry',
        description: 'chef special curry',
        price_cents: 12900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 91,
      },
      {
        name: '  House   Curry ',
        description: 'chef   special curry',
        price_cents: 12900,
        category: ' main course ',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 92,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Dal',
        price_cents: 9900,
      }),
    ]);
  });

  it('rejects provider duplicate dish identities with conflicting non-empty allergen evidence', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
      {
        name: 'Paneer Tikka',
        description: 'smoky clay-oven paneer',
        price_cents: 12000,
        category: 'appetizer',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 91,
      },
      {
        name: '  Paneer   Tikka ',
        description: 'smoky   clay-oven paneer',
        price_cents: 12000,
        category: ' appetizer ',
        allergens: ['nuts'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 92,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Dal',
        price_cents: 9900,
      }),
    ]);
  });

  it('rejects provider duplicate dedupe keys with description-drift safety conflicts', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
      {
        name: 'Paneer Tikka',
        description: 'smoky paneer with dairy cream',
        price_cents: 12000,
        category: 'appetizer',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 91,
      },
      {
        name: '  Paneer   Tikka ',
        description: 'spiced paneer with nuts',
        price_cents: 12000,
        category: ' appetizer ',
        allergens: ['nuts'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 92,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Dal',
        price_cents: 9900,
      }),
    ]);
  });

  it('rejects provider duplicate dish identities with conflicting category evidence', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
      {
        name: 'Samosa',
        description: 'crispy wheat pastry',
        price_cents: 2000,
        category: 'appetizer',
        allergens: ['gluten'],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: false,
        confidence: 91,
      },
      {
        name: '  Samosa ',
        description: 'crispy   wheat pastry',
        price_cents: 2000,
        category: 'main_course',
        allergens: ['gluten'],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: false,
        confidence: 92,
      },
    ]));

    expect(dishes).toEqual([
      expect.objectContaining({
        name: 'Safe Dal',
        price_cents: 9900,
      }),
    ]);
  });

  it('rejects non-object provider JSON entries before trusting any import candidates', () => {
    expect(() => (OCRService as any).buildProviderExtractionResult(
      [
        {
          name: 'Safe Dal',
          price_cents: 9900,
          category: 'main_course',
          allergens: [],
          is_vegetarian: true,
          is_vegan: true,
          is_gluten_free: true,
          confidence: 89,
        },
        'raw provider hallucination',
      ],
      42,
      'provider contaminated text',
      'No trusted menu items could be extracted from the OCR provider response.'
    )).toThrow('OCR provider dish row 2 must be an object');

    expect((OCRService as any).parseExtractedJSON(JSON.stringify([
      null,
      'raw provider hallucination',
      ['array is not a dish'],
      {
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
    ]))).toEqual([]);
  });

  it('reports provider OCR extraction as failed when no trusted dishes survive validation', () => {
    const emptyDishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Subtotal',
        price_cents: 50000,
        category: 'other',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 90,
      },
      {
        name: 'Free Soup',
        price_cents: 0,
        category: 'appetizer',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 90,
      },
      {
        name: 'Maybe Paneer',
        price_cents: 12500,
        category: 'appetizer',
        allergens: ['dairy'],
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: true,
        confidence: 49,
      },
    ]));

    expect((OCRService as any).buildProviderExtractionResult(
      emptyDishes,
      42,
      'provider raw text',
      'No trusted menu items could be extracted from the OCR provider response.'
    )).toEqual({
      dishes: [],
      total_extracted: 0,
      extraction_time_ms: 42,
      success: false,
      error: 'No trusted menu items could be extracted from the OCR provider response.',
      raw_text: 'provider raw text',
    });

    const validDishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
    ]));

    expect((OCRService as any).buildProviderExtractionResult(
      validDishes,
      43,
      'provider valid text',
      'No trusted menu items could be extracted from the OCR provider response.'
    )).toEqual({
      dishes: validDishes,
      total_extracted: 1,
      extraction_time_ms: 43,
      success: true,
      raw_text: 'provider valid text',
    });
    expect((OCRService as any).buildProviderExtractionResult(
      validDishes,
      43,
      'provider valid text',
      'No trusted menu items could be extracted from the OCR provider response.'
    )).not.toHaveProperty('error');
  });

  it('rejects unsafe provider extraction timing before returning OCR audit output', () => {
    const validDishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
    ]));

    for (const unsafeExtractionTimeMs of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => (OCRService as any).buildProviderExtractionResult(
        validDishes,
        unsafeExtractionTimeMs,
        'provider valid text',
        'No trusted menu items could be extracted from the OCR provider response.'
      )).toThrow('OCR provider extraction_time_ms must be a non-negative safe integer');
    }
  });

  it('omits oversized provider raw text without discarding trusted dishes', () => {
    const validDishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
    ]));

    const result = (OCRService as any).buildProviderExtractionResult(
      validDishes,
      44,
      'x'.repeat(50 * 1024 + 1),
      'No trusted menu items could be extracted from the OCR provider response.'
    );

    expect(result).toEqual({
      dishes: validDishes,
      total_extracted: 1,
      extraction_time_ms: 44,
      success: true,
    });
    expect(result).not.toHaveProperty('error');
    expect(result).not.toHaveProperty('raw_text');
  });

  it('omits blank provider raw text without discarding trusted dishes', () => {
    const validDishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
    ]));

    const result = (OCRService as any).buildProviderExtractionResult(
      validDishes,
      45,
      ' \n\t ',
      'No trusted menu items could be extracted from the OCR provider response.'
    );

    expect(result).toEqual({
      dishes: validDishes,
      total_extracted: 1,
      extraction_time_ms: 45,
      success: true,
    });
    expect(result).not.toHaveProperty('error');
    expect(result).not.toHaveProperty('raw_text');
  });

  it('rejects unsupported provider result fields before returning OCR audit output', () => {
    expect(() => (OCRService as any).buildProviderExtractionResult(
      [
        {
          name: 'Provider Dal',
          price_cents: 9900,
          category: 'main_course',
          allergens: [],
          is_vegetarian: true,
          is_vegan: true,
          is_gluten_free: true,
          confidence: 89,
          provider_trace_id: 'trace-123',
        },
      ],
      46,
      'provider contaminated text',
      'No trusted menu items could be extracted from the OCR provider response.'
    )).toThrow('OCR provider dish row 1 include unsupported field(s): provider_trace_id');

    expect(() => (OCRService as any).buildProviderExtractionResult(
      [
        {
          name: 'Provider Dal',
          price_cents: 9900,
          category: 'main_course',
          allergens: [],
          is_vegetarian: true,
          is_vegan: true,
          is_gluten_free: true,
          confidence: 89,
          'provider_trace_id\uFEFF': 'trace-123',
        },
      ],
      47,
      'provider contaminated text',
      'No trusted menu items could be extracted from the OCR provider response.'
    )).toThrow('OCR provider dish row 1 field names must not include unsafe control characters');
  });

  it('rejects oversized provider OCR responses before scanning for JSON arrays', () => {
    const validProviderArray = JSON.stringify([
      {
        name: 'Safe Dal',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
      },
    ]);
    const oversizedProviderResponse = `${'x'.repeat(50 * 1024 + 1)}${validProviderArray}`;

    expect((OCRService as any).parseExtractedJSON(oversizedProviderResponse)).toEqual([]);
  });

  it('rejects unknown provider fields before trusting any import candidates from the response', () => {
    const dishes = (OCRService as any).parseExtractedJSON(JSON.stringify([
      {
        name: 'Provider Dal',
        description: 'Yellow lentils',
        price_cents: 9900,
        category: 'main_course',
        allergens: [],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: true,
        confidence: 89,
        provider_trace_id: 'trace-123',
        moderation_notes: { source: 'provider hallucination' },
        nested_items: [{ name: 'should not be laundered' }],
      },
      {
        name: 'Trusted Samosa',
        price_cents: 5000,
        price_text: '₹50',
        category: 'appetizer',
        allergens: ['gluten'],
        is_vegetarian: true,
        is_vegan: true,
        is_gluten_free: false,
        confidence: 88,
      },
    ]));

    expect(dishes).toEqual([]);
  });
});
