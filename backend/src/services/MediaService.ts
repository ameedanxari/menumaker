import { Client as MinioClient } from 'minio';
import crypto from 'crypto';
import path from 'path';

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
    mimeType: string
  ): Promise<string> {
    try {
      await this.ensureBucketExists();

      const fileName = this.generateFileName(originalName);

      // Upload file to MinIO
      await this.minioClient.putObject(
        this.bucketName,
        fileName,
        file,
        file.length,
        {
          'Content-Type': mimeType,
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
    try {
      // Security: Validate that the URL belongs to this bucket and is properly formatted
      const expectedPrefix = this.getPublicUrl('');
      if (!fileUrl.startsWith(expectedPrefix)) {
        throw new Error('Invalid file URL: does not belong to this storage bucket');
      }

      // Extract filename from URL (after bucket name)
      const fileName = fileUrl.replace(expectedPrefix, '');
      if (!fileName || fileName.includes('..') || fileName.includes('/')) {
        throw new Error('Invalid file URL: potential path traversal detected');
      }

      // TODO: Add database check to verify file ownership by userId
      // For now, we validate the URL format to prevent path traversal

      await this.minioClient.removeObject(this.bucketName, fileName);
    } catch (error) {
      console.error('Error deleting file:', error);
      // Don't throw error - file might already be deleted
    }
  }

  validateImageFile(mimeType: string, fileSize: number): void {
    // Validate mime type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(mimeType)) {
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
  }
}
