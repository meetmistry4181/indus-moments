import { useState, useEffect, useCallback, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Camera,
  Home,
  Calendar,
  Upload,
  Search,
  Heart,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  User,
  Mail,
  Phone,
  MapPin,
  HelpCircle,
  AlertCircle,
  FileText,
  Facebook,
  Instagram,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import type { AppNotification } from '@/lib/types';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/events', label: 'Events', icon: Calendar },
  { path: '/find-my-photos', label: 'Find My Photos', icon: Search },
  { path: '/gallery', label: 'My Gallery', icon: Heart },
  { path: '/upload', label: 'Upload', icon: Upload },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut, isAdmin, isApproved } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  }, [profile]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const markAllRead = async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', profile.id).eq('read', false);
    fetchNotifications();
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const roleLabel = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : '';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-200">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <span className="text-lg font-bold text-slate-900 tracking-tight">Indus Moments</span>
                <span className="block text-[10px] text-slate-400 -mt-1 leading-none">Event Photo Hub</span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive(item.path)
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  to="/admin"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive('/admin') ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </Link>
              )}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotifs(!showNotifs);
                    if (!showNotifs && unreadCount > 0) markAllRead();
                  }}
                  className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {showNotifs && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 max-h-96 overflow-y-auto">
                      <div className="p-3 border-b border-slate-100 font-semibold text-sm text-slate-700">
                        Notifications
                      </div>
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-400">No notifications yet</div>
                      ) : (
                        notifications.map((n) => (
                          <Link
                            key={n.id}
                            to={n.event_id ? `/events/${n.event_id}` : '/gallery'}
                            onClick={() => setShowNotifs(false)}
                            className="block p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors"
                          >
                            <p className="text-sm text-slate-700">{n.message}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {new Date(n.created_at).toLocaleDateString()}
                            </p>
                          </Link>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Profile dropdown */}
              <Link
                to="/profile"
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-sm font-semibold">
                    {profile?.full_name?.charAt(0).toUpperCase() ?? 'U'}
                  </div>
                )}
                <div className="hidden lg:block text-left">
                  <div className="text-sm font-medium text-slate-700 leading-tight">
                    {profile?.full_name?.split(' ')[0] ?? 'User'}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">{roleLabel}</div>
                </div>
              </Link>

              {/* Sign out */}
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-slate-200 bg-white">
            <div className="px-4 py-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      isActive(item.path) ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </Link>
              )}
              <Link
                to="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                <User className="w-4 h-4" />
                Profile
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-md shadow-blue-200">
                  <Camera className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-bold tracking-tight text-slate-900">Indus Moments</p>
                  <p className="text-xs text-slate-400">Event Photo Hub</p>
                </div>
              </div>
              <p className="mt-6 max-w-xs text-sm leading-6 text-slate-500">
                Capture, discover, and relive your best moments from events at Indus University.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <a href="#" aria-label="Facebook" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-blue-600 hover:bg-blue-50">
                  <Facebook className="h-4 w-4" />
                </a>
                <a href="#" aria-label="Instagram" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-pink-500 hover:bg-pink-50">
                  <Instagram className="h-4 w-4" />
                </a>
                <a href="mailto:indusmoments4181@gmail.com" aria-label="Email" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100">
                  <Mail className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">Quick Links</h2>
              <nav className="mt-5 space-y-4 text-sm text-slate-500">
                {navItems.slice(0, 4).map((item) => (
                  <Link key={item.path} to={item.path} className="flex items-center gap-3 hover:text-blue-600">
                    <span className="text-lg leading-none text-slate-400">›</span>
                    {item.label}
                  </Link>
                ))}
                <Link to="/upload" className="flex items-center gap-3 hover:text-blue-600">
                  <span className="text-lg leading-none text-slate-400">›</span>
                  Upload Photos
                </Link>
              </nav>
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">Support</h2>
              <div className="mt-5 space-y-4 text-sm text-slate-500">
                <a href="mailto:indusmoments4181@gmail.com" className="flex items-center gap-3 hover:text-blue-600"><HelpCircle className="h-4 w-4 text-slate-500" />Help Center</a>
                <a href="mailto:indusmoments4181@gmail.com" className="flex items-center gap-3 hover:text-blue-600"><AlertCircle className="h-4 w-4 text-slate-500" />Report an Issue</a>
                <a href="#" className="flex items-center gap-3 hover:text-blue-600"><Shield className="h-4 w-4 text-slate-500" />Privacy Policy</a>
                <a href="#" className="flex items-center gap-3 hover:text-blue-600"><FileText className="h-4 w-4 text-slate-500" />Terms of Use</a>
              </div>
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">Contact Us</h2>
              <div className="mt-5 space-y-5 text-sm">
                <a href="mailto:indusmoments4181@gmail.com" className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Mail className="h-4 w-4" /></span>
                  <span><strong className="block font-semibold text-slate-700">Email</strong><span className="text-slate-500">indusmoments4181@gmail.com</span></span>
                </a>
                <a href="tel:8488808062" className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Phone className="h-4 w-4" /></span>
                  <span><strong className="block font-semibold text-slate-700">Phone</strong><span className="text-slate-500">8488808062</span></span>
                </a>
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><MapPin className="h-4 w-4" /></span>
                  <span><strong className="block font-semibold text-slate-700">Location</strong><span className="text-slate-500">Indus University<br />Ahmedabad, Gujarat</span></span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Indus Moments — Event Photo Hub</p>
            <p>Built for Indus University students &amp; faculty <span className="ml-2 text-base text-blue-600">♥</span></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
