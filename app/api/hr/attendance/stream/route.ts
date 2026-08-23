import { createClient } from "@supabase/supabase-js"
import { supabaseConfig } from "@/lib/supabase/config"

// The one deliberate exception to this project's "raw fetch to PostgREST,
// never supabase-js" convention: Realtime is a WebSocket protocol with no
// raw-fetch equivalent, so it requires the client library. Scoped to this
// single server-only route — the service-role key it uses here never
// reaches the browser. The browser instead opens a plain EventSource to
// this route, which relays events over SSE (see
// app/hr-dashboard/attendance/_hooks/use-attendance-realtime.ts).
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const supabase = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey)

      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      // Keeps intermediary proxies/load balancers from treating the
      // connection as idle and closing it during quiet periods between
      // clock-ins.
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"))
      }, 20_000)

      const channel = supabase
        .channel("attendance-logs-changes")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "attendance_logs" },
          payload => {
            const row = payload.new as { id: string; employee_id: string; recorded_at: string }
            send("attendance-insert", { id: row.id, employeeId: row.employee_id, recordedAt: row.recorded_at })
          }
        )
        .subscribe()

      const cleanup = () => {
        clearInterval(heartbeat)
        channel.unsubscribe()
        supabase.removeChannel(channel)
        try {
          controller.close()
        } catch {
          // already closed
        }
      }

      request.signal.addEventListener("abort", cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection:      "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
