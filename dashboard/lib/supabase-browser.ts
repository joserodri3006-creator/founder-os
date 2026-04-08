import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Fallback prevents crash during SSR/prerender when env vars aren't available.
  // Actual requests only happen client-side where real values are present.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
  return createBrowserClient(url, key);
}
