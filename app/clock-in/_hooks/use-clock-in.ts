"use client"

import { useMutation } from "@tanstack/react-query"

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || "Request failed")
  return body
}

interface ClockInInput {
  name:             string
  site:             string
  file:             File
  latitude:         number
  longitude:        number
  accuracy:         number
  deviceReportedAt: string
  turnstileToken:   string
}

interface AttendanceLog {
  id:         string
  worker_name: string
  site_name:   string
  recorded_at: string
}

export function useClockIn() {
  return useMutation({
    mutationFn: (input: ClockInInput) => {
      const formData = new FormData()
      formData.append("name", input.name)
      formData.append("site", input.site)
      formData.append("file", input.file)
      formData.append("latitude", String(input.latitude))
      formData.append("longitude", String(input.longitude))
      formData.append("accuracy", String(input.accuracy))
      formData.append("device_reported_at", input.deviceReportedAt)
      formData.append("turnstile_token", input.turnstileToken)
      return fetchJson<{ data: AttendanceLog }>("/api/attendance", {
        method: "POST",
        body: formData,
      }).then(r => r.data)
    },
  })
}
