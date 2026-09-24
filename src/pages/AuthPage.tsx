import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, GraduationCap, Shield, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Club, UserRole } from '@/lib/types';

export default function AuthPage() {
  const { signIn, signUp, sendPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Exclude<UserRole, 'pending' | 'admin'>>('student');
  const [clubRole, setClubRole] = useState<'none' | 'president' | 'photographer'>('none');
  const [clubId, setClubId] = useState('');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubLoadError, setClubLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (mode !== 'signup' || role !== 'student') return;
    setClubLoadError(null);
    void supabase.rpc('list_signup_clubs').then(({ data, error: clubsError }) => {
      if (clubsError) {
        setClubLoadError('Club list is not available. Please run the latest Supabase migration.');
        return;
      }
      setClubs(((data ?? []) as Club[]).sort((first, second) => first.name.localeCompare(second.name)));
    });
  }, [mode, role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      if (role === 'student' && clubRole !== 'none' && !clubId) {
        setError('Please select your club for the requested club role.');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName, role, clubRole === 'none' ? undefined : clubRole, clubId || undefined);
      if (error) {
        setError(error);
        setLoading(false);
        return;
      }
      navigate('/');
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error);
        setLoading(false);
        return;
      }
      navigate('/');
    }
    setLoading(false);
  };

  const handleForgot = async () => {
    setError(null);
    setInfo(null);
    if (!email) {
      setError('Please enter your university email to reset your password');
      return;
    }
    try {
      setResetLoading(true);
      const { error } = await sendPasswordReset(email);
      if (error) {
        setError(error);
      } else {
        setInfo('Password reset email sent. Check your inbox.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden overflow-y-auto bg-[#eef7ff] p-0 sm:p-5 lg:h-screen lg:min-h-0 lg:overflow-hidden lg:p-0">
      <div className="flex min-h-screen w-full max-w-[1440px] flex-col overflow-hidden bg-white shadow-2xl sm:min-h-0 sm:rounded-[28px] lg:h-screen lg:min-h-0 lg:rounded-none lg:flex-row">
        <section className="relative flex min-h-[560px] w-full flex-col justify-between overflow-hidden bg-[#cfeaff] px-5 py-8 sm:px-10 sm:py-10 lg:h-full lg:min-h-0 lg:w-1/2 lg:px-12 lg:py-6 xl:px-16">
          <div className="relative z-10 flex items-start justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#62513d] text-white shadow-lg">
                <GraduationCap className="h-8 w-8" />
              </div>
              <div>
                <p className="text-xl font-extrabold leading-none tracking-tight text-[#62513d]">INDUS</p>
                <p className="text-xl font-extrabold leading-none tracking-tight text-[#62513d]">UNIVERSITY</p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.17em] text-[#62513d]/75">Where Practice Meets Theory</p>
              </div>
            </div>
            <div className="rounded-xl bg-[#11a8dc] px-3 py-2 text-center text-white shadow-md">
              <p className="text-lg font-black leading-none">WIIA</p>
              <p className="mt-1 text-[8px] font-semibold uppercase tracking-widest">Inspire</p>
            </div>
          </div>

          <div className="relative z-10 my-2">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#62513d]/70">Welcome to</p>
            <h1 className="max-w-xl text-3xl font-extrabold tracking-tight text-[#172434] xl:text-4xl">Indus University</h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#38516a]">A place where ideas take shape, communities come together, and every moment becomes part of your university story.</p>
            <div className="mt-3 overflow-hidden rounded-2xl bg-white/40 p-2 shadow-xl ring-4 ring-white/40">
              <img
                src="/indus-banner.jpg"
                alt="Indus University campus"
                className="h-auto max-h-[230px] min-h-[150px] w-full object-contain"
              />
            </div>
          </div>

          <div className="relative z-10 flex items-end justify-between gap-5 text-[#38516a]">
            <div>
              <p className="text-sm font-bold text-[#172434]">Indus Moments</p>
              <p className="mt-1 text-xs">Capture. Discover. Relive.</p>
            </div>
            <p className="text-right text-xs font-medium">Ahmedabad, Gujarat<br />www.indusuni.ac.in</p>
          </div>
          <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-white/25" />
          <div className="absolute -right-28 top-1/3 h-72 w-72 rounded-full border-[36px] border-white/20" />
        </section>

        <main className={`auth-form-panel flex w-full items-start justify-center bg-white px-5 py-10 sm:px-10 lg:h-full lg:min-h-0 lg:w-1/2 lg:px-12 lg:py-6 xl:px-24 ${mode === 'signup' && role === 'student' && clubRole !== 'none' ? 'overflow-y-auto' : 'overflow-visible'} lg:items-center`}>
          <div className="auth-form-content w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#62513d] text-white shadow-lg">
                <GraduationCap className="h-8 w-8" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#62513d]">Indus University</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Indus Moments</h1>
              <p className="mt-1 text-sm text-slate-500">University Event Photo Hub</p>
            </div>

            <div className="auth-form-heading mb-8">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">Indus University</p>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Sign in to Indus Moments</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Access your university memories and event photos.</p>
            </div>

            <div className="auth-form-card rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all"
                  />
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Account Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['student', 'faculty'] as const).map((accountRole) => (
                    <button
                      key={accountRole}
                      type="button"
                      onClick={() => {
                        setRole(accountRole);
                        if (accountRole === 'faculty') {
                          setClubRole('none');
                          setClubId('');
                        }
                      }}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition-all ${role === accountRole ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      {accountRole}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === 'signup' && role === 'student' && (
              <div className="auth-club-role space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                <label className="block text-xs font-medium text-slate-600">Club Role (Optional)</label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    ['none', 'No club role'],
                    ['president', 'Club President'],
                    ['photographer', 'Club Photographer'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setClubRole(value as typeof clubRole);
                        if (value === 'none') setClubId('');
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${clubRole === value ? 'border-blue-500 bg-white text-blue-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {clubRole !== 'none' && (
                  <>
                    <label className="block text-xs font-medium text-slate-600">Select Club</label>
                    <select required value={clubId} onChange={(e) => setClubId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400">
                      <option value="">Select club</option>
                      {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
                    </select>
                    {clubLoadError && <p className="text-xs text-red-600">{clubLoadError}</p>}
                    <p className="text-xs text-blue-700">Your club role will require admin approval.</p>
                  </>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">University Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@indusuni.edu.in"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all"
                />
              </div>
            </div>

            {mode === 'signin' && (
              <div className="flex justify-end -mt-2">
                <button
                  type="button"
                  onClick={handleForgot}
                  disabled={resetLoading}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {resetLoading ? 'Sending...' : 'Forgot password?'}
                </button>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-600">
                {error}
              </div>
            )}

            {info && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-600">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50"
            >
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {mode === 'signup' && (
            <p className="text-xs text-slate-400 text-center mt-4">
              Confirm your university email to access the platform.
            </p>
          )}
            </div>

            <div className="mt-6 flex items-center justify-center gap-5 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-blue-500" /> AI Face Match</span>
              <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-emerald-500" /> Private &amp; Secure</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
