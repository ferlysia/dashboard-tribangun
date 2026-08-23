"use client"

import { useMutation } from "@tanstack/react-query"

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || "Request failed")
  return body
}

interface ClockInInput {
  employeeId:       string
  site:             string
  file:             Blob
  latitude:         number
  longitude:        number
  accuracy:         number
  // Raw GeolocationPosition.coords fields beyond lat/lng/accuracy — sent
  // purely for the server-side mock-GPS heuristic (see
  // app/api/attendance/route.ts). Frequently null on real devices; that's
  // expected and not itself suspicious.
  altitude:         number | null
  altitudeAccuracy: number | null
  speed:            number | null
  deviceReportedAt: string
  turnstileToken:   string
}

interface AttendanceLog {
  id:          string
  employee_id: string
  site_name:   string
  recorded_at: string
}

export function useClockIn() {
  return useMutation({
    mutationFn: (input: ClockInInput) => {
      const formData = new FormData()
      formData.append("employee_id", input.employeeId)
      formData.append("site", input.site)
      // input.file is a plain Blob (never a File — see compressSelfie's
      // comment on the WebKit empty-body bug), so the filename must be
      // passed explicitly here as FormData.append's 3rd argument.
      formData.append("file", input.file, "selfie.jpg")
      formData.append("latitude", String(input.latitude))
      formData.append("longitude", String(input.longitude))
      formData.append("accuracy", String(input.accuracy))
      if (input.altitude != null) formData.append("altitude", String(input.altitude))
      if (input.altitudeAccuracy != null) formData.append("altitude_accuracy", String(input.altitudeAccuracy))
      if (input.speed != null) formData.append("speed", String(input.speed))
      formData.append("device_reported_at", input.deviceReportedAt)
      formData.append("turnstile_token", input.turnstileToken)
      return fetchJson<{ data: AttendanceLog }>("/api/attendance", {
        method: "POST",
        body: formData,
      }).then(r => r.data)
    },
  })
}
