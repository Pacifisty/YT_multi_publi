import { describe, it, expect } from 'vitest';
import {
  validatePublicMediaUrl,
  isR2PublicUrl,
  extractFilenameFromUrl,
  MediaUrlValidationResult,
} from './media-url.validator';

describe('MediaUrlValidator', () => {
  describe('isR2PublicUrl', () => {
    it('should recognize R2 URLs with standard pattern', () => {
      expect(isR2PublicUrl('https://mybucket.r2.us-west-2.com/videos/test.mp4')).toBe(true);
      expect(isR2PublicUrl('https://cdn.r2.example.com/file.mp4')).toBe(true);
    });

    it('should recognize custom media domains', () => {
      expect(isR2PublicUrl('https://media.example.com/videos/video.mp4')).toBe(true);
      expect(isR2PublicUrl('https://media.r2.yourapp.com/uploads/file.mp4')).toBe(true);
    });

    it('should reject HTTP URLs', () => {
      expect(isR2PublicUrl('http://media.r2.com/video.mp4')).toBe(false);
    });

    it('should reject non-R2 domains', () => {
      expect(isR2PublicUrl('https://youtube.com/video.mp4')).toBe(false);
      expect(isR2PublicUrl('https://storage.googleapis.com/video.mp4')).toBe(false);
    });

    it('should reject malformed URLs', () => {
      expect(isR2PublicUrl('not a url')).toBe(false);
      expect(isR2PublicUrl('ftp://invalid.com')).toBe(false);
    });

    it('should handle empty or invalid input', () => {
      expect(isR2PublicUrl('')).toBe(false);
      expect(isR2PublicUrl('   ')).toBe(false);
    });
  });

  describe('extractFilenameFromUrl', () => {
    it('should extract filename from URL path', () => {
      expect(extractFilenameFromUrl('https://media.r2.com/videos/uuid.mp4')).toBe('uuid.mp4');
      expect(extractFilenameFromUrl('https://example.com/path/to/video.mov')).toBe('video.mov');
    });

    it('should handle URLs with query parameters', () => {
      expect(extractFilenameFromUrl('https://media.r2.com/video.mp4?expires=123')).toBe(
        'video.mp4'
      );
    });

    it('should handle URLs with trailing slashes', () => {
      expect(extractFilenameFromUrl('https://media.r2.com/videos/')).toBe('');
    });

    it('should return empty string for invalid URLs', () => {
      expect(extractFilenameFromUrl('not a url')).toBe('');
      expect(extractFilenameFromUrl('')).toBe('');
    });

    it('should handle deeply nested paths', () => {
      expect(
        extractFilenameFromUrl('https://media.r2.com/2026/04/28/abc123/video-final.webm')
      ).toBe('video-final.webm');
    });
  });

  describe('validatePublicMediaUrl', () => {
    describe('happy path', () => {
      it('should validate correct R2 URL with MP4', () => {
        const result = validatePublicMediaUrl('https://media.r2.com/videos/test.mp4');
        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
      });

      it('should validate correct R2 URL with MOV', () => {
        const result = validatePublicMediaUrl('https://cdn.r2.us-west-2.com/uploads/video.mov');
        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
      });

      it('should validate URL with multiple path segments', () => {
        const result = validatePublicMediaUrl(
          'https://media.r2.com/campaigns/2026-04-28/video-abc123.webm'
        );
        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
      });

      it('should validate all supported video extensions', () => {
        const extensions = [
          '.mp4',
          '.mov',
          '.webm',
          '.avi',
          '.mkv',
          '.flv',
          '.wmv',
          '.m4v',
          '.3gp',
          '.ogv',
          '.ts',
        ];

        for (const ext of extensions) {
          const result = validatePublicMediaUrl(`https://media.r2.com/video${ext}`);
          expect(result.valid).toBe(
            true,
            `Extension ${ext} should be valid but got errors: ${result.errors?.join(', ')}`
          );
        }
      });
    });

    describe('protocol validation', () => {
      it('should reject HTTP URLs', () => {
        const result = validatePublicMediaUrl('http://media.r2.com/video.mp4');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Protocol must be HTTPS (not HTTP or other)');
      });

      it('should reject FTP URLs', () => {
        const result = validatePublicMediaUrl('ftp://media.r2.com/video.mp4');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Protocol must be HTTPS (not HTTP or other)');
      });
    });

    describe('domain validation', () => {
      it('should reject non-R2 domains', () => {
        const result = validatePublicMediaUrl('https://youtube.com/video.mp4');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Host must be a valid R2 domain or recognized media domain');
      });

      it('should reject AWS S3 domains', () => {
        const result = validatePublicMediaUrl('https://mybucket.s3.amazonaws.com/video.mp4');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Host must be a valid R2 domain or recognized media domain');
      });
    });

    describe('file extension validation', () => {
      it('should reject unsupported file types', () => {
        const result = validatePublicMediaUrl('https://media.r2.com/document.pdf');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expect.stringMatching(/File extension '.pdf' is not recognized/));
      });

      it('should reject files without extensions', () => {
        const result = validatePublicMediaUrl('https://media.r2.com/video');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Filename must include a file extension');
      });

      it('should reject URLs with trailing slashes only', () => {
        const result = validatePublicMediaUrl('https://media.r2.com/videos/');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('URL path must contain a filename');
      });
    });

    describe('URL length validation', () => {
      it('should reject URLs >= 2048 characters', () => {
        const longPath = 'a'.repeat(2100);
        const result = validatePublicMediaUrl(`https://media.r2.com/${longPath}.mp4`);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('URL length must be less than 2048 characters');
      });

      it('should accept URLs < 2048 characters', () => {
        const reasonablePath = 'a'.repeat(100);
        const result = validatePublicMediaUrl(`https://media.r2.com/${reasonablePath}.mp4`);
        expect(result.valid).toBe(true);
      });
    });

    describe('input validation', () => {
      it('should reject empty strings', () => {
        const result = validatePublicMediaUrl('');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('URL is required and must be a string');
      });

      it('should reject whitespace-only strings', () => {
        const result = validatePublicMediaUrl('   ');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('URL is required and must be a string');
      });

      it('should reject invalid URL formats', () => {
        const result = validatePublicMediaUrl('not a url at all');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('URL is not valid (invalid format or encoding)');
      });

      it('should handle special characters in URL', () => {
        const result = validatePublicMediaUrl('https://media.r2.com/path%20with%20spaces.mp4');
        expect(result.valid).toBe(true);
      });
    });

    describe('multiple errors', () => {
      it('should report all validation errors', () => {
        const result = validatePublicMediaUrl('http://youtube.com/document.pdf');
        expect(result.valid).toBe(false);
        expect(result.errors!.length).toBeGreaterThanOrEqual(2);
        expect(result.errors).toContain('Protocol must be HTTPS (not HTTP or other)');
        expect(result.errors).toContain('Host must be a valid R2 domain or recognized media domain');
      });

      it('should report protocol and extension errors', () => {
        const result = validatePublicMediaUrl('http://media.r2.com/file.txt');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Protocol must be HTTPS (not HTTP or other)');
        expect(result.errors).toContain(expect.stringMatching(/File extension '.txt' is not recognized/));
      });
    });

    describe('edge cases', () => {
      it('should handle URL with query parameters and fragments', () => {
        const result = validatePublicMediaUrl(
          'https://media.r2.com/video.mp4?expires=123&signature=abc#section'
        );
        expect(result.valid).toBe(true);
      });

      it('should handle URL with port number', () => {
        const result = validatePublicMediaUrl('https://media.r2.com:443/video.mp4');
        expect(result.valid).toBe(true);
      });

      it('should preserve case in error messages', () => {
        const result = validatePublicMediaUrl('https://media.r2.com/video.PDF');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expect.stringMatching(/\.pdf/));
      });

      it('should trim whitespace from URL', () => {
        const result = validatePublicMediaUrl('  https://media.r2.com/video.mp4  ');
        expect(result.valid).toBe(true);
      });
    });
  });
});
