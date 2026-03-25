"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, LogIn, ArrowRight, Shield } from "lucide-react"
import { useCurrentUser } from "@/components/providers/current-user-provider"

/* ───────────────── LOGO IMAGE ───────────────── */
function LogoImage({ size = 56 }: { size?: number }) {
  return (
    <img
      src="/logo pt.jpg"
      alt="PT Tri Bangun Usaha Persada Logo"
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        borderRadius: 10,
      }}
    />
  )
}

const LOGIN_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&display=swap');

/* MENGUNCI TAMPILAN AGAR TETAP LIGHT MODE */
:root {
  color-scheme: light !important;
}

/* ================== ANIMATIONS (TIDAK DIUBAH) ================== */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes scaleInLogo {
  0% { opacity: 0; transform: scale(0.6); }
  70% { transform: scale(1.06); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes pulse-ring {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59,75,168,.4); }
  70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(59,75,168,0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59,75,168,0); }
}
@keyframes floatUp {
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ================== PAGE ================== */
.login-page {
  min-height: 100vh;
  display: flex;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #ffffff !important;
  color: #000000 !important;
}

/* ================== LEFT ================== */
.login-left {
  display: none;
  position: relative;
  overflow: hidden;
  flex: 1.1;
  animation: slideInLeft .8s ease both;
}
@media(min-width:960px){ .login-left{display:flex} }

.login-office-bg {
  position:absolute;
  inset:0;
  background:
    linear-gradient(to bottom,
      rgba(15,15,30,.15),
      rgba(15,15,30,.55),
      rgba(15,15,30,.85)
    );
}

.login-office-photo {
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  object-fit:cover;
  opacity:.9;
}

.left-logo-wrap {
  position:absolute;
  top:40px;
  left:48px;
  display:flex;
  align-items:center;
  gap:12px;
  z-index:3;
  animation: fadeIn .6s ease both .1s;
}
.left-logo-circle {
  width:48px;
  height:48px;
  border-radius:14px;
  background:#fff !important;
  display:flex;
  align-items:center;
  justify-content:center;
  box-shadow:0 4px 20px rgba(0,0,0,.25);
  animation: floatUp 3s ease-in-out infinite 1s;
}
.left-logo-text { color:#fff !important; font-size:13px; font-weight:700 }
.left-logo-sub { color:rgba(255,255,255,.65) !important; font-size:10px }

.login-left-content {
  margin-top:auto;
  padding:48px;
  color:#fff !important;
}

.left-glass-card {
  background:rgba(255,255,255,.08);
  backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
  border:1px solid rgba(255,255,255,.15);
  border-radius:20px;
  padding:32px;
  animation: fadeIn .9s ease both .4s;
}

.left-company-name {
  font-family:'Playfair Display', Georgia, serif;
  font-weight:900;
  font-size:2rem;
  line-height:1.2;
  letter-spacing:-0.02em;
  color:#fff !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.left-tagline {
  font-size:13px;
  letter-spacing:.08em;
  opacity:.7;
  text-transform:uppercase;
  margin-bottom:20px;
  color: #fff !important;
}

.left-stat-row {
  display:flex;
  gap:16px;
  flex-wrap:wrap;
}
.left-stat {
  background:rgba(255,255,255,.1);
  border:1px solid rgba(255,255,255,.15);
  border-radius:12px;
  padding:10px 16px;
  text-align:center;
}
.left-stat-val { font-size:1.25rem; font-weight:800; color: #fff !important; }
.left-stat-label { font-size:10px; opacity:.6; color: #fff !important; }

/* ================== RIGHT ================== */
.login-right {
  flex:0 0 440px;
  display:flex;
  justify(content):center;
  align-items:center;
  padding:48px 40px;
  background:#fff !important;
}
@media(max-width:959px){ .login-right{flex:1} }

.login-right-inner {
  width:100%;
  max-width:360px;
}

.right-logo-section {
  text-align:center;
  margin-bottom:32px;
  animation: scaleInLogo .7s cubic-bezier(.22,.68,0,1.2) both;
}
.right-logo-wrap {
  width:72px;
  height:72px;
  border-radius:20px;
  background:#fff !important;
  border:1px solid #e5e7eb;
  display:flex;
  align-items:center;
  justify-content:center;
  margin:0 auto 16px;
  animation: pulse-ring 2.5s ease-in-out infinite 1.5s;
}
.right-company-name { font-weight:800; color: #000 !important; font-family: 'Playfair Display', serif; }
.right-company-sub { font-size:11px; opacity:.6; color: #000 !important; }

/* ================== FORM (TAKEN FROM YOUR CODE) ================== */
.login-card {
  background:#fff !important;
  border:1.5px solid #e5e7eb;
  border-radius:20px;
  padding:28px 24px;
  animation: fadeIn .55s ease both .2s;
  box-shadow: 0 4px 20px rgba(0,0,0,.07);
}

.login-card-title { font-size: 15px; font-weight: 700; color: #111827 !important; margin-bottom: 4px; font-family: 'Playfair Display', serif; }
.login-card-sub { font-size: 12px; color: #6b7280 !important; margin-bottom: 18px; line-height: 1.5; }

.login-label {
  font-size:12px;
  font-weight:600;
  margin-bottom:6px;
  display:block;
  color: #374151 !important;
}

.login-input {
  width:100%;
  padding:11px 14px;
  border-radius:11px;
  border:1.5px solid #d1d5db;
  background:#f9fafb !important;
  color: #000 !important;
  font-size:14px;
  outline: none;
  transition:.15s;
}
.login-input:focus {
  border-color:#3B4BA8;
  background: #ffffff !important;
  box-shadow:0 0 0 3px rgba(59,75,168,.12);
}

.login-divider { height: 1px; background: #e5e7eb; margin: 16px 0; }

.login-btn {
  width:100%;
  padding:12px 20px;
  border-radius:12px;
  background:#3B4BA8 !important;
  color:#fff !important;
  font-weight:700;
  border:none;
  cursor:pointer;
  display:flex;
  justify-content:center;
  align-items:center;
  gap:8px;
  transition:.15s;
  box-shadow: 0 4px 14px rgba(59,75,168,.35);
}
.login-btn:disabled { opacity: .65; cursor: not-allowed; }

.login-error {
  background: #fef2f2; border: 1px solid #fca5a5;
  color: #dc2626 !important; border-radius: 9px;
  padding: 10px 12px; font-size: 12px;
  margin-bottom: 12px;
  animation: fadeIn .2s ease both;
}

.login-forgot { font-size: 11px; color: #3B4BA8 !important; background: none; border: none; cursor: pointer; padding: 0; }

.login-secure-badge {
  margin-top:20px;
  font-size:11px;
  opacity:.6;
  display:flex;
  justify-content:center;
  gap:6px;
  color: #9ca3af !important;
}
`

export default function LoginPage() {
  const router = useRouter()
  const { setUser } = useCurrentUser()
  const [showPw, setShowPw] = React.useState(false)
  const [fullName, setFullName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!fullName || !email || !password) { setError("Harap isi nama, email dan password terlebih dahulu."); return }
    if (password.length < 6) { setError("Password harus minimal 6 karakter."); return }
    
    setLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    const cleanName = fullName.trim().replace(/\s+/g, " ")
    setUser({
      name: cleanName,
      firstName: cleanName.split(" ")[0],
      email: email.trim().toLowerCase(),
    })
    router.push("/dashboard")
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LOGIN_STYLES }} />

      <div className="login-page">
        {/* LEFT (PROSE/PHOTOS - RETAINED) */}
        <div className="login-left">
          <div className="login-office-bg" />
          <img src="/office-bg.jpg" className="login-office-photo" />
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
                  <div className="left-stat-val">2025-2026</div>
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

        {/* RIGHT (FORM FILL - FROM YOUR CODE) */}
        <div className="login-right">
          <div className="login-right-inner">
            <div className="right-logo-section">
              <div className="right-logo-wrap"><LogoImage size={48} /></div>
              <div className="right-company-name">PT TRI BANGUN<br />USAHA PERSADA</div>
              <div className="right-company-sub">Business Dashboard · 2025-2026</div>
            </div>

            <div className="login-card">
              <p className="login-card-title">Masuk ke Dashboard</p>
              <p className="login-card-sub">Gunakan akun perusahaan kamu untuk masuk</p>

              {error && <div className="login-error">{error}</div>}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="login-label">Nama Lengkap</label>
                  <input
                    className="login-input"
                    placeholder="nama lengkap"
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    disabled={loading}
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label className="login-label">Email Perusahaan</label>
                  <input
                    className="login-input"
                    placeholder="nama@tup.id"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="login-label" style={{ marginBottom: 0 }}>Password</label>
                    <button type="button" className="login-forgot">Lupa password?</button>
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      className="login-input"
                      style={{ paddingRight: '42px' }}
                      type={showPw ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      disabled={loading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="login-divider" />

                <button type="submit" className="login-btn" disabled={loading}>
                  {loading ? (
                    <div style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                  ) : (
                    <>
                      <LogIn size={15} />
                      Masuk ke Dashboard
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="login-secure-badge">
              <Shield size={12} />
              Akses terbatas · Karyawan PT Tri Bangun Usaha Persada
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
