// Builds the real store and AI caller from env vars. Cached per warm function instance.
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { createStore } from './store.js';
import { askWithFallback, MODELS, HTTP_OPTIONS } from './gemini.js';

let cached;

export function deps(env = process.env) {
  if (cached) return cached;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, httpOptions: HTTP_OPTIONS });
  // GEMINI_MODEL, if set, is tried first; the built-in list is the fallback.
  const models = env.GEMINI_MODEL ? [env.GEMINI_MODEL, ...MODELS.filter((m) => m !== env.GEMINI_MODEL)] : MODELS;
  cached = {
    store: createStore(supabase),
    ai: (args) => askWithFallback(args, { client, models }),
  };
  return cached;
}
