import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const SUPABASE_JWKS_URL = process.env.SUPABASE_JWKS_URL || '';

// Public client (for customer frontend interactions if needed)
export const supabasePublic: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// Admin / Service Role client (bypasses RLS, for backend server operations)
export const supabaseAdmin: SupabaseClient | null =
  SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

/**
 * Utility to verify Supabase connection health
 */
export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  message: string;
}> {
  if (!supabaseAdmin) {
    return {
      connected: false,
      message: 'Supabase credentials not configured in environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
    };
  }

  try {
    const { data, error } = await supabaseAdmin.from('Product').select('count', { count: 'exact', head: true });
    if (error) {
      return { connected: false, message: error.message };
    }
    return { connected: true, message: 'Connected to Supabase PostgreSQL successfully' };
  } catch (err: any) {
    return { connected: false, message: err.message };
  }
}

/**
 * Upload an image buffer to Supabase Storage bucket (e.g. 'saree-images')
 */
export async function uploadToSupabaseStorage(
  bucketName: string,
  filePath: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<{ url: string | null; error: string | null }> {
  if (!supabaseAdmin) {
    return { url: null, error: 'Supabase admin client not initialized' };
  }

  try {
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      return { url: null, error: uploadError.message };
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return { url: publicUrlData.publicUrl, error: null };
  } catch (err: any) {
    return { url: null, error: err.message };
  }
}
