import { Client as MinioClient } from 'minio';
import crypto from 'crypto';
import path from 'path';

export interface UploadMetadata {
  filename: string;
  mimeType: string;
}

const UNSAFE_UPLOAD_METADATA_CONTROLS = /[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;
const FORBIDDEN_UPLOAD_FILENAME_CHARACTERS = /["\\/:;]/;
const FORBIDDEN_UPLOAD_MIME_CHARACTERS = /["\\;,]/;

export class MediaService {
  private minioClient: MinioClient;
  private bucketName: string;

  constructor() {
    // Security: Require S3/MinIO credentials - no defaults for production
    const accessKey = process.env.S3_ACCESS_KEY;
    const secretKey = process.env.S3_SECRET_KEY;

    if (!accessKey || !secretKey) {
      // Allow defaults only in development mode
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CRITICAL SECURITY ERROR: S3_ACCESS_KEY and S3_SECRET_KEY must be set in production');
      }
      console.warn('WARNING: Using default S3 credentials. This is only safe in development!');
    }

    const endpoint = process.env.S3_ENDPOINT || 'localhost:9000';
    const [host, portStr] = endpoint.replace(/^https?:\/\//, '').split(':');
    const port = portStr ? parseInt(portStr, 10) : 9000;

    this.minioClient = new MinioClient({
      endPoint: host,
      port,
      useSSL: process.env.S3_USE_SSL === 'true',
      accessKey: accessKey || 'minioadmin',
      secretKey: secretKey || 'minioadmin',
    });

    this.bucketName = process.env.S3_BUCKET || 'menumaker-images';
  }

  async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');

        // Set bucket policy to allow public read access
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        };

        await this.minioClient.setBucketPolicy(
          this.bucketName,
          JSON.stringify(policy)
        );
      }
    } catch (error) {
      console.error('Error ensuring bucket exists:', error);
      throw error;
    }
  }

  private generateFileName(originalName: string): string {
    const ext = path.extname(originalName);
    const hash = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    return `${timestamp}-${hash}${ext}`;
  }

  async uploadFile(
    file: Buffer,
    originalName: string,
    mimeType: string,
    ownerUserId: string
  ): Promise<string> {
    try {
      const metadata = this.normalizeUploadMetadata(originalName, mimeType);
      await this.ensureBucketExists();

      const fileName = this.generateFileName(metadata.filename);

      // Upload file to MinIO
      await this.minioClient.putObject(
        this.bucketName,
        fileName,
        file,
        file.length,
        {
          'Content-Type': metadata.mimeType,
          'x-amz-meta-owner-user-id': ownerUserId,
        }
      );

      // Generate public URL
      const url = this.getPublicUrl(fileName);

      return url;
    } catch (error) {
      const uploadError = new Error('Failed to upload file') as Error & {
        statusCode: number;
        code: string;
        details: unknown;
      };
      uploadError.statusCode = 500;
      uploadError.code = 'UPLOAD_FAILED';
      uploadError.details = error;
      throw uploadError;
    }
  }

  private getPublicUrl(fileName: string): string {
    const endpoint = process.env.S3_ENDPOINT || 'localhost:9000';
    const useSSL = process.env.S3_USE_SSL === 'true';
    const protocol = useSSL ? 'https' : 'http';

    return `${protocol}://${endpoint}/${this.bucketName}/${fileName}`;
  }

  async deleteFile(fileUrl: string, userId: string): Promise<void> {
    const fileName = this.extractOwnedFileName(fileUrl);
    const stat = await this.minioClient.statObject(this.bucketName, fileName);
    const metadata = (stat as unknown as { metaData?: Record<string, string>; metadata?: Record<string, string> }).metaData
      ?? (stat as unknown as { metadata?: Record<string, string> }).metadata
      ?? {};

    const ownerUserId = metadata['owner-user-id']
      ?? metadata['x-amz-meta-owner-user-id']
      ?? metadata['Owner-User-Id'];

    if (!ownerUserId || ownerUserId !== userId) {
      const error = new Error('File does not belong to the authenticated user') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 403;
      error.code = 'MEDIA_OWNERSHIP_MISMATCH';
      throw error;
    }

    await this.minioClient.removeObject(this.bucketName, fileName);
  }

  private extractOwnedFileName(fileUrl: string): string {
    const expectedPrefix = this.getPublicUrl('');
    if (!fileUrl.startsWith(expectedPrefix)) {
      const error = new Error('Invalid file URL: does not belong to this storage bucket') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 400;
      error.code = 'INVALID_MEDIA_URL';
      throw error;
    }

    const fileName = fileUrl.replace(expectedPrefix, '');
    if (!fileName || fileName.includes('..') || fileName.includes('/')) {
      const error = new Error('Invalid file URL: potential path traversal detected') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 400;
      error.code = 'INVALID_MEDIA_URL';
      throw error;
    }

    return fileName;
  }

  normalizeUploadMetadata(originalName: string, mimeType: string): UploadMetadata {
    return {
      filename: this.normalizeUploadFileName(originalName),
      mimeType: this.normalizeUploadMimeType(mimeType),
    };
  }

  private normalizeUploadFileName(originalName: string): string {
    if (UNSAFE_UPLOAD_METADATA_CONTROLS.test(originalName)) {
      this.throwInvalidUploadMetadata('Upload file name contains unsafe control characters');
    }

    const filename = originalName.trim();
    if (!filename) {
      this.throwInvalidUploadMetadata('Upload file name is required');
    }

    if (FORBIDDEN_UPLOAD_FILENAME_CHARACTERS.test(filename)) {
      this.throwInvalidUploadMetadata('Upload file name contains unsupported multipart header characters');
    }

    return filename;
  }

  private normalizeUploadMimeType(mimeType: string): string {
    if (UNSAFE_UPLOAD_METADATA_CONTROLS.test(mimeType)) {
      this.throwInvalidUploadMetadata('Upload MIME type contains unsafe control characters');
    }

    const normalizedMimeType = mimeType.trim();
    if (!normalizedMimeType) {
      this.throwInvalidUploadMetadata('Upload MIME type is required');
    }

    if (/\s/.test(normalizedMimeType) || FORBIDDEN_UPLOAD_MIME_CHARACTERS.test(normalizedMimeType)) {
      this.throwInvalidUploadMetadata('Upload MIME type contains unsafe control characters');
    }

    const mimeParts = normalizedMimeType.split('/');
    if (mimeParts.length !== 2 || !mimeParts[0] || !mimeParts[1]) {
      this.throwInvalidUploadMetadata('Upload MIME type is invalid');
    }

    return normalizedMimeType;
  }

  private throwInvalidUploadMetadata(message: string): never {
    const error = new Error(message) as Error & {
      statusCode: number;
      code: string;
    };
    error.statusCode = 400;
    error.code = 'INVALID_UPLOAD_METADATA';
    throw error;
  }

  validateImageFile(mimeType: string, fileSize: number): string {
    // Validate mime type
    const normalizedMimeType = this.normalizeUploadMimeType(mimeType);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(normalizedMimeType)) {
      const error = new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 400;
      error.code = 'INVALID_FILE_TYPE';
      throw error;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (fileSize > maxSize) {
      const error = new Error('File size exceeds maximum limit of 5MB') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 400;
      error.code = 'FILE_TOO_LARGE';
      throw error;
    }

    return normalizedMimeType;
  }
}
