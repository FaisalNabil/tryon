'use client'

import './globals.css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard',          label: 'Overview',  icon: '📊' },
  { href: '/dashboard/frames',   label: 'Frames',    icon: '👓' },
  { href: '/dashboard/embed',    label: 'Embed',     icon: '🔗' },
  { href: '/dashboard/settings', label: 'Settings',  icon: '⚙️' },
  { href: '/dashboard/billing',  label: 'Billing',   icon: '💳' },
]

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  )
}

function Sidebar() {
  const pathname = usePathname()

  // Don't show sidebar on auth pages
  if (pathname?.startsWith('/login') || pathname?.startsWith('/register')) {
    return null
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 p-6">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-primary-600">TryOn</h1>
        <p className="text-sm text-gray-500">Dashboard</p>
      </div>

      <nav className="space-y-1">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive = pathname === href ||
            (href !== '/dashboard' && pathname?.startsWith(href))

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-6 border-t border-gray-200 absolute bottom-6 left-6 right-6">
        <button
          onClick={() => {
            localStorage.removeItem('token')
            window.location.href = '/login'
          }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
