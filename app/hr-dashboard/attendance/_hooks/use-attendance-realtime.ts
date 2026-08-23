"use client"

import * as React from "react"

// One persistent EventSource for the page's lifetime, relayed server-side
// from Supabase Realtime (see app/api/hr/attendance/stream/route.ts — the
// service-role key that subscription needs never reaches the browser).
// onChange is stored in a ref so the connection never has to reopen when
// the caller's closure changes (e.g. the selected date) — every fired
// event always invokes the *current* callback.
export function useAttendanceRealtime(onChange: () => void) {
  const [streamHealthy, setStreamHealthy] = React.useState(true)
  const onChangeRef = React.useRef(onChange)

  // Keeps the ref fresh without mutating it during render.
  React.useEffect(() => {
    onChangeRef.current = onChange
  })

  React.useEffect(() => {
    const source = new EventSource("/api/hr/attendance/stream")

    source.addEventListener("attendance-insert", () => onChangeRef.current())
    source.onerror = () => setStreamHealthy(false)
    source.onopen = () => setStreamHealthy(true)

    return () => source.close()
  }, [])

  return { streamHealthy }
}
