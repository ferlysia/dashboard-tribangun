"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, LogIn, ArrowRight, Shield } from "lucide-react"

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

/* ================== PAGE ================== */
.login-page {
  min-height: 100vh;
  display: flex;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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
  background:#fff;
  display:flex;
  align-items:center;
  justify-content:center;
  box-shadow:0 4px 20px rgba(0,0,0,.25);
  animation: floatUp 3s ease-in-out infinite 1s;
}
.left-logo-text { color:#fff; font-size:13px; font-weight:700 }
.left-logo-sub { color:rgba(255,255,255,.65); font-size:10px }

.login-left-content {
  margin-top:auto;
  padding:48px;
  color:#fff;
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

/* NAMA PERUSAHAAN — SATU BARIS (TETAP) */
.left-company-name {
  font-family:'Playfair Display', Georgia, serif;
  font-weight:900;
  font-size:2rem;
  line-height:1.2;
  letter-spacing:-0.02em;
  color:#fff;
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
.left-stat-val { font-size:1.25rem; font-weight:800 }
.left-stat-label { font-size:10px; opacity:.6 }

/* ================== RIGHT ================== */
.login-right {
  flex:0 0 440px;
  display:flex;
  justify-content:center;
  align-items:center;
  padding:48px 40px;
  background:#fff;
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
  background:#fff;
  border:1px solid #e5e7eb;
  display:flex;
  align-items:center;
  justify-content:center;
  margin:0 auto 16px;
  animation: pulse-ring 2.5s ease-in-out infinite 1.5s;
}
.right-company-name { font-weight:800 }
.right-company-sub { font-size:11px; opacity:.6 }

/* ================== FORM ================== */
.login-card {
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:20px;
  padding:28px 24px;
  animation: fadeIn .55s ease both .2s;
}

.login-label {
  font-size:12px;
  font-weight:600;
  margin-bottom:6px;
  display:block;
}

.login-input {
  width:100%;
  padding:12px 14px;
  border-radius:12px;
  border:1.5px solid #d1d5db;
  background:linear-gradient(180deg,#ffffff,#f9fafb);
  font-size:14px;
  transition:.15s;
}
.login-input:focus {
  border-color:#3B4BA8;
  box-shadow:0 0 0 3px rgba(59,75,168,.12);
  outline:none;
}

.login-btn {
  width:100%;
  margin-top:14px;
  padding:12px;
  border-radius:12px;
  background:#3B4BA8;
  color:#fff;
  font-weight:700;
  border:none;
  cursor:pointer;
  display:flex;
  justify-content:center;
  align-items:center;
  gap:8px;
  transition:.15s;
}
.login-btn:hover { transform:translateY(-2px) }

.login-secure-badge {
  margin-top:20px;
  font-size:11px;
  opacity:.6;
  display:flex;
  justify-content:center;
  gap:6px;
}
`

export default function LoginPage() {
  const router = useRouter()
  const [showPw, setShowPw] = React.useState(false)
  
  // State untuk menyimpan input
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")

  // Fungsi Login dengan Validasi
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()

    // Validasi Sederhana
    if (!email || !password) {
      alert("Harap isi email dan password terlebih dahulu!")
      return
    }

    if (password.length < 6) {
      alert("Password harus minimal 6 karakter!")
      return
    }

    // Jika validasi lolos, baru pindah halaman
    router.push("/dashboard")
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LOGIN_STYLES }} />

      <div className="login-page">

        {/* LEFT */}
        <div className="login-left">
          <div className="login-office-bg" />
          <img src="/office-bg.jpg" className="login-office-photo" />

          <div className="left-logo-wrap">
            <div className="left-logo-circle">
              <LogoImage size={28} />
            </div>
            <div>
              <div className="left-logo-text">TUP Dashboard</div>
              <div className="left-logo-sub">Internal Business System</div>
            </div>
          </div>

          <div className="login-left-content">
            <div className="left-glass-card">
              <h2 className="left-company-name">
                PT Tri Bangun Usaha Persada
              </h2>
              <p className="left-tagline">
                Distributor PAC · Automation & Control
              </p>
              <div className="left-stat-row">
                <div className="left-stat">
                  <div className="left-stat-val">2025</div>
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

        {/* RIGHT */}
        <div className="login-right">
          <div className="login-right-inner">

            <div className="right-logo-section">
              <div className="right-logo-wrap">
                <LogoImage size={44} />
              </div>
              <div className="right-company-name">
                PT TRI BANGUN<br />USAHA PERSADA
              </div>
              <div className="right-company-sub">
                Business Dashboard · 2025
              </div>
            </div>

            <div className="login-card">
              <form onSubmit={handleLogin}>
                <label className="login-label">Email Perusahaan</label>
                <input 
                  className="login-input" 
                  placeholder="nama@tup.id" 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                <label className="login-label" style={{ marginTop: 14 }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    className="login-input"
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer"
                    }}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <button
                  type="submit"
                  className="login-btn"
                >
                  <LogIn size={16} />
                  Masuk ke Dashboard
                  <ArrowRight size={14} />
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