import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY diagnostic route — removed immediately after verification.
export const Route = createFileRoute("/api/public/_diag-role")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("debug_effective_role" as never);
        return new Response(JSON.stringify({ data, error }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
