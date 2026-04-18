import { supabase } from './supabase';

// Compress image before upload to save storage space
async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
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
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Could not compress image'));
          }
        },
        'image/jpeg',
        quality
      );
    };
    
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = URL.createObjectURL(file);
  });
}

// Generate unique filename
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

// Upload photo to Supabase Storage
export async function uploadPhoto(file: File): Promise<UploadResult> {
  try {
    // Compress the image first
    const compressed = await compressImage(file);
    
    // Generate unique filename
    const filename = generateFilename(file.name);
    const path = `items/${filename}`;
    
    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('photos')
      .upload(path, compressed, {
        contentType: 'image/jpeg',
        cacheControl: '31536000', // Cache for 1 year
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

// Delete photo from storage
export async function deletePhoto(path: string): Promise<boolean> {
  const { error } = await supabase.storage.from('photos').remove([path]);
  
  if (error) {
    console.error('Delete error:', error);
    return false;
  }
  
  return true;
}

// Convert file input or camera capture to File object
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], filename, { type: mime });
}
