import { useEffect } from 'react';
import { Clock, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function PendingApproval() {
  const { signOut, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const refresh = () => {
      void refreshProfile();
    };

    refresh();
    const interval = window.setInterval(refresh, 5000);
    return () => window.clearInterval(interval);
  }, [refreshProfile]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 mb-4">
          <Clock className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Awaiting Approval</h1>
        <p className="text-sm text-slate-500 mb-6">
          Hi {profile?.full_name?.split(' ')[0] ?? 'there'}, your account is registered but hasn't been
          approved yet. An administrator will review your request and grant you access shortly.
        </p>
        <button
          onClick={async () => {
            await signOut();
            navigate('/auth');
          }}
          className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
