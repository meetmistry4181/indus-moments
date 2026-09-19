import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Search, MapPin, Filter, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ClubEvent } from '@/lib/types';
import { EVENT_CATEGORIES } from '@/lib/types';

export default function EventsPage() {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  const fetchEvents = useCallback(async () => {
    const { data, error: queryError } = await supabase.from('events').select('*');
    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }
    setError(null);
    setEvents(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filtered = useMemo(() => {
    let result = events;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.venue.toLowerCase().includes(q),
      );
    }
    if (category !== 'All') {
      result = result.filter((e) => e.category === category);
    }
    result = [...result].sort((a, b) => {
      const cmp = new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
      return sortBy === 'newest' ? -cmp : cmp;
    });
    return result;
  }, [events, search, category, sortBy]);

  // Group by year for timeline view
  const grouped = useMemo(() => {
    const groups: Record<string, ClubEvent[]> = {};
    filtered.forEach((e) => {
      const year = new Date(e.event_date).getFullYear().toString();
      if (!groups[year]) groups[year] = [];
      groups[year].push(e);
    });
    return Object.entries(groups).sort((a, b) => (sortBy === 'newest' ? Number(b[0]) - Number(a[0]) : Number(a[0]) - Number(b[0])));
  }, [filtered, sortBy]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Events</h1>
        <span className="text-sm text-slate-500">{filtered.length} events</span>
      </div>

      {/* Search + filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by event name, description, or venue..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="All">All Categories</option>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
          {(search || category !== 'All') && (
            <button
              onClick={() => {
                setSearch('');
                setCategory('All');
              }}
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 px-3 py-1.5"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse h-32" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 rounded-2xl border border-red-200 p-12 text-center">
          <p className="text-red-700 text-sm">Could not load events: {error}</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No events found matching your filters.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([year, yearEvents]) => (
            <div key={year}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl font-bold text-slate-900">{year}</span>
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-sm text-slate-400">{yearEvents.length} events</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {yearEvents.map((event) => (
                  <Link
                    key={event.id}
                    to={`/events/${event.id}`}
                    className="group bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:border-blue-200 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium">
                        {event.category}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors mb-1">
                      {event.title}
                    </h3>
                    <p className="text-sm text-slate-500 line-clamp-2">{event.description || 'No description'}</p>
                    {event.venue && (
                      <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {event.venue}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
