import type { ImagePickerAsset } from 'expo-image-picker';
import * as ExpoFileSystem from 'expo-file-system/legacy';

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif', 'svg', 'heic', 'heif', 'jfif', 'avif',
]);

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm', 'avi', '3gp', 'mkv']);

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
  avi: 'video/avi',
  '3gp': 'video/3gpp',
  mkv: 'video/x-matroska',
};

export interface NormalizedUploadAsset {
  fileName: string;
  fileType: string;
  uri: string;
}

function extensionFromUri(uri: string): string | undefined {
  const withoutQuery = uri.split('?')[0];
  const last = withoutQuery.split('/').pop() || '';
  if (last.includes('.')) {
    return last.split('.').pop()?.toLowerCase();
  }
  return undefined;
}

function extensionFromMime(mime?: string): string {
  if (!mime) return 'jpg';
  const lower = mime.toLowerCase();
  switch (lower) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    case 'image/bmp':
      return 'bmp';
    case 'image/tiff':
      return 'tiff';
    case 'image/avif':
      return 'avif';
    case 'video/mp4':
      return 'mp4';
    case 'video/quicktime':
      return 'mov';
    case 'video/x-m4v':
      return 'm4v';
    case 'video/webm':
      return 'webm';
    case 'video/3gpp':
      return '3gp';
    default:
      if (lower.startsWith('video/')) return 'mp4';
      return 'jpg';
  }
}

function normalizeMimeType(mime: string | undefined, ext?: string): string {
  const raw = (mime || '').toLowerCase().trim();
  if (raw && raw !== 'application/octet-stream' && raw !== 'binary/octet-stream') {
    if (raw === 'image/jpg') return 'image/jpeg';
    return raw;
  }
  if (ext && MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  return 'image/jpeg';
}

export function normalizeUploadAsset(
  asset: ImagePickerAsset,
  fileNamePrefix?: string
): NormalizedUploadAsset {
  const extFromUri = extensionFromUri(asset.uri);
  const extFromName = asset.fileName?.includes('.')
    ? asset.fileName.split('.').pop()?.toLowerCase()
    : undefined;
  const ext = extFromUri || extFromName;
  const fileType = normalizeMimeType(asset.mimeType ?? undefined, ext);

  let fileName = asset.fileName?.trim() || '';
  if (!fileName || !fileName.includes('.')) {
    const safeExt = ext || extensionFromMime(fileType);
    fileName = `upload_${Date.now()}.${safeExt}`;
  }

  if (fileNamePrefix && !fileName.toLowerCase().includes(fileNamePrefix.toLowerCase())) {
    fileName = `${fileNamePrefix}${fileName}`;
  }

  return { fileName, fileType, uri: asset.uri };
}

export function isSupportedImageExtension(ext?: string): boolean {
  if (!ext) return false;
  return IMAGE_EXTENSIONS.has(ext.toLowerCase());
}

export function isSupportedVideoExtension(ext?: string): boolean {
  if (!ext) return false;
  return VIDEO_EXTENSIONS.has(ext.toLowerCase());
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/** Read local/content URI into a Blob for R2 upload — works across gallery, camera, WhatsApp, downloads */
export async function uriToUploadBlob(uri: string, mimeType: string): Promise<Blob> {
  try {
    const response = await fetch(uri);
    if (response.ok) {
      const blob = await response.blob();
      if (blob.size > 0) {
        return blob.type ? blob : new Blob([blob], { type: mimeType });
      }
    }
  } catch {
    // fall through to FileSystem
  }

  try {
    const base64 = await ExpoFileSystem.readAsStringAsync(uri, {
      encoding: ExpoFileSystem.EncodingType.Base64,
    });
    return base64ToBlob(base64, mimeType);
  } catch (error) {
    console.error('uriToUploadBlob failed:', error);
    throw new Error('Could not read the selected image. Please try another image.');
  }
}

export async function uploadAssetToR2(
  asset: ImagePickerAsset,
  options: {
    fileNamePrefix?: string;
    role?: string;
    apiClient: {
      post: (url: string, data: unknown) => Promise<{ data: { success: boolean; uploadUrl?: string; publicUrl?: string; message?: string } }>;
    };
  }
): Promise<string> {
  const { fileName, fileType, uri } = normalizeUploadAsset(asset, options.fileNamePrefix);

  const uploadResponse = await options.apiClient.post('/api/v1/upload/url', {
    fileType,
    fileName,
    role: options.role ?? 'Merchant',
    isPermanent: true,
  });

  if (!uploadResponse.data.success || !uploadResponse.data.uploadUrl || !uploadResponse.data.publicUrl) {
    throw new Error(uploadResponse.data.message || 'Failed to get upload URL');
  }

  const blob = await uriToUploadBlob(uri, fileType);
  const uploadResult = await fetch(uploadResponse.data.uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': fileType },
  });

  if (!uploadResult.ok) {
    throw new Error('Failed to upload file to storage');
  }

  return uploadResponse.data.publicUrl;
}
