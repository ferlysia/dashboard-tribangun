"use client"

import * as React       from "react"
import { useRouter }    from "next/navigation"
import { ShieldX, ArrowLeft, Home, Lock } from "lucide-react"

export default function ForbiddenPage() {
  const router = useRouter()

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#ffffff",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: "40px 20px",
    }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseBorder {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,.35); }
          50%       { box-shadow: 0 0 0 12px rgba(220,38,38,0); }
        }
      `}</style>

      <div style={{ maxWidth: 420, width: "100%", textAlign: "center", animation: "fadeUp .5s ease both" }}>

        {/* Icon */}
        <div style={{
          width: 88, height: 88, borderRadius: 26,
          background: "#fef2f2", border: "2px solid #fca5a5",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 28px",
          animation: "pulseBorder 2.5s ease-in-out infinite",
        }}>
          <ShieldX size={40} color="#dc2626" strokeWidth={1.75} />
        </div>

        {/* Code */}
        <p style={{
          fontSize: 80, fontWeight: 900, color: "#111827",
          lineHeight: 1, margin: "0 0 8px",
          letterSpacing: "-0.04em",
        }}>403</p>

        <h1 style={{
          fontSize: 22, fontWeight: 800, color: "#374151",
          margin: "0 0 12px",
        }}>
          Akses Ditolak
        </h1>

        <p style={{
          fontSize: 14, color: "#6b7280", lineHeight: 1.65,
          margin: "0 0 12px",
        }}>
          Anda tidak memiliki izin untuk mengakses halaman ini.
          Hak akses divisi Anda tidak mencakup resource yang diminta.
        </p>

        {/* Role badge hint */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "#fef2f2", border: "1px solid #fca5a5",
          borderRadius: 8, padding: "6px 14px",
          fontSize: 11, fontWeight: 700, color: "#dc2626",
          marginBottom: 32,
        }}>
          <Lock size={11} />
          Halaman ini dibatasi berdasarkan peran pengguna
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 22px", borderRadius: 10,
              background: "#f9fafb", border: "1.5px solid #e5e7eb",
              cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151",
              transition: ".15s",
            }}
          >
            <ArrowLeft size={14} /> Kembali
          </button>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 22px", borderRadius: 10,
              background: "#3B4BA8", border: "none",
              cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff",
              boxShadow: "0 4px 14px rgba(59,75,168,.35)",
              transition: ".15s",
            }}
          >
            <Home size={14} /> Ke Dashboard
          </button>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 48, display: "flex", alignItems: "center",
          justifyContent: "center", gap: 6, color: "#d1d5db", fontSize: 11,
        }}>
          <Lock size={10} />
          TUP Dashboard · Sistem Akses Terbatas · PT Tri Bangun Usaha Persada
        </div>
      </div>
    </div>
  )
}
