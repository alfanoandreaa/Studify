import { supabase } from "./supabase";

// One exchange per code, including React Strict Mode's repeated effects.
const exchanges = new Map<string, ReturnType<typeof supabase.auth.exchangeCodeForSession>>();
export function exchangeAuthCode(code: string) {
  let exchange = exchanges.get(code);
  if (!exchange) {
    exchange = supabase.auth.exchangeCodeForSession(code);
    exchanges.set(code, exchange);
  }
  return exchange;
}
