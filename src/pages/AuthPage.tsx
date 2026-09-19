import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Mail, Lock, User, ArrowRight, GraduationCap, Shield, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import type { UserRole } from '@/lib/types';

export default function AuthPage() {
  const { signIn, signUp, sendPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Exclude<UserRole, 'pending' | 'admin'>>('student');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

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
      const { error } = await signUp(email, password, fullName, role);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/30 mb-4">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Indus Moments</h1>
          <p className="text-sm text-slate-400 mt-1">University Event Photo Hub</p>
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8">
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

          <form onSubmit={handleSubmit} className="space-y-4">
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
                      onClick={() => setRole(accountRole)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition-all ${role === accountRole ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      {accountRole}
                    </button>
                  ))}
                </div>
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

        {/* Feature badges */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 mb-2">
              <Sparkles className="w-5 h-5 text-cyan-300" />
            </div>
            <p className="text-[11px] text-slate-400">AI Face Match</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 mb-2">
              <GraduationCap className="w-5 h-5 text-blue-300" />
            </div>
            <p className="text-[11px] text-slate-400">Student Only</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 mb-2">
              <Shield className="w-5 h-5 text-emerald-300" />
            </div>
            <p className="text-[11px] text-slate-400">Private & Secure</p>
          </div>
        </div>
      </div>
    </div>
  );
}
