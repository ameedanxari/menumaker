import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { AppDataSource } from '../src/config/database';
import { TranslationService } from '../src/services/TranslationService';

describe('TranslationService i18n capability evidence', () => {
  let settingsRepo: any;

  beforeEach(() => {
    settingsRepo = { findOne: jest.fn(), save: jest.fn(async (record) => record) };
    AppDataSource.getRepository = jest.fn(() => settingsRepo) as any;
  });

  it('falls back to the default locale when no business settings exist', async () => {
    settingsRepo.findOne.mockResolvedValue(null);

    const result = await new TranslationService().getBusinessLocaleSettings('business-1');

    expect(result).toEqual({
      default_locale: 'en',
      supported_locales: ['en'],
      rtl_enabled: false,
    });
  });

  it('returns translated dish content with English fallback', () => {
    const service = new TranslationService();
    const dish: any = {
      name: 'Masala Dosa',
      description: 'Crispy rice crepe',
      name_translations: { hi: 'मसाला डोसा' },
      description_translations: {},
    };

    expect(service.getTranslatedDishName(dish, 'hi')).toBe('मसाला डोसा');
    expect(service.getTranslatedDishDescription(dish, 'hi')).toBe('Crispy rice crepe');
  });

  it('rejects unsafe dish translation locale keys before persisting translation JSON', async () => {
    settingsRepo.findOne.mockResolvedValue({
      id: 'dish-1',
      name_translations: {},
      description_translations: {},
    });

    await expect(
      new TranslationService().updateDishTranslations('dish-1', {
        name: { ['hi\u200D']: 'मसाला डोसा' } as any,
      })
    ).rejects.toThrow(
      'Dish name translations locale field names must not include unsafe control characters'
    );
    expect(settingsRepo.save).not.toHaveBeenCalled();
  });

  it('rejects unsafe category translation locale keys before persisting translation JSON', async () => {
    settingsRepo.findOne.mockResolvedValue({
      id: 'category-1',
      name_translations: {},
      description_translations: {},
    });

    await expect(
      new TranslationService().updateCategoryTranslations('category-1', {
        description: { ['ta\u202E']: 'தென்னிந்திய சிற்றுண்டி' } as any,
      })
    ).rejects.toThrow(
      'Category description translations locale field names must not include unsafe control characters'
    );
    expect(settingsRepo.save).not.toHaveBeenCalled();
  });
});
