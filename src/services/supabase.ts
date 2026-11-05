import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-id') &&
    !supabaseAnonKey.includes('your-anon-key')
  );
};

// Khởi tạo Supabase client an toàn (tránh văng lỗi crash app khi chưa điền env)
export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured() ? supabaseUrl : 'https://dummy.supabase.co',
  isSupabaseConfigured() ? supabaseAnonKey : 'dummy-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

/**
 * Tạo Signed URL tạm thời cho ảnh CCCD (hết hạn sau 60 giây) từ private bucket 'cccd'
 */
export async function getCccdSignedUrl(path: string, expiresInSeconds = 60): Promise<string | null> {
  if (!isSupabaseConfigured() || !path) return null;
  try {
    const { data, error } = await supabase.storage
      .from('cccd')
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      console.error('Lỗi lấy Signed URL CCCD:', error);
      return null;
    }
    return data?.signedUrl || null;
  } catch (err) {
    console.error('Lỗi mạng khi tạo Signed URL:', err);
    return null;
  }
}

/**
 * Upload ảnh CCCD đã nén vào private bucket 'cccd'
 * File lưu theo cấu trúc: [owner_id]/[file_name]
 */
export async function uploadCccdToStorage(
  ownerId: string,
  fileName: string,
  blob: Blob
): Promise<{ path: string | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { path: null, error: new Error('Chưa cấu hình Supabase') };
  }

  const filePath = `${ownerId}/${fileName}`;
  try {
    const { data, error } = await supabase.storage
      .from('cccd')
      .upload(filePath, blob, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (error) {
      return { path: null, error: new Error(error.message) };
    }
    return { path: data.path, error: null };
  } catch (err: unknown) {
    return { path: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Xóa ảnh CCCD khỏi Storage
 */
export async function deleteCccdFromStorage(path: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !path) return false;
  try {
    const { error } = await supabase.storage.from('cccd').remove([path]);
    return !error;
  } catch {
    return false;
  }
}
