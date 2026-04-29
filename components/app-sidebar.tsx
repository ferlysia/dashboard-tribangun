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
  Search,
  ChevronUp,
  ExternalLink,
  UserCircle,
  LogOut,
  FileText,
  Plus,
  TrendingUp,
  History,
  Database,
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
  { title: "Dashboard",               url: "/dashboard",             icon: LayoutDashboard },
  { title: "Analytics",               url: "/analytics",             icon: BarChart3       },
  { title: "Clients",                 url: "/clients",               icon: Users           },
  { title: "Lifecycle",               url: "/lifecycle",             icon: Clock           },
  { title: "Projects",                url: "/projects",              icon: FolderKanban    },
  { title: "Financial Performance",    url: "/financial-performance", icon: TrendingUp      },
]

const NAV_DOCS = [
  { title: "Invoice Records",    url: "/excel-data",        icon: Database },
  { title: "Reports",            url: "/reports",           icon: FileText },
  { title: "Activity History",   url: "/activity-history",  icon: History  },
]

const APP_SIDEBAR_STYLES = `
  /* ── Nav link base ── */
  .nav-link-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    border-radius: 10px;
    padding: 8px 12px;
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    color: hsl(var(--sidebar-foreground) / 0.75);
    border-left: 3px solid transparent;
    box-sizing: border-box;
  }
  .nav-link-item:hover {
    background: hsl(var(--primary) / 0.10);
    color: hsl(var(--foreground));
  }
  .nav-link-item .nav-link-icon {
    color: hsl(var(--sidebar-foreground) / 0.55);
    flex-shrink: 0;
    transition: color 0.15s;
  }
  .nav-link-item:hover .nav-link-icon {
    color: hsl(var(--foreground));
  }

  /* ── Active state ── */
  .nav-link-active {
    background: hsl(var(--primary) / 0.14) !important;
    border-left: 3px solid hsl(var(--primary)) !important;
    color: hsl(var(--primary)) !important;
    font-weight: 700 !important;
  }
  .nav-link-active:hover {
    background: hsl(var(--primary) / 0.20) !important;
  }
  .nav-link-active .nav-link-icon {
    color: hsl(var(--primary)) !important;
    filter: drop-shadow(0 0 4px hsl(var(--primary) / 0.45));
  }
  .nav-link-text {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
  .nav-active-badge {
    margin-left: auto;
    flex-shrink: 0;
    min-width: 22px;
    height: 22px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 8px;
    background: hsl(var(--primary) / 0.16);
    color: hsl(var(--primary));
    font-size: 10px;
    font-weight: 800;
    box-shadow: inset 0 0 0 1px hsl(var(--primary) / 0.16);
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
    { title: "Dashboard",              url: "/dashboard",             icon: LayoutDashboard, desc: "Overview & revenue trend" },
    { title: "Analytics",              url: "/analytics",             icon: BarChart3,       desc: "Multi-year invoice analytics" },
    { title: "Clients",                url: "/clients",               icon: Users,           desc: "Client list and payment history" },
    { title: "Lifecycle",   url: "/lifecycle",             icon: Clock,           desc: "Aging, follow-up, and outstanding risk" },
    { title: "Projects",               url: "/projects",              icon: FolderKanban,    desc: "Project portfolio and invoice progress" },
    { title: "Financial Performance",  url: "/financial-performance", icon: TrendingUp,      desc: "ROI, profitability, and financial analysis" },
    { title: "New Invoice",            url: "/input-invoice",         icon: Plus,            desc: "Create a new invoice record" },
    { title: "Invoice Records",        url: "/excel-data",            icon: Database,        desc: "Review, edit, delete, and restore invoices" },
    { title: "Reports",                url: "/reports",               icon: FileText,        desc: "Reports and invoice recaps" },
    { title: "Activity History",       url: "/activity-history",      icon: History,         desc: "Audit trail of user actions" },
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
              Tidak ada hasil untuk &quot;{query}&quot;
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

// ── Main AppSidebar ───────────────────────────────────────────────────────────
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { user, clearUser } = useCurrentUser()
  const [showSearch, setShowSearch] = React.useState(false)
  const isQuickCreateActive = pathname === "/input-invoice" || pathname?.startsWith("/input-invoice/")
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

          <Link
            href="/input-invoice"
            className="quick-create-btn"
            style={{
              boxShadow: isQuickCreateActive
                ? "0 22px 42px -18px hsl(var(--primary) / 0.85), inset 0 0 0 1px hsl(0 0% 100% / 0.24), inset 0 0 0 2px hsl(var(--primary-foreground) / 0.08)"
                : undefined,
              transform: isQuickCreateActive ? "translateY(-1px)" : undefined,
              textDecoration: "none",
            }}
          >
            <span className="quick-create-icon">
              <Plus size={13} strokeWidth={2.6} />
            </span>
            <span className="quick-create-copy">
              <span className="quick-create-title">New Invoice</span>
              <span className="quick-create-note">Create a new invoice record</span>
            </span>
          </Link>
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
                      <Link
                        href={item.url}
                        className={isActive ? "nav-link-item nav-link-active" : "nav-link-item"}
                      >
                        <item.icon size={16} className="nav-link-icon" />
                        <span className="nav-link-text">{item.title}</span>
                        {isActive && <span className="nav-active-pill">ACTIVE</span>}
                      </Link>
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
                      <Link
                        href={item.url}
                        className={isActive ? "nav-link-item nav-link-active" : "nav-link-item"}
                      >
                        <item.icon size={16} className="nav-link-icon" />
                        <span className="nav-link-text">{item.title}</span>
                        {isActive && <span className="nav-active-dot" />}
                      </Link>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Bottom: Search only */}
          <SidebarGroup style={{ marginTop: 'auto' }}>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton className="sidebar-action-btn" tooltip="Search (⌘K)" onClick={() => setShowSearch(true)}>
                    <Search size={16} style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13 }}>Cari Halaman</span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 9, fontWeight: 600,
                      background: 'hsl(var(--muted))', borderRadius: 4, padding: '1px 5px',
                      color: 'hsl(var(--muted-foreground))'
                    }} className="sidebar-action-kbd">⌘K</span>
                  </SidebarMenuButton>
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
                    <UserCircle size={14} style={{ marginRight: 8 }} /> {user.name}
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
