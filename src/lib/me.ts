import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const authApi = getRouteApi("/_authenticated");

export function useMe() {
  const { user } = authApi.useRouteContext();
  const q = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });
  return { userId: user.id, me: q.data ?? null };
}
