"use client"

import { useQuery } from "@tanstack/react-query"

export interface AttendanceFeedItem {
  id:         string
  employeeId: string
  fullName:   string
  siteName:   string
  recordedAt: string
}

async function fetchFeed(date: string): Promise<{ data: AttendanceFeedItem[] }> {
  const res = await fetch(`/api/hr/attendance/feed?date=${date}`)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || "Gagal memuat aktivitas kehadiran")
  return body
}

export function useAttendanceFeed(date: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey:        ["hr-attendance-feed", date],
    queryFn:         () => fetchFeed(date),
    refetchInterval: options?.refetchInterval,
  })
}
