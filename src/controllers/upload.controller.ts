import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { uploadToSupabaseStorage } from '../lib/supabase';

export class UploadController {
  static async upload(req: Request, res: Response) {
    try {
      const { file, filename, contentType } = req.body;

      if (!file) {
        return res.status(400).json({ success: false, message: 'No file data provided' });
      }

      // 1. Parse base64 string
      let mimeType = contentType || 'image/jpeg';
      let base64Data = file;

      // Extract MIME type from data URL if present
      if (file.startsWith('data:')) {
        const matches = file.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          base64Data = matches[2];
        }
      }

      // Determine appropriate extension
      let ext = 'jpg';
      if (mimeType.includes('png')) ext = 'png';
      else if (mimeType.includes('webp')) ext = 'webp';
      else if (mimeType.includes('gif')) ext = 'gif';
      else if (mimeType.includes('svg')) ext = 'svg';

      const buffer = Buffer.from(base64Data, 'base64');

      // Check max size (10MB)
      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: 'File size exceeds 10MB limit' });
      }

      const cleanOriginalName = filename
        ? filename.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.[^/.]+$/, '')
        : 'saree';
      const uniqueFileName = `${cleanOriginalName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

      // 2. Try Supabase Storage upload first
      try {
        const { url: supabaseUrl, error: supabaseError } = await uploadToSupabaseStorage(
          'products',
          uniqueFileName,
          buffer,
          mimeType
        );

        if (supabaseUrl && !supabaseError) {
          return res.status(200).json({
            success: true,
            message: 'Image uploaded to cloud storage successfully',
            data: {
              url: supabaseUrl,
              filename: uniqueFileName,
              size: buffer.length,
              storage: 'supabase',
            },
          });
        }
      } catch (cloudErr) {
        console.warn('Supabase storage upload skipped or failed, falling back to local disk:', cloudErr);
      }

      // 3. Fallback: Save to local uploads directory
      const uploadsDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const localFilePath = path.join(uploadsDir, uniqueFileName);
      fs.writeFileSync(localFilePath, buffer);

      // Also copy to ui/public/uploads if accessible so Next.js can serve it directly
      try {
        const uiUploadsDir = path.join(__dirname, '../../../ui/public/uploads');
        if (!fs.existsSync(uiUploadsDir)) {
          fs.mkdirSync(uiUploadsDir, { recursive: true });
        }
        fs.writeFileSync(path.join(uiUploadsDir, uniqueFileName), buffer);
      } catch (uiSyncErr) {
        // Non-critical if UI directory is in different location
      }

      // Construct public URL
      const host = req.get('host') || 'localhost:5000';
      const protocol = req.protocol || 'http';
      const localUrl = `${protocol}://${host}/uploads/${uniqueFileName}`;

      return res.status(200).json({
        success: true,
        message: 'Image uploaded to local storage successfully',
        data: {
          url: localUrl,
          fallbackUrl: `/uploads/${uniqueFileName}`,
          filename: uniqueFileName,
          size: buffer.length,
          storage: 'local',
        },
      });
    } catch (error: any) {
      console.error('Upload controller error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to process file upload',
      });
    }
  }
}
