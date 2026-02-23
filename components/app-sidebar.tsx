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

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV_MAIN = [
  { title: "Dashboard",  url: "/dashboard",  icon: LayoutDashboard },
  { title: "Analytics",  url: "/analytics",  icon: BarChart3       },
  { title: "Clients",    url: "/clients",    icon: Users           },
  { title: "Lifecycle",  url: "/lifecycle",  icon: Clock           },
  { title: "Projects",   url: "/projects",   icon: FolderKanban   },
]

const NAV_DOCS = [
  { title: "Excel Data 2025", url: "#", icon: Database },
  { title: "Reports",         url: "#", icon: FileText },
]

const APP_SIDEBAR_STYLES = `
  /* ── Active nav item: bold + colored bg + left accent bar ── */
  [data-sidebar="menu-button"][data-active="true"] {
    background: hsl(var(--primary) / 0.12) !important;
    color: hsl(var(--primary)) !important;
    font-weight: 700 !important;
    position: relative;
  }
  [data-sidebar="menu-button"][data-active="true"]::before {
    content: '';
    position: absolute;
    left: 0; top: 20%; bottom: 20%;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: hsl(var(--primary));
  }
  [data-sidebar="menu-button"][data-active="true"] svg {
    color: hsl(var(--primary)) !important;
    opacity: 1 !important;
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
    width: 6px; height: 6px; border-radius: 50%;
    background: hsl(var(--primary));
    margin-left: auto; flex-shrink: 0;
    animation: activePulse 2s ease-in-out infinite;
  }

  /* ── Quick Create button ── */
  .quick-create-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 9px 12px;
    border-radius: 10px;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    font-size: 13px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 2px 10px -2px hsl(var(--primary) / 0.4);
    letter-spacing: 0.01em;
  }
  .quick-create-btn:hover {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow: 0 6px 18px -4px hsl(var(--primary) / 0.45);
  }
  .quick-create-btn:active { transform: scale(0.97); }

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
    background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }
  .email-card {
    background: hsl(var(--background));
    border: 1px solid hsl(var(--border));
    border-radius: 16px; width: 100%; max-width: 480px;
    box-shadow: 0 24px 60px -12px rgba(0,0,0,0.3);
    overflow: hidden; animation: searchFadeIn 0.18s ease both;
  }
  .email-header {
    padding: 16px 20px; border-bottom: 1px solid hsl(var(--border));
    font-size: 14px; font-weight: 600;
    display: flex; align-items: center; justify-content: space-between;
  }
  .email-field {
    width: 100%; border: none; border-bottom: 1px solid hsl(var(--border));
    padding: 10px 20px; font-size: 13px;
    background: transparent; color: hsl(var(--foreground));
    outline: none; box-sizing: border-box;
  }
  .email-field::placeholder { color: hsl(var(--muted-foreground)); }
  .email-body {
    width: 100%; border: none; padding: 12px 20px;
    font-size: 13px; background: transparent; color: hsl(var(--foreground));
    outline: none; resize: none; min-height: 120px;
    box-sizing: border-box; font-family: inherit;
  }
  .email-footer {
    padding: 12px 20px; border-top: 1px solid hsl(var(--border));
    display: flex; justify-content: flex-end; gap: 8px;
  }
  .email-btn-send {
    background: hsl(var(--primary)); color: hsl(var(--primary-foreground));
    border: none; border-radius: 8px; padding: 8px 16px;
    font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s;
  }
  .email-btn-send:hover { opacity: 0.9; }
  .email-btn-cancel {
    background: hsl(var(--muted)); color: hsl(var(--muted-foreground));
    border: none; border-radius: 8px; padding: 8px 16px;
    font-size: 13px; cursor: pointer;
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
    { title: "Analytics",  url: "/analytics",  icon: BarChart3,       desc: "Analisis invoice 2025" },
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
  const [showSearch, setShowSearch] = React.useState(false)
  const [showEmail,  setShowEmail]  = React.useState(false)

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

          {/* FIX #1: Quick Create button — color follows theme (--primary) */}
          <button
            className="quick-create-btn"
            onClick={() => setShowEmail(true)}
          >
            <Plus size={15} strokeWidth={2.5} />
            Quick Create
          </button>
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
                        <Link href={item.url} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <item.icon
                            size={16}
                            style={{
                              flexShrink: 0,
                              color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--sidebar-foreground) / 0.6)',
                              transition: 'color 0.15s',
                            }}
                          />
                          {/* FIX #2: Bold text + color when active */}
                          <span style={{
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--sidebar-foreground))',
                            fontSize: 13,
                            transition: 'all 0.15s',
                          }}>
                            {item.title}
                          </span>
                          {/* Animated dot when active */}
                          {isActive && <span className="nav-active-dot" />}
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
                {NAV_DOCS.map(item => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link href={item.url}>
                        <item.icon size={16} style={{ color: 'hsl(var(--sidebar-foreground) / 0.55)', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: 'hsl(var(--sidebar-foreground))' }}>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Bottom: Search / Email / Help / Settings / More */}
          <SidebarGroup style={{ marginTop: 'auto' }}>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Search (⌘K)" onClick={() => setShowSearch(true)}>
                    <Search size={16} style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13 }}>Search</span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 9, fontWeight: 600,
                      background: 'hsl(var(--muted))', borderRadius: 4, padding: '1px 5px',
                      color: 'hsl(var(--muted-foreground))'
                    }}>⌘K</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Kirim Email" onClick={() => setShowEmail(true)}>
                    <Mail size={16} style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13 }}>Kirim Email</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Get Help" onClick={() => window.open("mailto:support@tup.id?subject=Dashboard Help", "_blank")}>
                    <HelpCircle size={16} style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13 }}>Get Help</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Settings">
                    <Link href="/settings">
                      <Settings size={16} style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13 }}>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton tooltip="More">
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
                      KC
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--sidebar-foreground))' }}>Kane Chen</div>
                      <div style={{ fontSize: 10, color: 'hsl(var(--sidebar-foreground) / 0.55)' }}>kane@tup.id</div>
                    </div>
                    <ChevronUp size={14} style={{ color: 'hsl(var(--sidebar-foreground) / 0.4)', flexShrink: 0 }} />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" style={{ minWidth: 200 }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid hsl(var(--border))' }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Kane Chen</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>kane@tup.id</div>
                  </div>
                  <DropdownMenuItem>
                    <UserCircle size={14} style={{ marginRight: 8 }} /> Profil
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings size={14} style={{ marginRight: 8 }} /> Pengaturan
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem style={{ color: 'hsl(var(--destructive))' }} onClick={() => window.location.href = '/login'}>
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