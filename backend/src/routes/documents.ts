import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { fileTypeFromBuffer } from 'file-type';
import prisma from '../db/prisma';
import { DocumentFormat, ProcessingStatus } from '@prisma/client';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store in memory for validation
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB default
  },
});

// Supported file extensions to DocumentFormat mapping
const EXTENSION_TO_FORMAT: Record<string, DocumentFormat> = {
  '.pdf': DocumentFormat.PDF,
  '.docx': DocumentFormat.DOCX,
  '.doc': DocumentFormat.DOC,
  '.docm': DocumentFormat.DOCM,
  '.rtf': DocumentFormat.RTF,
  '.odt': DocumentFormat.ODT,
  '.txt': DocumentFormat.TXT,
  '.md': DocumentFormat.MARKDOWN,
  '.markdown': DocumentFormat.MARKDOWN,
  '.xlsx': DocumentFormat.XLSX,
  '.xls': DocumentFormat.XLS,
  '.ods': DocumentFormat.ODS,
  '.csv': DocumentFormat.CSV,
  '.pptx': DocumentFormat.PPTX,
  '.ppt': DocumentFormat.PPT,
  '.odp': DocumentFormat.ODP,
  '.png': DocumentFormat.PNG,
  '.jpg': DocumentFormat.JPG,
  '.jpeg': DocumentFormat.JPEG,
  '.webp': DocumentFormat.WEBP,
  '.tiff': DocumentFormat.TIFF,
  '.tif': DocumentFormat.TIFF,
  '.bmp': DocumentFormat.BMP,
  '.heic': DocumentFormat.HEIC,
  '.svg': DocumentFormat.SVG,
};

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  // Documents
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/rtf',
  'application/vnd.oasis.opendocument.text',
  'text/plain',
  'text/markdown',
  // Spreadsheets
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/csv',
  // Presentations
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.oasis.opendocument.presentation',
  // Images
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/tiff',
  'image/bmp',
  'image/heic',
  'image/svg+xml',
]);

/**
 * POST /api/documents/upload
 * Upload a document file
 */
router.post(
  '/upload',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const file = req.file;
      const originalFilename = file.originalname;
      const fileExtension = path.extname(originalFilename).toLowerCase();

      // Validate file extension
      const format = EXTENSION_TO_FORMAT[fileExtension];
      if (!format) {
        return res.status(400).json({
          error: `Unsupported file format: ${fileExtension}`,
          supported: Object.keys(EXTENSION_TO_FORMAT),
        });
      }

      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        return res.status(400).json({
          error: `Invalid MIME type: ${file.mimetype}`,
        });
      }

      // Additional validation: Check magic bytes
      const fileType = await fileTypeFromBuffer(file.buffer);
      if (fileType && !ALLOWED_MIME_TYPES.has(fileType.mime)) {
        return res.status(400).json({
          error: 'File content does not match declared type',
        });
      }

      // Generate unique stored filename
      const storedFilename = `${uuidv4()}${fileExtension}`;
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const filePath = path.join(uploadDir, storedFilename);

      // Ensure upload directory exists
      await fs.mkdir(uploadDir, { recursive: true });

      // Write file to disk
      await fs.writeFile(filePath, file.buffer);

      // Create database record
      const document = await prisma.document.create({
        data: {
          originalFilename,
          storedFilename,
          mimeType: file.mimetype,
          fileSize: file.size,
          format,
          processingStatus: ProcessingStatus.PENDING,
          metadata: {
            uploadedBy: req.body.userId || null, // TODO: Get from auth
            uploadedFrom: req.ip,
          },
        },
      });

      // TODO: Trigger background processing job
      // This will be implemented in B8 (Document Processing Workers)

      res.status(201).json({
        id: document.id,
        originalFilename: document.originalFilename,
        format: document.format,
        fileSize: document.fileSize,
        processingStatus: document.processingStatus,
        uploadedAt: document.uploadedAt,
      });
    } catch (error) {
      console.error('File upload error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/documents/:id
 * Get document metadata
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        originalFilename: true,
        format: true,
        fileSize: true,
        processingStatus: true,
        processingError: true,
        previewUrl: true,
        pageCount: true,
        uploadedAt: true,
        processedAt: true,
      },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    console.error('Get document error:', error);
    next(error);
  }
});

/**
 * GET /api/documents/:id/download
 * Download original document file
 */
router.get('/:id/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        originalFilename: true,
        storedFilename: true,
        mimeType: true,
      },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const filePath = path.join(uploadDir, document.storedFilename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Send file
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalFilename}"`);
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Download document error:', error);
    next(error);
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document (soft delete - mark as deleted, actual file cleanup in background)
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id },
      select: { storedFilename: true },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete database record (cascade will handle related records if configured)
    await prisma.document.delete({
      where: { id },
    });

    // TODO: Queue background job to delete file from disk
    // For now, delete immediately (in production, use background worker)
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const filePath = path.join(uploadDir, document.storedFilename);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('File deletion error:', error);
      // Continue even if file deletion fails
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete document error:', error);
    next(error);
  }
});

export default router;
