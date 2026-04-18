import { supabase } from './supabase';

// Compress image before upload. The canvas re-encode also strips EXIF (incl. GPS).
async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Could not compress image'));
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => reject(new Error('Could not load image'));
    img.src = URL.createObjectURL(file);
  });
}

function generateFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  return `${timestamp}-${random}.${extension}`;
}

export interface UploadResult {
  success: boolean;
  path?: string;
  error?: string;
}

// Upload scoped to a household. Path format: "{household_id}/{filename}".
export async function uploadPhoto(file: File, householdId: string): Promise<UploadResult> {
  try {
    const compressed = await compressImage(file);
    const filename = generateFilename(file.name);
    const path = `${householdId}/${filename}`;

    const { error } = await supabase.storage
      .from('photos')
      .upload(path, compressed, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
      });

    if (error) {
      console.error('Upload error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, path };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Upload failed:', message);
    return { success: false, error: message };
  }
}

export async function deletePhoto(path: string): Promise<boolean> {
  const { error } = await supabase.storage.from('photos').remove([path]);
  if (error) {
    console.error('Delete error:', error);
    return false;
  }
  return true;
}
