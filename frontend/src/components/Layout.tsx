import { Link, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { FolderKanban, Settings, Tags } from 'lucide-react'

const navItems = [
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/settings', label: 'Settings', icon: Settings, disabled: true },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Tags className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight">LabelHub</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                to={item.disabled ? '#' : item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  item.disabled && 'opacity-50 cursor-not-allowed'
                )}
                onClick={(e) => item.disabled && e.preventDefault()}
              >
                <Icon className="w-5 h-5" />
                {item.label}
                {item.disabled && (
                  <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">v1.1</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t">
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p className="font-medium">LabelHub v1.0.0</p>
            <p>M3 - Statistics & Polish</p>
            <p className="text-[10px] opacity-70">Apache License 2.0</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

