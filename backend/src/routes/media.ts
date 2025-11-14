import { FastifyInstance } from 'fastify';
import { MediaService } from '../services/MediaService.js';
import { authenticate } from '../middleware/auth.js';

export async function mediaRoutes(fastify: FastifyInstance): Promise<void> {
  const mediaService = new MediaService();

  // POST /media/upload - Upload image (authenticated)
  fastify.post('/upload', {
    preHandler: authenticate,
  }, async (request, reply) => {
    try {
      // Get file from multipart request
      const data = await request.file();

      if (!data) {
        reply.status(400).send({
          success: false,
          error: {
            code: 'NO_FILE',
            message: 'No file provided',
          },
        });
        return;
      }

      // Validate file
      mediaService.validateImageFile(data.mimetype, 0); // Size validation happens during buffer read

      // Read file buffer
      const buffer = await data.toBuffer();

      // Validate file size with actual buffer
      mediaService.validateImageFile(data.mimetype, buffer.length);

      // Upload file
      const url = await mediaService.uploadFile(
        buffer,
        data.filename,
        data.mimetype
      );

      reply.send({
        success: true,
        data: {
          url,
          filename: data.filename,
          mimeType: data.mimetype,
          size: buffer.length,
        },
      });
    } catch (error) {
      throw error;
    }
  });

  // POST /media/upload-multiple - Upload multiple images (authenticated)
  fastify.post('/upload-multiple', {
    preHandler: authenticate,
  }, async (request, reply) => {
    try {
      const parts = request.parts();
      const uploadedFiles: Array<{
        url: string;
        filename: string;
        mimeType: string;
        size: number;
      }> = [];

      for await (const part of parts) {
        if (part.type === 'file') {
          // Validate file
          mediaService.validateImageFile(part.mimetype, 0);

          // Read file buffer
          const buffer = await part.toBuffer();

          // Validate file size
          mediaService.validateImageFile(part.mimetype, buffer.length);

          // Upload file
          const url = await mediaService.uploadFile(
            buffer,
            part.filename,
            part.mimetype
          );

          uploadedFiles.push({
            url,
            filename: part.filename,
            mimeType: part.mimetype,
            size: buffer.length,
          });
        }
      }

      if (uploadedFiles.length === 0) {
        reply.status(400).send({
          success: false,
          error: {
            code: 'NO_FILES',
            message: 'No files provided',
          },
        });
        return;
      }

      reply.send({
        success: true,
        data: {
          files: uploadedFiles,
          count: uploadedFiles.length,
        },
      });
    } catch (error) {
      throw error;
    }
  });

  // DELETE /media - Delete image (authenticated)
  fastify.delete('/', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { url } = request.body as { url: string };

    if (!url) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_URL',
          message: 'File URL is required',
        },
      });
      return;
    }

    await mediaService.deleteFile(url);

    reply.send({
      success: true,
      data: {
        message: 'File deleted successfully',
      },
    });
  });
}
