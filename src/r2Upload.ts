export const R2_UPLOAD_WORKER_URL = (
  import.meta.env.VITE_R2_UPLOAD_WORKER_URL || 'https://vjemma-upload.piwantonny.workers.dev'
)
  .trim()
  .replace(/\/upload\/?$/i, '')
  .replace(/\/+$/, '');

export const R2_BUCKET_NAME = (import.meta.env.VITE_R2_BUCKET || 'vj-emma-movies').trim();

export function isSafeHttpUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function sanitizeUploadFileName(fileName: string, folder: string): string {
  const cleanFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'media';
  const cleanName = (fileName || 'file')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
  return `${cleanFolder}_${Date.now()}_${cleanName || 'upload.bin'}`;
}

export async function uploadFileToR2(
  file: File,
  folder = 'movies',
  onProgress?: (pct: number) => void
): Promise<string> {
  if (!file) {
    throw new Error('No file selected for R2 upload.');
  }

  const uploadUrl = `${R2_UPLOAD_WORKER_URL}/upload`;
  const uniqueName = sanitizeUploadFileName(file.name, folder);

  const formData = new FormData();
  formData.append('file', file, uniqueName);
  formData.append('bucket', R2_BUCKET_NAME);
  formData.append('folder', folder);

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl, true);

    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      if (event.lengthComputable && event.total > 0) {
        const pct = Math.min(95, Math.max(5, Math.round((event.loaded / event.total) * 95)));
        onProgress(pct);
      } else {
        onProgress(35);
      }
    };

    xhr.onload = () => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(xhr.responseText || '{}') as Record<string, unknown>;
      } catch {
        data = {};
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        const errMsg =
          (typeof data.error === 'string' && data.error) ||
          (typeof data.message === 'string' && data.message) ||
          `R2 upload failed (HTTP ${xhr.status}).`;
        reject(new Error(errMsg));
        return;
      }

      const rawUrl =
        (typeof data.url === 'string' && data.url) ||
        (typeof data.publicUrl === 'string' && data.publicUrl) ||
        (typeof data.fileUrl === 'string' && data.fileUrl) ||
        (typeof data.videoUrl === 'string' && data.videoUrl) ||
        (typeof data.downloadUrl === 'string' && data.downloadUrl) ||
        (typeof data.key === 'string' && data.key
          ? `${R2_UPLOAD_WORKER_URL}/file/${encodeURIComponent(data.key)}`
          : '');

      if (!rawUrl || !isSafeHttpUrl(rawUrl)) {
        reject(new Error('R2 Worker did not return a valid public URL.'));
        return;
      }

      onProgress?.(100);
      resolve(rawUrl);
    };

    xhr.onerror = () => {
      reject(new Error('Network error while uploading file to Cloudflare R2 Worker.'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload timed out while sending file to Cloudflare R2 Worker.'));
    };

    onProgress?.(5);
    xhr.send(formData);
  });
}
