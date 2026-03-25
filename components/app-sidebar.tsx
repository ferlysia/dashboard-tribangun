"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Clock,
  FolderKanban,
  Settings,
  HelpCircle,
  Search,
  Mail,
  MoreHorizontal,
  ChevronUp,
  ExternalLink,
  Bell,
  UserCircle,
  LogOut,
  Database,
  FileText,
  Plus,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCurrentUser } from "@/components/providers/current-user-provider"

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV_MAIN = [
  { title: "Dashboard",  url: "/dashboard",  icon: LayoutDashboard },
  { title: "Analytics",  url: "/analytics",  icon: BarChart3       },
  { title: "Clients",    url: "/clients",    icon: Users           },
  { title: "Lifecycle",  url: "/lifecycle",  icon: Clock           },
  { title: "Projects",   url: "/projects",   icon: FolderKanban   },
]

const NAV_DOCS = [
  { title: "Excel Data", url: "/excel-data", icon: Database },
  { title: "Reports",    url: "/reports", icon: FileText },
]

const APP_SIDEBAR_STYLES = `
  /* ── Active nav item: bold + colored bg + left accent bar ── */
  [data-sidebar="menu-button"][data-active="true"] {
    background: linear-gradient(90deg, hsl(var(--primary) / 0.22), hsl(var(--primary) / 0.10)) !important;
    color: hsl(var(--primary)) !important;
    font-weight: 800 !important;
    position: relative;
    border: 1px solid hsl(var(--primary) / 0.24) !important;
    box-shadow: inset 0 0 0 1px hsl(var(--primary) / 0.06), 0 8px 20px -12px hsl(var(--primary) / 0.45);
  }
  [data-sidebar="menu-button"][data-active="true"]::before {
    content: '';
    position: absolute;
    left: 0; top: 16%; bottom: 16%;
    width: 4px;
    border-radius: 0 6px 6px 0;
    background: hsl(var(--primary));
    box-shadow: 0 0 18px hsl(var(--primary) / 0.55);
  }
  [data-sidebar="menu-button"][data-active="true"] svg {
    color: hsl(var(--primary)) !important;
    opacity: 1 !important;
  }
  [data-sidebar="menu-button"][data-active="true"] span {
    color: hsl(var(--primary)) !important;
  }

  /* ── All icons always visible ── */
  [data-sidebar="menu-button"] svg {
    color: hsl(var(--sidebar-foreground) / 0.6) !important;
    opacity: 1 !important;
  }
  [data-sidebar="menu-button"]:hover svg {
    color: hsl(var(--sidebar-foreground)) !important;
  }

  /* ── Active item pulse dot ── */
  @keyframes activePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.6; transform: scale(0.85); }
  }
  .nav-active-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: hsl(var(--primary));
    margin-left: auto; flex-shrink: 0;
    animation: activePulse 2s ease-in-out infinite;
    box-shadow: 0 0 14px hsl(var(--primary) / 0.6);
  }
  .nav-active-pill {
    margin-left: auto;
    flex-shrink: 0;
    padding: 2px 6px;
    border-radius: 999px;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.08em;
    box-shadow: 0 0 14px hsl(var(--primary) / 0.45);
    animation: activePulse 2s ease-in-out infinite;
  }

  /* ── Quick Create button ── */
  .quick-create-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 14px 15px;
    border-radius: 16px;
    background:
      linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.88) 55%, hsl(var(--primary) / 0.74) 100%) !important;
    color: hsl(var(--primary-foreground)) !important;
    font-size: 13px;
    font-weight: 800;
    border: 1px solid hsl(var(--primary) / 0.34) !important;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s, filter 0.15s;
    box-shadow:
      0 18px 38px -18px hsl(var(--primary) / 0.72),
      inset 0 1px 0 hsl(0 0% 100% / 0.28),
      inset 0 -1px 0 hsl(0 0% 0% / 0.08) !important;
    letter-spacing: 0.01em;
    position: relative;
    overflow: hidden;
    isolation: isolate;
  }
  .quick-create-btn::after {
    content: '';
    position: absolute;
    inset: 1px;
    border-radius: 15px;
    background: linear-gradient(180deg, hsl(0 0% 100% / 0.12), transparent 42%, hsl(0 0% 0% / 0.08));
    pointer-events: none;
    z-index: -1;
  }
  .quick-create-btn:hover {
    opacity: 1;
    transform: translateY(-1px) scale(1.012);
    filter: saturate(1.04);
    box-shadow:
      0 22px 40px -18px hsl(var(--primary) / 0.82),
      inset 0 1px 0 hsl(0 0% 100% / 0.32),
      inset 0 -1px 0 hsl(0 0% 0% / 0.1);
  }
  .quick-create-btn:active { transform: scale(0.97); }
  .quick-create-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: hsl(0 0% 100% / 0.18);
    color: hsl(var(--primary-foreground)) !important;
    border: 1px solid hsl(0 0% 100% / 0.28);
    flex-shrink: 0;
    box-shadow: inset 0 1px 0 hsl(0 0% 100% / 0.26);
  }
  .quick-create-copy {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
  }
  .quick-create-title {
    line-height: 1.1;
    color: hsl(var(--primary-foreground)) !important;
    font-size: 14px;
    font-weight: 900;
  }
  .quick-create-note {
    font-size: 11px;
    color: hsl(var(--primary-foreground) / 0.9) !important;
    line-height: 1.25;
    margin-top: 4px;
    text-align: left;
    font-weight: 600;
  }
  .quick-create-sub {
    display: none;
  }
  .quick-actions-menu {
    border: 1px solid hsl(var(--primary) / 0.18) !important;
    background:
      linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--primary) / 0.05) 100%) !important;
    box-shadow: 0 18px 40px -20px hsl(var(--primary) / 0.55) !important;
    overflow: hidden;
  }
  .quick-actions-item {
    font-size: 13px;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .quick-actions-item:hover,
  .quick-actions-item:focus {
    background: hsl(var(--primary) / 0.12) !important;
    color: hsl(var(--primary)) !important;
  }
  .quick-actions-item:hover svg,
  .quick-actions-item:focus svg {
    color: hsl(var(--primary)) !important;
  }

  /* ── Search modal ── */
  @keyframes searchFadeIn {
    from { opacity: 0; transform: scale(0.96); }
    to   { opacity: 1; transform: scale(1); }
  }
  .search-modal-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.5);
    backdrop-filter: blur(4px);
    display: flex; align-items: flex-start; justify-content: center;
    padding-top: 100px;
  }
  .search-modal {
    background: hsl(var(--background));
    border: 1px solid hsl(var(--border));
    border-radius: 16px;
    width: 100%; max-width: 560px;
    box-shadow: 0 24px 60px -12px rgba(0,0,0,0.35);
    overflow: hidden;
    animation: searchFadeIn 0.18s ease both;
  }
  .search-input-wrap {
    display: flex; align-items: center; gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid hsl(var(--border));
  }
  .search-input {
    flex: 1; background: transparent; border: none; outline: none;
    font-size: 15px; color: hsl(var(--foreground));
  }
  .search-input::placeholder { color: hsl(var(--muted-foreground)); }
  .search-result-item {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 20px; cursor: pointer;
    transition: background 0.1s; font-size: 13px;
    color: hsl(var(--foreground)); text-decoration: none;
  }
  .search-result-item:hover { background: hsl(var(--muted) / 0.5); }
  .search-result-item svg { color: hsl(var(--muted-foreground)); flex-shrink: 0; }

  /* ── Email modal ── */
  .email-modal {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.52); backdrop-filter: blur(7px);
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }
  .email-card {
    background:
      linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--card)) 72%, hsl(var(--primary) / 0.06) 100%);
    border: 1px solid hsl(var(--primary) / 0.18);
    border-radius: 22px; width: 100%; max-width: 620px;
    box-shadow: 0 34px 90px -18px rgba(0,0,0,0.4);
    overflow: hidden; animation: searchFadeIn 0.18s ease both;
  }
  .email-header {
    padding: 20px 22px; border-bottom: 1px solid hsl(var(--primary) / 0.12);
    font-size: 15px; font-weight: 800;
    color: hsl(var(--foreground));
    display: flex; align-items: center; justify-content: space-between;
    background: linear-gradient(90deg, hsl(var(--primary) / 0.14), transparent 70%);
  }
  .email-field {
    width: calc(100% - 40px);
    margin: 16px 20px 0;
    border: 1px solid hsl(var(--border));
    padding: 13px 14px; font-size: 14px;
    background: hsl(var(--background)); color: hsl(var(--foreground));
    outline: none; box-sizing: border-box; border-radius: 12px;
    transition: border-color .15s, box-shadow .15s, background .15s;
  }
  .email-field::placeholder { color: hsl(var(--muted-foreground)); }
  .email-field:focus {
    border-color: hsl(var(--primary) / 0.55);
    box-shadow: 0 0 0 3px hsl(var(--primary) / 0.10);
    background: hsl(var(--card));
  }
  .email-body {
    width: calc(100% - 40px);
    margin: 16px 20px 0;
    border: 1px solid hsl(var(--border));
    padding: 14px;
    font-size: 14px; background: hsl(var(--background)); color: hsl(var(--foreground));
    outline: none; resize: none; min-height: 180px;
    box-sizing: border-box; font-family: inherit; border-radius: 14px;
    transition: border-color .15s, box-shadow .15s, background .15s;
  }
  .email-body::placeholder { color: hsl(var(--muted-foreground)); }
  .email-body:focus {
    border-color: hsl(var(--primary) / 0.55);
    box-shadow: 0 0 0 3px hsl(var(--primary) / 0.10);
    background: hsl(var(--card));
  }
  .email-footer {
    padding: 18px 20px; border-top: 1px solid hsl(var(--primary) / 0.10);
    display: flex; justify-content: flex-end; gap: 8px;
  }
  .email-btn-send {
    background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.84));
    color: hsl(var(--primary-foreground));
    border: none; border-radius: 10px; padding: 10px 18px;
    font-size: 13px; font-weight: 700; cursor: pointer; transition: opacity 0.15s, transform .15s, box-shadow .15s;
    box-shadow: 0 14px 28px -16px hsl(var(--primary) / 0.75);
  }
  .email-btn-send:hover { opacity: 0.96; transform: translateY(-1px); }
  .email-btn-cancel {
    background: hsl(var(--muted)); color: hsl(var(--muted-foreground));
    border: none; border-radius: 10px; padding: 10px 16px;
    font-size: 13px; cursor: pointer;
  }
  .sidebar-action-btn {
    border-radius: 12px;
    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s ease, box-shadow .15s ease;
  }
  .sidebar-action-btn:hover {
    background: hsl(var(--primary) / 0.08) !important;
    color: hsl(var(--primary)) !important;
    box-shadow: inset 0 0 0 1px hsl(var(--primary) / 0.12);
    transform: translateX(1px);
  }
  .sidebar-action-btn:hover svg {
    color: hsl(var(--primary)) !important;
  }
  .sidebar-action-kbd {
    transition: background .15s ease, color .15s ease;
  }
  .sidebar-action-btn:hover .sidebar-action-kbd {
    background: hsl(var(--primary) / 0.12) !important;
    color: hsl(var(--primary)) !important;
  }
  .sidebar-action-btn[data-state="active"] {
    background: hsl(var(--primary) / 0.1) !important;
    color: hsl(var(--primary)) !important;
    box-shadow: inset 0 0 0 1px hsl(var(--primary) / 0.14);
  }
`

