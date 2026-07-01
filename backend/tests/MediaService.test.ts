import { describe, expect, it } from '@jest/globals';
import { MediaService } from '../src/services/MediaService.js';

describe('MediaService upload metadata boundary', () => {
  it('trims safe upload filename and MIME type metadata', () => {
    const service = new MediaService();

    expect(service.normalizeUploadMetadata(' menu-photo.jpg ', ' image/jpeg ')).toEqual({
      filename: 'menu-photo.jpg',
      mimeType: 'image/jpeg',
    });
  });

  it('rejects blank upload filename metadata before multipart trust', () => {
    const service = new MediaService();

    expect(() => service.normalizeUploadMetadata('   ', 'image/jpeg')).toThrow('Upload file name is required');
  });

  it('rejects unsafe upload filename controls before multipart trust', () => {
    const service = new MediaService();

    expect(() => service.normalizeUploadMetadata('menu\u202Ephoto.jpg', 'image/jpeg')).toThrow(
      'Upload file name contains unsafe control characters'
    );
  });

  it('rejects multipart header breaking upload filename characters', () => {
    const service = new MediaService();

    expect(() => service.normalizeUploadMetadata('menu"photo.jpg', 'image/jpeg')).toThrow(
      'Upload file name contains unsupported multipart header characters'
    );
  });

  it('rejects blank upload MIME metadata before file validation', () => {
    const service = new MediaService();

    expect(() => service.normalizeUploadMetadata('menu-photo.jpg', '   ')).toThrow('Upload MIME type is required');
  });

  it('rejects unsafe upload MIME controls before file validation', () => {
    const service = new MediaService();

    expect(() => service.normalizeUploadMetadata('menu-photo.jpg', 'image/jpeg\uFEFF')).toThrow(
      'Upload MIME type contains unsafe control characters'
    );
  });

  it('rejects malformed upload MIME metadata before file validation', () => {
    const service = new MediaService();

    expect(() => service.normalizeUploadMetadata('menu-photo.jpg', 'image')).toThrow('Upload MIME type is invalid');
  });

  it('normalizes MIME metadata before supported image type validation', () => {
    const service = new MediaService();

    expect(service.validateImageFile(' image/png ', 128)).toBe('image/png');
  });
});
