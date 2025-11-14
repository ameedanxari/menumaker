# File Upload Pipeline Specification

**Version**: 1.0
**Phase**: Phase 1 (MVP)
**Last Updated**: 2025-11-12

---

## Overview

MenuMaker requires image uploads for:
- **Dish images**: Photos of food items (max 2MB per image)
- **Business logos**: Seller branding (max 1MB)
- **Menu preview images**: Auto-generated social sharing images

This specification defines the complete file upload pipeline including image processing, storage, validation, and CDN delivery.

---

## Image Processing Requirements

### Supported File Types

```typescript
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',  // Apple devices
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];
```

### Image Size Limits

| Image Type | Max Size | Max Dimensions | Compression Quality |
|------------|----------|----------------|---------------------|
| Dish Image | 2 MB     | 2000x2000 px   | 85% (JPEG/WebP)     |
| Logo       | 1 MB     | 1000x1000 px   | 90% (JPEG/WebP)     |
| Menu Preview | 500 KB  | 1200x630 px    | 85% (JPEG/WebP)     |

### Image Processing Pipeline (Sharp.js)

```typescript
// src/services/image-processing.service.ts
import sharp from 'sharp';

interface ImageProcessingOptions {
  type: 'dish' | 'logo' | 'menu_preview';
  maxWidth: number;
  maxHeight: number;
  quality: number;
}

export class ImageProcessingService {
  private readonly options: Record<string, ImageProcessingOptions> = {
    dish: {
      type: 'dish',
      maxWidth: 2000,
      maxHeight: 2000,
      quality: 85
    },
    logo: {
      type: 'logo',
      maxWidth: 1000,
      maxHeight: 1000,
      quality: 90
    },
    menu_preview: {
      type: 'menu_preview',
      maxWidth: 1200,
      maxHeight: 630,
      quality: 85
    }
  };

  async processImage(
    buffer: Buffer,
    type: 'dish' | 'logo' | 'menu_preview'
  ): Promise<{ webp: Buffer; jpeg: Buffer; metadata: sharp.Metadata }> {
    const config = this.options[type];

    // Get original metadata
    const metadata = await sharp(buffer).metadata();

    // Resize and optimize for WebP (modern browsers)
    const webpBuffer = await sharp(buffer)
      .resize(config.maxWidth, config.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: config.quality })
      .toBuffer();

    // Fallback JPEG for older browsers
    const jpegBuffer = await sharp(buffer)
      .resize(config.maxWidth, config.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: config.quality, mozjpeg: true })
      .toBuffer();

    return { webp: webpBuffer, jpeg: jpegBuffer, metadata };
  }

  async generateThumbnail(buffer: Buffer, size: number = 200): Promise<Buffer> {
    return sharp(buffer)
      .resize(size, size, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();
  }

  async validateImage(buffer: Buffer): Promise<{ valid: boolean; error?: string }> {
    try {
      const metadata = await sharp(buffer).metadata();

      // Check if it's a valid image
      if (!metadata.format) {
        return { valid: false, error: 'Invalid image format' };
      }

      // Check minimum dimensions (avoid tiny images)
      if (metadata.width < 100 || metadata.height < 100) {
        return { valid: false, error: 'Image too small (min 100x100 px)' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Failed to process image' };
    }
  }
}
```

---

## Storage Architecture

### Local Development (MinIO)

MinIO provides S3-compatible local storage for development.

**Docker Compose Configuration:**
```yaml
services:
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"  # Console UI
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

volumes:
  minio_data:
```

**MinIO Bucket Setup Script:**
```bash
#!/bin/bash
# scripts/setup-minio.sh

# Create buckets
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/menumaker-dev-dishes
mc mb local/menumaker-dev-logos
mc mb local/menumaker-dev-menus

# Set public read policy for public assets
mc anonymous set download local/menumaker-dev-dishes
mc anonymous set download local/menumaker-dev-logos
mc anonymous set download local/menumaker-dev-menus
```

### Production (AWS S3)

**Bucket Structure:**
```
menumaker-prod-dishes/
  ├── {business_id}/
  │   ├── {dish_id}/
  │   │   ├── original.jpg
  │   │   ├── optimized.webp
  │   │   ├── optimized.jpg
  │   │   └── thumbnail.webp

menumaker-prod-logos/
  ├── {business_id}/
  │   ├── logo.webp
  │   └── logo.jpg

menumaker-prod-menus/
  ├── {menu_id}/
  │   ├── preview.webp
  │   └── preview.jpg
```