// ── Search Modal ──────────────────────────────────────────────────────────────
function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    inputRef.current?.focus()
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const ALL_PAGES = [
    { title: "Dashboard",  url: "/dashboard",  icon: LayoutDashboard, desc: "Overview & revenue trend" },
    { title: "Analytics",  url: "/analytics",  icon: BarChart3,       desc: "Analisis invoice multi-year" },
    { title: "Clients",    url: "/clients",    icon: Users,           desc: "Daftar klien & riwayat" },
    { title: "Lifecycle",  url: "/lifecycle",  icon: Clock,           desc: "Aging & follow-up" },
    { title: "Projects",   url: "/projects",   icon: FolderKanban,    desc: "Proyek & kontrak" },
  ]

  const results = query.trim()
    ? ALL_PAGES.filter(p =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.desc.toLowerCase().includes(query.toLowerCase()))
    : ALL_PAGES

  return (
    <div className="search-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="search-modal">
        <div className="search-input-wrap">
          <Search size={16} color="hsl(var(--muted-foreground))" />
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Cari halaman, klien, atau fitur..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--muted))', padding: '2px 6px', borderRadius: 4 }}>ESC</span>
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '24px 20px', textAlign: 'center', fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
              Tidak ada hasil untuk "{query}"
            </div>
          ) : results.map(r => (
            <Link key={r.url} href={r.url} className="search-result-item" onClick={onClose}>
              <r.icon size={15} />
              <div>
                <div style={{ fontWeight: 600 }}>{r.title}</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{r.desc}</div>
              </div>
              <ExternalLink size={12} style={{ marginLeft: 'auto' }} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Email Compose Modal ───────────────────────────────────────────────────────
function EmailModal({ onClose }: { onClose: () => void }) {
  const [to,      setTo]      = React.useState("")
  const [subject, setSubject] = React.useState("")
  const [body,    setBody]    = React.useState("")
  const [sent,    setSent]    = React.useState(false)

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const handleSend = () => { setSent(true); setTimeout(onClose, 1200) }

  return (
    <div className="email-modal" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="email-card">
        <div className="email-header">
          <span>✉ Buat Email Baru</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}>✕</button>
        </div>
        {sent ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 600 }}>Email terkirim!</div>
          </div>
        ) : (
          <>
            <div style={{ padding: '14px 20px 0', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
              Kirim pesan cepat ke tim internal langsung dari sidebar.
            </div>
            <input className="email-field" placeholder="Kepada:" value={to} onChange={e => setTo(e.target.value)} />
            <input className="email-field" placeholder="Subjek:" value={subject} onChange={e => setSubject(e.target.value)} />
            <textarea className="email-body" placeholder="Tulis pesan..." value={body} onChange={e => setBody(e.target.value)} />
            <div className="email-footer">
              <button className="email-btn-cancel" onClick={onClose}>Batal</button>
              <button className="email-btn-send" onClick={handleSend}>Kirim</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main AppSidebar ───────────────────────────────────────────────────────────
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { user, clearUser } = useCurrentUser()
  const [showSearch, setShowSearch] = React.useState(false)
  const [showEmail,  setShowEmail]  = React.useState(false)
  const initials = React.useMemo(() => {
    const parts = user.name.split(" ").filter(Boolean).slice(0, 2)
    return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "TU"
  }, [user.name])

  // ⌘K shortcut
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: APP_SIDEBAR_STYLES }} />
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
      {showEmail  && <EmailModal  onClose={() => setShowEmail(false)}  />}

      <Sidebar collapsible="offcanvas" {...props}>

        {/* ── Header: Real logo image + Quick Create ── */}
        <SidebarHeader style={{ padding: '12px 12px 8px' }}>
          {/* Company link */}
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 10, textDecoration: 'none', marginBottom: 10 }}>
            {/* FIX #3: Use real logo image /public/logo pt.jpg */}
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
              border: '1px solid hsl(var(--border))',
              boxShadow: '0 2px 8px -2px rgba(0,0,0,0.15)',
              background: '#f0f0f0',
            }}>
              <img
                src="/logo pt.jpg"
                alt="PT TUP Logo"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  // Fallback: hide img, show SVG initials
                  const el = e.currentTarget as HTMLImageElement
                  el.style.display = 'none'
                  const parent = el.parentElement!
                  parent.style.background = 'hsl(var(--primary))'
                  parent.style.display = 'flex'
                  parent.style.alignItems = 'center'
                  parent.style.justifyContent = 'center'
                  parent.innerHTML = '<span style="color:white;font-weight:800;font-size:13px;">TUP</span>'
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.01em', lineHeight: 1.2, color: 'hsl(var(--sidebar-foreground))' }}>
                PT TRI BANGUN
              </div>
              <div style={{ fontSize: 10, color: 'hsl(var(--sidebar-foreground)/.55)', letterSpacing: '0.02em' }}>
                Usaha Persada
              </div>
            </div>
          </Link>

          <button
            className="quick-create-btn"
            style={{
              backgroundColor: "hsl(var(--primary))",
              backgroundImage:
                "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.92) 56%, hsl(var(--primary) / 0.8) 100%)",
              color: "hsl(var(--primary-foreground))",
              borderColor: "hsl(var(--primary) / 0.34)",
              boxShadow:
                "0 18px 38px -18px hsl(var(--primary) / 0.78), inset 0 1px 0 hsl(0 0% 100% / 0.3), inset 0 -1px 0 hsl(0 0% 0% / 0.1)",
            }}
            onClick={() => setShowEmail(true)}
          >
            <span className="quick-create-icon">
              <Plus size={13} strokeWidth={2.6} />
            </span>
            <span className="quick-create-copy">
              <span className="quick-create-title">Quick Create</span>
              <span className="quick-create-note">Compose internal email cepat</span>
            </span>
          </button>
          <div className="quick-create-sub">Shortcut cepat buat kirim email internal.</div>
        </SidebarHeader>

        {/* ── Main Nav ── */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_MAIN.map(item => {
                  const isActive = pathname === item.url || pathname?.startsWith(item.url + "/")
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                        <Link
                          href={item.url}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            borderRadius: 10,
                            padding: '8px 10px',
                            background: isActive ? 'linear-gradient(90deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.08))' : 'transparent',
                            boxShadow: isActive ? 'inset 0 0 0 1px hsl(var(--primary) / 0.18)' : 'none',
                          }}
                        >
                          <item.icon
                            size={16}
                            style={{
                              flexShrink: 0,
                              color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--sidebar-foreground) / 0.6)',
                              transition: 'color 0.15s',
                            }}
                          />
                          <span style={{
                            fontWeight: isActive ? 800 : 500,
                            color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--sidebar-foreground))',
                            fontSize: 13,
                            transition: 'all 0.15s',
                            letterSpacing: isActive ? '0.01em' : 'normal',
                          }}>
                            {item.title}
                          </span>
                          {isActive && <span className="nav-active-pill">ON</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Documents */}
          <SidebarGroup>
            <SidebarGroupLabel>Documents</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_DOCS.map(item => {
                  const isActive = pathname === item.url || pathname?.startsWith(item.url + "/")
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                        <Link
                          href={item.url}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            borderRadius: 10,
                            padding: '8px 10px',
                            background: isActive ? 'linear-gradient(90deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.08))' : 'transparent',
                            boxShadow: isActive ? 'inset 0 0 0 1px hsl(var(--primary) / 0.18)' : 'none',
                          }}
                        >
                          <item.icon
                            size={16}
                            style={{
                              flexShrink: 0,
                              color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--sidebar-foreground) / 0.6)',
                              transition: 'color 0.15s',
                            }}
                          />
                          <span style={{
                            fontWeight: isActive ? 800 : 500,
                            color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--sidebar-foreground))',
                            fontSize: 13,
                            transition: 'all 0.15s',
                            letterSpacing: isActive ? '0.01em' : 'normal',
                          }}>
                            {item.title}
                          </span>
                          {isActive && <span className="nav-active-dot" />}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Bottom: Search / Email / Help / Settings / More */}
          <SidebarGroup style={{ marginTop: 'auto' }}>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton className="sidebar-action-btn" tooltip="Search (⌘K)" onClick={() => setShowSearch(true)}>
                    <Search size={16} style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13 }}>Search</span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 9, fontWeight: 600,
                      background: 'hsl(var(--muted))', borderRadius: 4, padding: '1px 5px',
                      color: 'hsl(var(--muted-foreground))'
                    }} className="sidebar-action-kbd">⌘K</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton className="sidebar-action-btn" tooltip="Kirim Email" onClick={() => setShowEmail(true)}>
                    <Mail size={16} style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13 }}>Kirim Email</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton className="sidebar-action-btn" tooltip="Get Help" onClick={() => window.open("mailto:support@tup.id?subject=Dashboard Help", "_blank")}>
                    <HelpCircle size={16} style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13 }}>Get Help</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton className="sidebar-action-btn" asChild tooltip="Settings">
                    <Link href="/settings">
                      <Settings size={16} style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13 }}>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton className="sidebar-action-btn" tooltip="More">
                        <MoreHorizontal size={16} style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)', flexShrink: 0 }} />
                        <span style={{ fontSize: 13 }}>More</span>
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="end" style={{ minWidth: 180 }}>
                      <DropdownMenuItem onClick={() => setShowSearch(true)}>
                        <Search size={14} style={{ marginRight: 8 }} /> Cari
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowEmail(true)}>
                        <Mail size={14} style={{ marginRight: 8 }} /> Kirim Email
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <Bell size={14} style={{ marginRight: 8 }} /> Notifikasi
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <UserCircle size={14} style={{ marginRight: 8 }} /> Profil Saya
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* ── Footer: User dropdown ── */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="h-auto py-2.5 px-3">
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: 'hsl(var(--primary))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, color: 'hsl(var(--primary-foreground))',
                    }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--sidebar-foreground))' }}>{user.name}</div>
                      <div style={{ fontSize: 10, color: 'hsl(var(--sidebar-foreground) / 0.55)' }}>{user.email}</div>
                    </div>
                    <ChevronUp size={14} style={{ color: 'hsl(var(--sidebar-foreground) / 0.4)', flexShrink: 0 }} />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" style={{ minWidth: 200 }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid hsl(var(--border))' }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{user.name}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{user.email}</div>
                  </div>
                  <DropdownMenuItem>
                    <UserCircle size={14} style={{ marginRight: 8 }} /> Profil
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings size={14} style={{ marginRight: 8 }} /> Pengaturan
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem style={{ color: 'hsl(var(--destructive))' }} onClick={() => { clearUser(); window.location.href = '/login' }}>
                    <LogOut size={14} style={{ marginRight: 8 }} /> Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

      </Sidebar>
    </>
  )
}
