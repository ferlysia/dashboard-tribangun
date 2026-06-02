"use client"

import * as React    from "react"
import { useRouter } from "next/navigation"
import {
  Eye, EyeOff, LogIn, ArrowRight, Shield,
  ShieldCheck, QrCode, ChevronLeft,
} from "lucide-react"
import { useCurrentUser, type AppRole } from "@/components/providers/current-user-provider"

// ─── Logo ─────────────────────────────────────────────────────────────────────

function LogoImage({ size = 56 }: { size?: number }) {
  return (
    <img
      src="/logo pt.jpg"
      alt="PT Tri Bangun Usaha Persada"
      style={{ width: size, height: size, objectFit: "contain", borderRadius: 10 }}
    />
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const LOGIN_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&display=swap');
:root { color-scheme: light !important; }

@keyframes fadeIn   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
@keyframes slideInL { from{opacity:0;transform:translateX(-30px)} to{opacity:1;transform:translateX(0)} }
@keyframes scaleIn  { 0%{opacity:0;transform:scale(.6)} 70%{transform:scale(1.06)} 100%{opacity:1;transform:scale(1)} }
@keyframes pulse-ring {
  0%  { transform:scale(.95); box-shadow:0 0 0 0 rgba(59,75,168,.4) }
  70% { transform:scale(1);   box-shadow:0 0 0 10px rgba(59,75,168,0) }
  100%{ transform:scale(.95); box-shadow:0 0 0 0 rgba(59,75,168,0) }
}
@keyframes floatUp  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
@keyframes spin     { to{transform:rotate(360deg)} }
@keyframes slideStage { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

.login-page {
  min-height:100vh; display:flex;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  background:#ffffff !important; color:#000000 !important;
}

/* ── Left ── */
.login-left {
  display:none; position:relative; overflow:hidden; flex:1.1;
  animation:slideInL .8s ease both;
}
@media(min-width:960px){.login-left{display:flex}}
.login-office-bg  { position:absolute;inset:0;background:linear-gradient(to bottom,rgba(15,15,30,.15),rgba(15,15,30,.55),rgba(15,15,30,.85)) }
.login-office-photo { position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.9 }
.left-logo-wrap   { position:absolute;top:40px;left:48px;display:flex;align-items:center;gap:12px;z-index:3;animation:fadeIn .6s ease both .1s }
.left-logo-circle { width:48px;height:48px;border-radius:14px;background:#fff !important;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,.25);animation:floatUp 3s ease-in-out infinite 1s }
.left-logo-text   { color:#fff !important;font-size:13px;font-weight:700 }
.left-logo-sub    { color:rgba(255,255,255,.65)!important;font-size:10px }
.login-left-content { margin-top:auto;padding:48px;color:#fff!important }
.left-glass-card  { background:rgba(255,255,255,.08);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:32px;animation:fadeIn .9s ease both .4s }
.left-company-name{ font-family:'Playfair Display',Georgia,serif;font-weight:900;font-size:2rem;line-height:1.2;letter-spacing:-.02em;color:#fff!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
.left-tagline     { font-size:13px;letter-spacing:.08em;opacity:.7;text-transform:uppercase;margin-bottom:20px;color:#fff!important }
.left-stat-row    { display:flex;gap:16px;flex-wrap:wrap }
.left-stat        { background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:10px 16px;text-align:center }
.left-stat-val    { font-size:1.25rem;font-weight:800;color:#fff!important }
.left-stat-label  { font-size:10px;opacity:.6;color:#fff!important }

/* ── Right ── */
.login-right       { flex:0 0 440px;display:flex;justify-content:center;align-items:center;padding:48px 40px;background:#fff!important }
@media(max-width:959px){.login-right{flex:1}}
.login-right-inner { width:100%;max-width:360px }
.right-logo-section{ text-align:center;margin-bottom:32px;animation:scaleIn .7s cubic-bezier(.22,.68,0,1.2) both }
.right-logo-wrap   { width:72px;height:72px;border-radius:20px;background:#fff!important;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;animation:pulse-ring 2.5s ease-in-out infinite 1.5s }
.right-company-name{ font-weight:800;color:#000!important;font-family:'Playfair Display',serif }
.right-company-sub { font-size:11px;opacity:.6;color:#000!important }

/* ── Card ── */
.login-card        { background:#fff!important;border:1.5px solid #e5e7eb;border-radius:20px;padding:28px 24px;animation:fadeIn .55s ease both .2s;box-shadow:0 4px 20px rgba(0,0,0,.07) }
.login-card-title  { font-size:15px;font-weight:700;color:#111827!important;margin-bottom:4px;font-family:'Playfair Display',serif }
.login-card-sub    { font-size:12px;color:#6b7280!important;margin-bottom:18px;line-height:1.5 }
.login-label       { font-size:12px;font-weight:600;margin-bottom:6px;display:block;color:#374151!important }
.login-input       { width:100%;padding:11px 14px;border-radius:11px;border:1.5px solid #d1d5db;background:#f9fafb!important;color:#000!important;font-size:14px;outline:none;transition:.15s;box-sizing:border-box }
.login-input:focus { border-color:#3B4BA8;background:#ffffff!important;box-shadow:0 0 0 3px rgba(59,75,168,.12) }
.login-divider     { height:1px;background:#e5e7eb;margin:16px 0 }
.login-btn         { width:100%;padding:12px 20px;border-radius:12px;background:#3B4BA8!important;color:#fff!important;font-weight:700;border:none;cursor:pointer;display:flex;justify-content:center;align-items:center;gap:8px;transition:.15s;box-shadow:0 4px 14px rgba(59,75,168,.35) }
.login-btn:hover   { background:#2d3a8c!important }
.login-btn:disabled{ opacity:.65;cursor:not-allowed }
.login-error       { background:#fef2f2;border:1px solid #fca5a5;color:#dc2626!important;border-radius:9px;padding:10px 12px;font-size:12px;margin-bottom:12px;animation:fadeIn .2s ease both }
.login-forgot      { font-size:11px;color:#3B4BA8!important;background:none;border:none;cursor:pointer;padding:0 }
.login-secure-badge{ margin-top:20px;font-size:11px;opacity:.6;display:flex;justify-content:center;gap:6px;color:#9ca3af!important }

/* ── 2FA specific ── */
.stage-badge {
  display:flex; align-items:center; gap:6px;
  background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px;
  padding:7px 12px; font-size:11px; font-weight:700; color:#1d4ed8;
  margin-bottom:14px;
}
.totp-digit-row   { display:flex; gap:8px; justify-content:center; margin:16px 0 }
.totp-digit {
  width:44px; height:52px; text-align:center; font-size:20px; font-weight:800;
  border:2px solid #d1d5db; border-radius:10px;
  background:#f9fafb!important; color:#111827!important;
  outline:none; transition:.15s; caret-color:transparent;
}
.totp-digit:focus { border-color:#3B4BA8; background:#fff!important; box-shadow:0 0 0 3px rgba(59,75,168,.12) }
.totp-digit.filled{ border-color:#3B4BA8; color:#3B4BA8!important; background:#eff6ff!important }
.totp-hint        { font-size:11px; color:#9ca3af; text-align:center; line-height:1.5; margin-top:4px }

.qr-wrap {
  display:flex; flex-direction:column; align-items:center; gap:12px;
  padding:20px; background:#f9fafb; border-radius:14px; border:1px solid #e5e7eb;
  margin-bottom:16px;
}
.qr-wrap img { border-radius:8px; border:1px solid #e5e7eb }
.secret-label { font-size:10px; color:#9ca3af; text-align:center; margin-bottom:4px }
.secret-key {
  font-family:monospace; font-size:12px; font-weight:700; letter-spacing:.18em;
  color:#374151!important; background:#fff; border:1px dashed #d1d5db;
  border-radius:8px; padding:8px 14px; text-align:center; word-break:break-all;
}
.back-btn {
  display:flex; align-items:center; gap:4px; margin-top:12px;
  background:none; border:none; cursor:pointer;
  font-size:11px; color:#9ca3af; padding:0; transition:.15s;
}
.back-btn:hover { color:#374151 }
.spinner { width:16px;height:16px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite }
`

// ─── OTP Input Component ───────────────────────────────────────────────────────

function OTPInput({ value, onChange, onComplete, disabled }: {
  value:      string
  onChange:   (v: string) => void
  onComplete?: () => void
  disabled:   boolean
}) {
  const r0 = React.useRef<HTMLInputElement>(null)
  const r1 = React.useRef<HTMLInputElement>(null)
  const r2 = React.useRef<HTMLInputElement>(null)
  const r3 = React.useRef<HTMLInputElement>(null)
  const r4 = React.useRef<HTMLInputElement>(null)
  const r5 = React.useRef<HTMLInputElement>(null)
  const refs = [r0, r1, r2, r3, r4, r5]

  const padded = value.padEnd(6, " ").slice(0, 6)

  // Auto-focus first box on mount
  React.useEffect(() => { r0.current?.focus() }, [])

  // Auto-submit when all 6 digits entered
  React.useEffect(() => {
    if (value.replace(/\s/g, "").length === 6) onComplete?.()
  }, [value, onComplete])

  const handleChange = (i: number, v: string) => {
    const digit = v.replace(/\D/g, "").slice(-1)
    if (!digit) return
    const arr = padded.split("")
    arr[i] = digit
    onChange(arr.join("").trimEnd())
    if (i < 5) setTimeout(() => refs[i + 1].current?.focus(), 0)
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault()
      const arr = padded.split("")
      arr[i] = " "
      onChange(arr.join("").trimEnd())
      if (i > 0) setTimeout(() => refs[i - 1].current?.focus(), 0)
    } else if (e.key === "ArrowLeft"  && i > 0) { refs[i - 1].current?.focus() }
      else if (e.key === "ArrowRight" && i < 5) { refs[i + 1].current?.focus() }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    onChange(pasted)
    setTimeout(() => refs[Math.min(pasted.length, 5)].current?.focus(), 0)
  }

  return (
    <div className="totp-digit-row">
      {refs.map((ref, i) => {
        const ch = padded[i]
        const filled = ch !== " " && ch !== undefined && ch !== ""
        return (
          <input
            key={i}
            ref={ref}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={filled ? ch : ""}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={handlePaste}
            disabled={disabled}
            autoComplete="one-time-code"
            title={`Digit ke-${i + 1} dari kode OTP`}
            aria-label={`Digit ${i + 1} dari 6`}
            placeholder="·"
            className={`totp-digit${filled ? " filled" : ""}`}
          />
        )
      })}
    </div>
  )
}

// ─── Stage types ──────────────────────────────────────────────────────────────

type Stage = "password" | "setup_totp" | "verify_totp"

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()
  const { setUser } = useCurrentUser()

  // ── Determine redirect target from ?next= ─────────────────────────────────
  const [nextUrl, setNextUrl] = React.useState("/dashboard")
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const n = params.get("next") ?? ""
    if (n.startsWith("/") && !n.startsWith("//")) setNextUrl(n)
  }, [])

  // ── Stage machine ─────────────────────────────────────────────────────────
  const [stage,      setStage]      = React.useState<Stage>("password")
  const [tempToken,  setTempToken]  = React.useState("")
  const [userName,   setUserName]   = React.useState("")
  const [userEmail,  setUserEmail]  = React.useState("")

  // ── Password stage ────────────────────────────────────────────────────────
  const [showPw,   setShowPw]   = React.useState(false)
  const [email,    setEmail]    = React.useState("")
  const [password, setPassword] = React.useState("")

  // ── TOTP setup stage ──────────────────────────────────────────────────────
  const [qrDataUrl,   setQrDataUrl]   = React.useState("")
  const [totpSecret,  setTotpSecret]  = React.useState("")
  const [loadingQr,   setLoadingQr]   = React.useState(false)

  // ── OTP value ─────────────────────────────────────────────────────────────
  const [otp, setOtp] = React.useState("")

  // ── Status ────────────────────────────────────────────────────────────────
  const [error,   setError]   = React.useState("")
  const [loading, setLoading] = React.useState(false)

  // ── Fetch QR when entering setup stage ───────────────────────────────────
  React.useEffect(() => {
    if (stage !== "setup_totp" || !tempToken) return
    setLoadingQr(true)
    fetch("/api/auth/totp/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tempToken }),
    })
      .then(r => r.json())
      .then(d => { setQrDataUrl(d.qrDataUrl ?? ""); setTotpSecret(d.secret ?? "") })
      .catch(() => setError("Gagal memuat QR code. Silakan coba lagi."))
      .finally(() => setLoadingQr(false))
  }, [stage, tempToken])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resetToPassword = () => {
    setStage("password"); setOtp(""); setError("")
    setTempToken(""); setQrDataUrl(""); setTotpSecret("")
  }

  const formatSecret = (s: string) => s.match(/.{1,4}/g)?.join(" ") ?? s

  const finalise = (name: string, email: string, role?: AppRole) => {
    setUser({ name, firstName: name.split(" ")[0], email, role })
    router.push(nextUrl)
  }

  // ── Handler: step 1 — password ───────────────────────────────────────────
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email || !password) { setError("Email dan password wajib diisi."); return }
    setLoading(true)
    try {
      const res  = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Login gagal."); return }
      setTempToken(data.tempToken)
      setUserName(data.name ?? "")
      setUserEmail(email.trim().toLowerCase())
      setStage(data.status as Stage)
    } catch { setError("Tidak dapat terhubung ke server.") }
    finally  { setLoading(false) }
  }

  // ── Handler: step 2a — first-time TOTP confirm ───────────────────────────
  const handleSetupConfirm = React.useCallback(async () => {
    const clean = otp.replace(/\s/g, "")
    if (clean.length < 6 || loading) return
    setError("")
    setLoading(true)
    try {
      const res  = await fetch("/api/auth/totp/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, secret: totpSecret, otp: clean }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Verifikasi gagal."); setOtp(""); return }
      finalise(userName, userEmail, data.role as AppRole | undefined)
    } catch { setError("Tidak dapat terhubung ke server.") }
    finally  { setLoading(false) }
  }, [otp, loading, tempToken, totpSecret, userName, userEmail]) // eslint-disable-line

  // ── Handler: step 2b — returning-user TOTP verify ────────────────────────
  const handleVerifyOtp = React.useCallback(async () => {
    const clean = otp.replace(/\s/g, "")
    if (clean.length < 6 || loading) return
    setError("")
    setLoading(true)
    try {
      const res  = await fetch("/api/auth/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, otp: clean }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Kode OTP tidak valid."); setOtp(""); return }
      finalise(userName, userEmail, data.role as AppRole | undefined)
    } catch { setError("Tidak dapat terhubung ke server.") }
    finally  { setLoading(false) }
  }, [otp, loading, tempToken, userName, userEmail]) // eslint-disable-line

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LOGIN_STYLES }} />

      <div className="login-page">

        {/* ── LEFT panel (branding) ── */}
        <div className="login-left">
          <div className="login-office-bg" />
          <img src="/office-bg.jpg" className="login-office-photo" alt="" />
          <div className="left-logo-wrap">
            <div className="left-logo-circle"><LogoImage size={28} /></div>
            <div>
              <div className="left-logo-text">TUP Dashboard</div>
              <div className="left-logo-sub">Internal Business System</div>
            </div>
          </div>
          <div className="login-left-content">
            <div className="left-glass-card">
              <h2 className="left-company-name">PT Tri Bangun Usaha Persada</h2>
              <p className="left-tagline">Distributor PAC · Automation & Control</p>
              <div className="left-stat-row">
                <div className="left-stat">
                  <div className="left-stat-val">2025–2026</div>
                  <div className="left-stat-label">Fiscal Year</div>
                </div>
                <div className="left-stat">
                  <div className="left-stat-val">Jakarta</div>
                  <div className="left-stat-label">HQ</div>
                </div>
                <div className="left-stat">
                  <div className="left-stat-val">PAC</div>
                  <div className="left-stat-label">Distributor</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT panel (form) ── */}
        <div className="login-right">
          <div className="login-right-inner">

            {/* Logo */}
            <div className="right-logo-section">
              <div className="right-logo-wrap"><LogoImage size={48} /></div>
              <div className="right-company-name">PT TRI BANGUN<br />USAHA PERSADA</div>
              <div className="right-company-sub">Business Dashboard · 2025–2026</div>
            </div>

            {/* ── Stage 1: Email + Password ── */}
            {stage === "password" && (
              <div className="login-card">
                <p className="login-card-title">Masuk ke Dashboard</p>
                <p className="login-card-sub">Gunakan email dan password akun perusahaan Anda</p>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label className="login-label">Email Perusahaan</label>
                    <input
                      className="login-input"
                      type="email"
                      placeholder="nama@tup.id"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      disabled={loading}
                      autoComplete="email"
                      autoFocus
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label className="login-label" style={{ marginBottom: 0 }}>Password</label>
                      <button type="button" className="login-forgot">Lupa password?</button>
                    </div>
                    <div style={{ position: "relative" }}>
                      <input
                        className="login-input"
                        style={{ paddingRight: 42 }}
                        type={showPw ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        disabled={loading}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        aria-label={showPw ? "Sembunyikan password" : "Tampilkan password"}
                        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="login-divider" />

                  <button type="submit" className="login-btn" disabled={loading}>
                    {loading
                      ? <div className="spinner" />
                      : <><LogIn size={15} /> Lanjutkan <ArrowRight size={14} /></>}
                  </button>
                </form>
              </div>
            )}

            {/* ── Stage 2a: TOTP First-Time Setup ── */}
            {stage === "setup_totp" && (
              <div className="login-card" style={{ animation: "slideStage .35s ease both" }}>
                <div className="stage-badge">
                  <QrCode size={12} /> Langkah 2 dari 2 — Aktifkan Autentikator
                </div>
                <p className="login-card-title">Setel Google Authenticator</p>
                <p className="login-card-sub">
                  Scan QR code di bawah dengan Google Authenticator atau Microsoft Authenticator,
                  lalu masukkan kode 6 digit yang muncul untuk mengaktifkan 2FA.
                </p>

                {error && <div className="login-error">{error}</div>}

                <div className="qr-wrap">
                  {loadingQr && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af", fontSize: 12 }}>
                      <div className="spinner" style={{ borderColor: "#d1d5db", borderTopColor: "#9ca3af" }} />
                      Memuat QR code…
                    </div>
                  )}
                  {!loadingQr && qrDataUrl && (
                    <img src={qrDataUrl} alt="TOTP QR Code" width={200} height={200} />
                  )}
                  {!loadingQr && totpSecret && (
                    <div style={{ width: "100%", textAlign: "center" }}>
                      <p className="secret-label">Atau masukkan kode ini secara manual di aplikasi Anda:</p>
                      <div className="secret-key">{formatSecret(totpSecret)}</div>
                    </div>
                  )}
                </div>

                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", textAlign: "center", margin: "4px 0" }}>
                  Masukkan kode 6 digit dari aplikasi autentikator
                </p>
                <OTPInput
                  value={otp}
                  onChange={setOtp}
                  onComplete={handleSetupConfirm}
                  disabled={loading}
                />
                <p className="totp-hint">
                  Kode berubah setiap 30 detik · Jangan bagikan kode ini kepada siapapun
                </p>

                <div className="login-divider" />

                <button
                  type="button"
                  className="login-btn"
                  disabled={loading || otp.replace(/\s/g, "").length < 6}
                  onClick={handleSetupConfirm}
                >
                  {loading
                    ? <div className="spinner" />
                    : <><ShieldCheck size={15} /> Aktifkan 2FA &amp; Masuk</>}
                </button>

                <button type="button" className="back-btn" onClick={resetToPassword}>
                  <ChevronLeft size={13} /> Kembali ke halaman login
                </button>
              </div>
            )}

            {/* ── Stage 2b: TOTP Verification (returning user) ── */}
            {stage === "verify_totp" && (
              <div className="login-card" style={{ animation: "slideStage .35s ease both" }}>
                <div className="stage-badge">
                  <ShieldCheck size={12} /> Langkah 2 dari 2 — Verifikasi 2FA
                </div>
                <p className="login-card-title">Masukkan Kode Autentikator</p>
                <p className="login-card-sub">
                  Buka aplikasi autentikator dan masukkan kode 6 digit untuk&nbsp;
                  <strong style={{ color: "#111827" }}>{userEmail || email}</strong>.
                </p>

                {error && <div className="login-error">{error}</div>}

                <OTPInput
                  value={otp}
                  onChange={setOtp}
                  onComplete={handleVerifyOtp}
                  disabled={loading}
                />
                <p className="totp-hint">
                  Kode berubah setiap 30 detik · Jangan bagikan kode ini kepada siapapun
                </p>

                <div className="login-divider" />

                <button
                  type="button"
                  className="login-btn"
                  disabled={loading || otp.replace(/\s/g, "").length < 6}
                  onClick={handleVerifyOtp}
                >
                  {loading
                    ? <div className="spinner" />
                    : <><ShieldCheck size={15} /> Verifikasi &amp; Masuk</>}
                </button>

                <button type="button" className="back-btn" onClick={resetToPassword}>
                  <ChevronLeft size={13} /> Kembali ke halaman login
                </button>
              </div>
            )}

            <div className="login-secure-badge">
              <Shield size={12} />
              Dilindungi 2FA · Akses terbatas · PT Tri Bangun Usaha Persada
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
