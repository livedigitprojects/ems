import { Navigate, Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import NotificationBell from '../components/NotificationBell'
import { useAuth } from '../context/authContext'
import Loading from '../components/Loading'

// Pages that fit the screen on desktop: the page itself doesn't scroll, the
// data table inside it does (see the "lg:h-full lg:flex" wrappers in those pages).
const FIT_SCREEN_ROUTES = ['/leave', '/payslips']

const Layout = () => {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const fitScreen = FIT_SCREEN_ROUTES.includes(pathname)

  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className='flex h-screen bg-linear-to-br from-slate-50 via-white to-indigo-50/30'>
      <Sidebar />
      <div className='flex flex-col flex-1 overflow-hidden'>
        {/* Top bar with notification bell — desktop only */}
        <header className='hidden lg:flex items-center justify-end px-6 py-3 bg-[#0a0d1a] border-b border-slate-800/60 shrink-0'>
          <NotificationBell />
        </header>
        <main className='flex-1 overflow-y-auto bg-[#0a0d1a]'>
          <div className={`p-4 pt-16 sm:p-6 sm:pt-6 lg:p-8 max-w-400 mx:-auto ${fitScreen ? 'lg:h-full lg:flex lg:flex-col' : ''}`}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout