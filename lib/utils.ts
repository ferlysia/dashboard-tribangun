import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
import type { AnalyticsData } from "@/types/analytics"

export function parseAnalytics(data: any): AnalyticsData {
  return {
    ...data,
    totalRevenue: Number(data.totalRevenue),
    avgMonthly: Number(data.avgMonthly),
    paidRatio: Number(data.paidRatio),
    outstanding: Number(data.outstanding),
  }
}