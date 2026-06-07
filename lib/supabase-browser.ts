import { createClient } from "@supabase/supabase-js";

const LOCAL_OWNER_KEY = "cinelife.anonymousOwnerId";

export function getSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

function getLocalAnonymousOwner() {
  if (typeof window === "undefined") {
    throw new Error("Anonymous job ownership is only available in the browser.");
  }

  const existingOwnerId = window.localStorage.getItem(LOCAL_OWNER_KEY);

  if (existingOwnerId) {
    return {
      id: existingOwnerId,
      app_metadata: {
        provider: "local_anonymous_owner",
      },
      user_metadata: {},
    };
  }

  const ownerId = crypto.randomUUID();
  window.localStorage.setItem(LOCAL_OWNER_KEY, ownerId);

  return {
    id: ownerId,
    app_metadata: {
      provider: "local_anonymous_owner",
    },
    user_metadata: {},
  };
}

export async function ensureAnonymousSupabaseSession() {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    return getLocalAnonymousOwner();
  }

  const currentSession = await supabase.auth.getSession();
  const existingUser = currentSession.data.session?.user;

  if (existingUser) {
    return existingUser;
  }

  const { data, error } = await supabase.auth.signInAnonymously();

  if (error || !data.user) {
    if (error?.message.toLowerCase().includes("anonymous sign-ins are disabled")) {
      return getLocalAnonymousOwner();
    }

    throw new Error(error?.message ?? "Supabase anonymous sign-in failed.");
  }

  return data.user;
}
