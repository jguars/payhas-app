import { tNow } from '@/i18n';
import { supabase } from '@/lib/supabase';

const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const MAX_SECONDS = 60;
export const MAX_BYTES = 50 * 1024 * 1024; // the bucket's file_size_limit

/**
 * Upload a local file to the private `videos` bucket with progress.
 * supabase-js has no progress callback, so this posts the multipart form
 * itself; the storage policy only accepts paths reserved by create_upload().
 */
export async function uploadFile(path: string, uri: string, type: string, onProgress?: (fraction: number) => void) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error(tNow('creator.notSignedIn'));

  const form = new FormData();
  // React Native's FormData accepts a { uri, name, type } file descriptor.
  form.append('', { uri, name: path.split('/').pop(), type } as unknown as Blob);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${URL_BASE}/storage/v1/object/videos/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', KEY);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(parseError(xhr.responseText) ?? tNow('creator.uploadFailedCode', { code: xhr.status })));
    };
    xhr.onerror = () => reject(new Error(tNow('creator.networkError')));
    xhr.send(form);
  });
}

function parseError(body: string): string | null {
  try {
    const j = JSON.parse(body);
    return j.message ?? j.error ?? null;
  } catch {
    return null;
  }
}
