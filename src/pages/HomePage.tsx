import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Camera, Image, TrendingUp, ArrowRight, Sparkles, Users, HardDrive, Download } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import type { ClubEvent } from '@/lib/types';

export default function HomePage() {
  const { profile, isAdmin } = useAuth();
  const [recentEvents, setRecentEvents] = useState<ClubEvent[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [{ data: events }, { count: photos }, { count: eventsCount }] = await Promise.all([
      supabase.from('events').select('*').order('event_date', { ascending: false }).limit(6),
      supabase.from('photos').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
    ]);
    setRecentEvents(events ?? []);
    setPhotoCount(photos ?? 0);
    setEventCount(eventsCount ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats: { label: string; value: number | string; icon: any; color: string }[] = [
    { label: 'Events', value: eventCount, icon: Calendar, color: 'text-blue-600 bg-blue-50' },
    { label: 'Photos', value: photoCount, icon: Image, color: 'text-cyan-600 bg-cyan-50' },
  ];

  if (isAdmin) {
    stats.push(
      { label: 'AI Matches', value: '—', icon: Sparkles, color: 'text-emerald-600 bg-emerald-50' },
      { label: 'Storage', value: '—', icon: HardDrive, color: 'text-amber-600 bg-amber-50' },
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 p-8 sm:p-12">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-300/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
        <div className="relative">
          <p className="text-sm text-blue-100 mb-2">Welcome back</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Hi, {firstName}</h1>
          <p className="text-blue-100 max-w-lg mb-6">
            Find every photo from every event you attended. Upload a selfie and our AI will match you
            across the entire gallery in seconds.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/find-my-photos"
              className="inline-flex items-center gap-2 bg-white text-blue-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-50 transition-colors shadow-md"
            >
              <Sparkles className="w-4 h-4" />
              Find My Photos
            </Link>
            <Link
              to="/events"
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur text-white border border-white/20 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/20 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Browse Events
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${stat.color} mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recent events */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Recent Events</h2>
          <Link to="/events" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse h-40" />
            ))}
          </div>
        ) : recentEvents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No events yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentEvents.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="group bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:border-blue-200 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium">
                    {event.category}
                  </span>
                  <span className="text-xs text-slate-400">{new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors mb-1">
                  {event.title}
                </h3>
                <p className="text-sm text-slate-500 line-clamp-2">{event.description || 'No description'}</p>
                {event.venue && (
                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    {event.venue}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
