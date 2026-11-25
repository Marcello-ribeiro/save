import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? "";
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const supabase = createClient(SUPABASE_URL || "http://localhost", SUPABASE_KEY || "chave-ausente", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

export const BUCKET_SAVES = "save-files";
export const BUCKET_COVERS = "game-covers";

/** Limite por arquivo no plano grátis do Supabase Storage. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Erro com texto pronto para a pessoa ler. */
export class UserError extends Error {}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err && "message" in err) return String((err as { message: unknown }).message);
  return "";
}

export function errorText(err: unknown, fallback = "Não foi possível concluir. Tente de novo."): string {
  if (err instanceof UserError) return err.message;
  const msg = messageOf(err);
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  if (/payload too large|maximum allowed size|413/i.test(msg)) return "O arquivo passou do limite de 50 MB do Storage.";
  if (/row-level security|permission denied|unauthorized|jwt/i.test(msg)) return "Sem permissão para esta ação. Entre de novo na conta.";
  if (/does not exist|could not find the table|schema cache/i.test(msg)) return "O banco ainda não foi atualizado. Rode as migrações do Supabase.";
  if (/bucket not found/i.test(msg)) return "O bucket do Storage não existe. Rode a migração 008.";
  return fallback;
}
