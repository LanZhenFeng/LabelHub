import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { FolderKanban, PanelLeftClose, PanelLeftOpen, Settings, Keyboard } from 'lucide-react'
import { ShortcutsDialog } from '@/components/ShortcutsDialog'

const navItems = [
  { href: '/projects', label: '项目', icon: FolderKanban },
  { href: '/settings', label: '设置', icon: Settings, disabled: true },
]

export default function Layout() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem('labelhub.sidebar.collapsed') === '1'
    } catch {
      return false
    }
  })
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem('labelhub.sidebar.collapsed', collapsed ? '1' : '0')
    } catch {
      // ignore
    }
  }, [collapsed])

  // Global shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) {
        return
      }

      if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const activeHref = useMemo(() => {
    const found = navItems.find((i) => location.pathname.startsWith(i.href))
    return found?.href ?? '/projects'
  }, [location.pathname])

  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      
      {/* Sidebar */}
      <aside
        className={cn(
          'border-r bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60 flex flex-col transition-[width] duration-200 ease-out',
          collapsed ? 'w-[88px]' : 'w-64'
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'h-16 flex items-center justify-between border-b',
            collapsed ? 'px-2 gap-2' : 'px-6 gap-3'
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                'shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/12 to-accent/12 border border-primary/18 shadow-sm grid place-items-center',
                collapsed ? 'h-8 w-8' : 'h-9 w-9'
              )}
            >
              <img
                src="/logo-mark.svg"
                alt="LabelHub"
                className={cn('block select-none', collapsed ? 'h-6 w-6' : 'h-7 w-7')}
                draggable={false}
              />
            </div>
            {!collapsed && <span className="font-semibold text-lg tracking-tight">LabelHub</span>}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-md border bg-background/60 text-foreground shadow-sm transition-colors hover:bg-muted',
              collapsed ? 'h-8 w-8' : 'h-9 w-9'
            )}
            aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
            title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className={cn('flex-1 space-y-1', collapsed ? 'p-2' : 'p-4')}>
          {navItems.map((item) => {
            const isActive = activeHref === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                to={item.disabled ? '#' : item.href}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-colors',
                  collapsed ? 'px-2 py-2.5' : 'px-3 py-2.5',
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  item.disabled && 'opacity-50 cursor-not-allowed'
                )}
                onClick={(e) => item.disabled && e.preventDefault()}
                title={collapsed ? item.label : undefined}
              >
                {/* Active indicator */}
                <span
                  className={cn(
                    'absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-primary transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-0'
                  )}
                  aria-hidden="true"
                />

                {/* Icon container */}
                <span
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-xl border bg-background/60 shadow-sm transition-colors',
                    isActive
                      ? 'border-primary/25 bg-gradient-to-br from-primary/15 to-accent/15'
                      : 'border-border/60 group-hover:bg-muted'
                  )}
                >
                  <Icon className={cn('h-5 w-5', isActive ? 'text-primary' : 'text-foreground/80')} />
                </span>

                <span className={cn('min-w-0 flex-1 truncate', collapsed && 'sr-only')}>
                  {item.label}
                </span>

                {!collapsed && item.disabled && (
                  <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">v1.1</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className={cn('border-t space-y-2', collapsed ? 'p-2' : 'p-4')}>
          {/* Shortcuts Trigger */}
          <button
            onClick={() => setShortcutsOpen(true)}
            className={cn(
              "flex items-center gap-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors w-full",
              collapsed ? "justify-center p-2" : "px-3 py-2"
            )}
            title="快捷键指南 (?)"
          >
             <Keyboard className="h-4 w-4" />
             {!collapsed && <span>快捷键</span>}
             {!collapsed && <kbd className="ml-auto text-[10px] bg-muted border rounded px-1 hidden lg:inline-block">?</kbd>}
          </button>

          {collapsed ? (
            <div className="mx-auto h-2 w-2 rounded-full bg-primary/60" title="LabelHub v1.0.0" />
          ) : (
            <div className="text-xs text-muted-foreground space-y-0.5 px-3">
              <p className="font-medium">LabelHub v1.0.0</p>
              <p>M3 - Statistics &amp; Polish</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
