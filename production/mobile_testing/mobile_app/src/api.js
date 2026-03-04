/**
 * API base URL for the backend.
 * - Expo: set EXPO_PUBLIC_API_URL in .env (e.g. http://localhost:3000 or your deployed URL).
 * - For physical device testing use your machine's LAN IP (e.g. http://192.168.1.5:3000).
 */
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Build full URL for an image path from the API (e.g. /uploads/xyz.jpg).
 * Handles leading slash, avoids double slash, and supports full URLs from API.
 */
export function imageUrl(path) {
  if (!path || typeof path !== 'string') return '';
  const trimmed = path.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = (API_BASE || '').replace(/\/+$/, '');
  return trimmed.startsWith('/') ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

/**
 * Return the thumbnail path for a full image path (e.g. /uploads/foo.png -> /uploads/thumb/foo.jpg).
 * Use for list/card views to load smaller images. Falls back to original path if no thumb exists.
 */
export function getThumbPath(path) {
  if (!path || typeof path !== 'string') return '';
  const trimmed = path.trim();
  const match = trimmed.match(/^(\/uploads\/)(.+)\.[^.]+$/);
  if (!match) return trimmed;
  return `${match[1]}thumb/${match[2]}.jpg`;
}

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

export async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken && { Authorization: `Bearer ${authToken}` }),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
  return data;
}

export async function uploadImage(input) {
  const uri = typeof input === 'string' ? input : input?.uri;
  if (!uri) throw new Error('Image uri required');
  const mimeType =
    (typeof input === 'object' && input?.mimeType) ||
    (typeof input === 'object' && input?.type) ||
    'image/jpeg';
  const fileName =
    (typeof input === 'object' && (input?.fileName || input?.name)) ||
    `image.${String(mimeType).includes('png') ? 'png' : 'jpg'}`;

  const formData = new FormData();
  formData.append('file', {
    uri,
    type: mimeType,
    name: fileName,
  });
  const res = await fetch(`${API_BASE}/api/uploads/image`, {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Upload failed');
  return data.path;
}