**S3 Bucket Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::menumaker-prod-dishes/*"
    }
  ]
}
```

**S3 CORS Configuration:**
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["https://menumaker.app", "https://www.menumaker.app"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

---

## Upload Flow

### Option 1: Direct Backend Upload (Phase 1 MVP)

**Endpoint:** `POST /api/v1/media/upload`

**Implementation:**
```typescript
// src/controllers/media.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

interface UploadRequest {
  file: Buffer;
  filename: string;
  mimetype: string;
  type: 'dish' | 'logo' | 'menu_preview';
  business_id: string;
  dish_id?: string;
  menu_id?: string;
}

export class MediaController {
  private s3Client: S3Client;
  private imageService: ImageProcessingService;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT, // MinIO for dev
      forcePathStyle: process.env.NODE_ENV === 'development',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!
      }
    });
    this.imageService = new ImageProcessingService();
  }

  async upload(request: FastifyRequest, reply: FastifyReply) {
    try {
      // 1. Validate file upload
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({
          error: {
            code: 'NO_FILE',
            message: 'No file uploaded'
          }
        });
      }

      // 2. Check file size
      const buffer = await data.toBuffer();
      const maxSize = data.fields.type === 'logo' ? 1024 * 1024 : 2 * 1024 * 1024;

      if (buffer.length > maxSize) {
        return reply.code(413).send({
          error: {
            code: 'FILE_TOO_LARGE',
            message: `File size exceeds ${maxSize / (1024 * 1024)}MB limit`
          }
        });
      }

      // 3. Validate image
      const validation = await this.imageService.validateImage(buffer);
      if (!validation.valid) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_IMAGE',
            message: validation.error
          }
        });
      }

      // 4. Process image
      const type = data.fields.type as 'dish' | 'logo' | 'menu_preview';
      const { webp, jpeg, metadata } = await this.imageService.processImage(buffer, type);

      // 5. Generate storage paths
      const businessId = data.fields.business_id;
      const fileId = data.fields.dish_id || data.fields.menu_id || uuidv4();
      const basePath = this.getBasePath(type, businessId, fileId);

      // 6. Upload to S3
      const bucket = this.getBucket(type);

      await Promise.all([
        this.uploadToS3(bucket, `${basePath}/optimized.webp`, webp, 'image/webp'),
        this.uploadToS3(bucket, `${basePath}/optimized.jpg`, jpeg, 'image/jpeg'),
        this.uploadToS3(bucket, `${basePath}/original.jpg`, buffer, data.mimetype)
      ]);

      // 7. Generate thumbnail for dish images
      if (type === 'dish') {
        const thumbnail = await this.imageService.generateThumbnail(buffer);
        await this.uploadToS3(bucket, `${basePath}/thumbnail.webp`, thumbnail, 'image/webp');
      }

      // 8. Return CDN URLs
      const cdnBaseUrl = process.env.CDN_BASE_URL || process.env.S3_ENDPOINT;

      return reply.code(201).send({
        id: fileId,
        urls: {
          webp: `${cdnBaseUrl}/${bucket}/${basePath}/optimized.webp`,
          jpeg: `${cdnBaseUrl}/${bucket}/${basePath}/optimized.jpg`,
          thumbnail: type === 'dish' ? `${cdnBaseUrl}/${bucket}/${basePath}/thumbnail.webp` : null
        },
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          size: buffer.length
        }
      });

    } catch (error) {
      console.error('Upload error:', error);
      return reply.code(500).send({
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to upload file'
        }
      });
    }
  }

  private getBasePath(type: string, businessId: string, fileId: string): string {
    switch (type) {
      case 'dish':
        return `${businessId}/${fileId}`;
      case 'logo':
        return `${businessId}`;
      case 'menu_preview':
        return `${fileId}`;
      default:
        throw new Error('Invalid upload type');
    }
  }

  private getBucket(type: string): string {
    const prefix = process.env.NODE_ENV === 'production' ? 'menumaker-prod' : 'menumaker-dev';
    switch (type) {
      case 'dish':
        return `${prefix}-dishes`;
      case 'logo':
        return `${prefix}-logos`;
      case 'menu_preview':
        return `${prefix}-menus`;
      default:
        throw new Error('Invalid upload type');
    }
  }

  private async uploadToS3(
    bucket: string,
    key: string,
    body: Buffer,
    contentType: string
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000' // 1 year
    });

    await this.s3Client.send(command);
  }
}
```

### Option 2: Pre-signed URL Upload (Phase 2 - Better Performance)

**Endpoint:** `POST /api/v1/media/presigned-url`

**Benefits:**
- Reduced backend load (client uploads directly to S3)
- Faster uploads (no backend proxy)
- Better for mobile apps

```typescript
// src/controllers/media.controller.ts (Phase 2)
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';

async generatePresignedUrl(request: FastifyRequest, reply: FastifyReply) {
  const { type, filename, business_id } = request.body;

  const fileId = uuidv4();
  const bucket = this.getBucket(type);
  const key = `${business_id}/${fileId}/${filename}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: 'image/jpeg', // Client must match this
  });

  const signedUrl = await getSignedUrl(this.s3Client, command, {
    expiresIn: 3600 // 1 hour
  });

  return reply.send({
    upload_url: signedUrl,
    file_id: fileId,
    expires_in: 3600
  });
}
```

---

## API Specification

### Upload Endpoint

**Request:**
```http
POST /api/v1/media/upload
Content-Type: multipart/form-data
Authorization: Bearer <access_token>

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="dish.jpg"
Content-Type: image/jpeg

<binary data>
------WebKitFormBoundary
Content-Disposition: form-data; name="type"

dish
------WebKitFormBoundary
Content-Disposition: form-data; name="business_id"

660e8400-e29b-41d4-a716-446655440000
------WebKitFormBoundary--
```

**Response (201 Created):**
```json
{
  "id": "7890abcd-1234-5678-90ab-cdef12345678",
  "urls": {
    "webp": "https://cdn.menumaker.app/dishes/660e8400/.../optimized.webp",
    "jpeg": "https://cdn.menumaker.app/dishes/660e8400/.../optimized.jpg",
    "thumbnail": "https://cdn.menumaker.app/dishes/660e8400/.../thumbnail.webp"
  },
  "metadata": {
    "width": 1920,
    "height": 1080,
    "format": "jpeg",
    "size": 245678
  }
}
```

**Error Responses:**
```typescript
// 400 Bad Request - No file
{
  "error": {
    "code": "NO_FILE",
    "message": "No file uploaded"
  }
}

// 400 Bad Request - Invalid image
{
  "error": {
    "code": "INVALID_IMAGE",
    "message": "Image too small (min 100x100 px)"
  }
}

// 413 Payload Too Large
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "File size exceeds 2MB limit"
  }
}

// 415 Unsupported Media Type
{
  "error": {
    "code": "UNSUPPORTED_FORMAT",
    "message": "Only JPEG, PNG, and WebP images are supported"
  }
}

// 500 Internal Server Error
{
  "error": {
    "code": "UPLOAD_FAILED",
    "message": "Failed to upload file"
  }
}
```

---

## Environment Variables

```bash
# Storage Configuration
S3_ENDPOINT=http://localhost:9000              # MinIO for dev, omit for prod
S3_REGION=us-east-1                            # AWS region
S3_ACCESS_KEY=minioadmin                       # AWS/MinIO access key
S3_SECRET_KEY=minioadmin                       # AWS/MinIO secret key
S3_BUCKET_DISHES=menumaker-dev-dishes          # Dish images bucket
S3_BUCKET_LOGOS=menumaker-dev-logos            # Logo images bucket
S3_BUCKET_MENUS=menumaker-dev-menus            # Menu preview images bucket

# CDN Configuration
CDN_BASE_URL=https://cdn.menumaker.app         # CloudFront URL (prod)
# For dev: CDN_BASE_URL=http://localhost:9000

# Upload Limits
MAX_DISH_IMAGE_SIZE_MB=2
MAX_LOGO_SIZE_MB=1
MAX_MENU_PREVIEW_SIZE_MB=0.5
```

---

## CDN Configuration (CloudFront - Production)

**CloudFront Distribution Settings:**
```yaml
Origin:
  DomainName: menumaker-prod-dishes.s3.us-east-1.amazonaws.com
  OriginPath: ""
  S3OriginConfig:
    OriginAccessIdentity: ""  # Use OAI for private bucket

DefaultCacheBehavior:
  TargetOriginId: S3-menumaker-prod-dishes
  ViewerProtocolPolicy: redirect-to-https
  AllowedMethods: [GET, HEAD, OPTIONS]
  CachedMethods: [GET, HEAD]
  Compress: true
  MinTTL: 0
  DefaultTTL: 86400       # 1 day
  MaxTTL: 31536000        # 1 year

CustomErrorResponses:
  - ErrorCode: 403
    ResponseCode: 404
    ResponsePagePath: /404.html
    ErrorCachingMinTTL: 300
```

**Cache Invalidation:**
```typescript
// src/services/cdn.service.ts
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';

export async function invalidateCache(paths: string[]): Promise<void> {
  const client = new CloudFrontClient({ region: 'us-east-1' });

  const command = new CreateInvalidationCommand({
    DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: Date.now().toString(),
      Paths: {
        Quantity: paths.length,
        Items: paths
      }
    }
  });

  await client.send(command);
}
```

---

## Virus Scanning (Optional - Phase 2)

For production, consider integrating ClamAV or AWS S3 malware detection.

**Docker Compose (ClamAV):**
```yaml
services:
  clamav:
    image: clamav/clamav:latest
    ports:
      - "3310:3310"
    volumes:
      - clamav_data:/var/lib/clamav

volumes:
  clamav_data:
```

**Integration:**
```typescript
import { NodeClam } from 'clamscan';

const clamscan = await new NodeClam().init({
  clamdscan: {
    host: 'localhost',
    port: 3310,
  }
});

const { isInfected, viruses } = await clamscan.scanBuffer(buffer);
if (isInfected) {
  throw new Error(`Virus detected: ${viruses.join(', ')}`);
}
```

---

## Testing Checklist

### Unit Tests
- [ ] Image validation (valid/invalid formats, sizes)
- [ ] Image processing (resize, compress, format conversion)
- [ ] Thumbnail generation
- [ ] S3 upload logic (mocked)

### Integration Tests
- [ ] Upload dish image (valid, returns URLs)
- [ ] Upload logo (valid, returns URLs)
- [ ] Upload oversized image (413 error)
- [ ] Upload invalid file type (415 error)
- [ ] Upload corrupt image (400 error)
- [ ] Verify files exist in S3/MinIO

### Performance Tests
- [ ] Upload 10 images concurrently (< 5s total)
- [ ] Process 2000x2000 image (< 1s)
- [ ] Generate thumbnail (< 200ms)

---

## Security Best Practices

1. **File Validation**:
   - ✅ Validate MIME type on server (don't trust client)
   - ✅ Validate actual file content (use Sharp to verify)
   - ✅ Enforce size limits strictly

2. **Storage Security**:
   - ✅ Use signed URLs for uploads (Phase 2)
   - ✅ Never expose S3 credentials to client
   - ✅ Set CORS policies strictly

3. **Rate Limiting**:
   - ✅ Max 10 uploads per minute per user
   - ✅ Max 100 uploads per day per business

4. **Content Moderation**:
   - ⚠️ Phase 3: Integrate AWS Rekognition or similar for NSFW detection

---

## Cost Estimation (AWS S3 + CloudFront)

**Assumptions**: 1,000 sellers, 10 dishes each, 100 orders/month per seller

| Service | Usage | Cost/Month |
|---------|-------|------------|
| S3 Storage (50 GB) | 10,000 images × 200 KB × 3 formats | $1.15 |
| S3 PUT Requests | 10,000 uploads × 3 files | $0.05 |
| CloudFront Data Transfer | 100 GB | $8.50 |
| **Total** | | **~$10/month** |

*Scales to ~$100/month at 10,000 sellers*

---

## Migration Path

### Phase 1 (MVP): Direct Backend Upload
- Simple implementation
- Good enough for < 1,000 sellers
- Backend handles all processing

### Phase 2 (Growth): Pre-signed URLs
- Better performance for mobile apps
- Reduced backend load
- Add virus scanning

### Phase 3 (Scale): Advanced Features
- Content moderation (AWS Rekognition)
- Multi-region S3 (faster global access)
- Image CDN optimization (lazy loading, responsive images)

---

**Document Status**: ✅ Complete
**Implementation Estimate**: 3-4 days (1 developer)
**Dependencies**: Sharp.js, AWS SDK v3, MinIO (dev)
**Next**: Implement upload endpoint → Test with Postman → Integrate with dish/menu forms
