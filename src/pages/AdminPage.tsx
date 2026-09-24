import { useEffect, useMemo, useState } from 'react';
import {
  Shield,
  Users,
  Calendar,
  Image,
  Check,
  X,
  RefreshCw,
  Search,
  UserCheck,
  Clock,
  AlertTriangle,
  Lock,
  Activity,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type ClubRoleRequest = {
  id: string;
  user_id: string;
  club_role: 'president' | 'photographer';
  status: 'pending' | 'approved' | 'rejected';
  profiles: { full_name: string; email: string }[];
  clubs: { name: string }[];
};

type Role = 'pending' | 'student' | 'faculty' | 'admin';

export default function AdminPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [clubRoleRequests, setClubRoleRequests] = useState<ClubRoleRequest[]>([]);

  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');

  /*
   * Load users and statistics
   */
  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        { data: people, error: peopleError },
        { data: summary, error: statsError },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false }),

        supabase.rpc('get_admin_stats'),
      ]);

      if (peopleError) {
        throw new Error(peopleError.message);
      }

      if (statsError) {
        throw new Error(statsError.message);
      }

      setUsers((people ?? []) as Profile[]);
      setStats((summary ?? {}) as Record<string, number>);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load administration data.'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadClubRoleRequests = async () => {
    const { data, error: requestError } = await supabase
      .from('club_members')
      .select('id, user_id, club_role, status, profiles(full_name, email), clubs(name)')
      .eq('status', 'pending')
      .in('club_role', ['president', 'photographer'])
      .order('created_at', { ascending: true });

    if (requestError) {
      setError(requestError.message);
      return;
    }

    setClubRoleRequests((data ?? []) as ClubRoleRequest[]);
  };

  /*
   * Initial load
   */
  useEffect(() => {
    void load();
    void loadClubRoleRequests();
  }, []);

  const updateClubRoleRequest = async (id: string, status: 'approved' | 'rejected') => {
    setBusyUser(id);
    setError(null);
    setSuccess(null);

    const { error: requestError } = await supabase.rpc('admin_set_club_member_status', {
      target_membership: id,
      new_status: status,
    });

    if (requestError) {
      setError(requestError.message);
    } else {
      setSuccess(`Club role request ${status}.`);
      await loadClubRoleRequests();
    }

    setBusyUser(null);
  };

  /*
   * Change user role
   */
  const setRole = async (id: string, role: Role, userName?: string) => {
    if (role === 'pending') {
      const confirmed = window.confirm(
        `Are you sure you want to revoke access for ${
          userName || 'this user'
        }?`
      );

      if (!confirmed) {
        return;
      }
    }

    setBusyUser(id);
    setError(null);
    setSuccess(null);

    try {
      const { error: roleError } = await supabase.rpc(
        'admin_set_user_role',
        {
          target_user: id,
          new_role: role,
        }
      );

      if (roleError) {
        throw new Error(roleError.message);
      }

      setSuccess(
        role === 'pending'
          ? `${userName || 'User'} access has been revoked.`
          : `${userName || 'User'} is now ${role}.`
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update user role.'
      );
    } finally {
      setBusyUser(null);
    }
  };

  /*
   * Search + role filtering
   */
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((person) => {
      const matchesSearch =
        !query ||
        person.full_name?.toLowerCase().includes(query) ||
        person.email?.toLowerCase().includes(query);

      const matchesRole =
        roleFilter === 'all' || person.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  /*
   * Statistics cards
   */
  const cards = [
    ['students', 'Students', Users],
    ['faculty', 'Faculty', Shield],
    ['events', 'Events', Calendar],
    ['photos', 'Images', Image],
  ] as const;

  /*
   * Loading screen
   */
  if (loading && users.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <RefreshCw className="h-7 w-7 animate-spin text-blue-600" />

          <p className="text-sm font-medium">
            Loading administration center...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7 pb-10">

      {/* ========================================================= */}
      {/* HEADER */}
      {/* ========================================================= */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Shield className="h-5 w-5" />
            </div>

            <p className="text-sm font-semibold text-blue-600">
              Administration
            </p>
          </div>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            University Control Center
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Manage university members, monitor events, control access,
            and maintain the security of the Indus Moments platform.
          </p>
        </div>

        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
          />

          Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/60 p-5">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <h2 className="font-semibold text-slate-900">Club Role Requests</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">Verify student club president and photographer requests.</p>
          </div>
          <span className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700">
            {clubRoleRequests.length} pending
          </span>
        </div>

        {clubRoleRequests.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No pending club role requests.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {clubRoleRequests.map((request) => {
              const isBusy = busyUser === request.id;
              return (
                <div key={request.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{request.profiles?.[0]?.full_name || 'Student'}</p>
                    <p className="text-sm text-slate-500">{request.profiles?.[0]?.email}</p>
                    <p className="mt-1 text-xs font-medium capitalize text-blue-600">
                      {request.club_role} · {request.clubs?.[0]?.name || 'Unknown club'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button disabled={isBusy} onClick={() => void updateClubRoleRequest(request.id, 'approved')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                      <Check className="h-3 w-3" /> Approve
                    </button>
                    <button disabled={isBusy} onClick={() => void updateClubRoleRequest(request.id, 'rejected')} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                      <X className="h-3 w-3" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* SUCCESS MESSAGE */}
      {/* ========================================================= */}

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <Check className="mt-0.5 h-5 w-5 shrink-0" />

          <div>
            <p className="font-semibold">Action completed</p>
            <p className="mt-0.5">{success}</p>
          </div>

          <button
            onClick={() => setSuccess(null)}
            className="ml-auto text-emerald-500 hover:text-emerald-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* ERROR MESSAGE */}
      {/* ========================================================= */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="mt-0.5">{error}</p>
          </div>

          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* STATISTICS */}
      {/* ========================================================= */}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(([key, label, Icon]) => (
          <div
            key={key}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                <Icon className="h-5 w-5" />
              </div>

              <Activity className="h-4 w-4 text-slate-300" />
            </div>

            <p className="text-2xl font-bold text-slate-900">
              {stats[key] ?? 0}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* ========================================================= */}
      {/* SECURITY CENTER */}
      {/* ========================================================= */}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
            <Lock className="h-5 w-5" />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">
              Security Center
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Important security information for your university
              photography platform.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-600" />

              <span className="text-xs font-semibold text-slate-500">
                Approved Users
              </span>
            </div>

            <p className="mt-2 text-lg font-bold text-slate-900">
              {(stats.students ?? 0) + (stats.faculty ?? 0)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />

              <span className="text-xs font-semibold text-slate-500">
                Pending
              </span>
            </div>

            <p className="mt-2 text-lg font-bold text-slate-900">
              {stats.pending ?? 0}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-blue-600" />

              <span className="text-xs font-semibold text-slate-500">
                Stored Images
              </span>
            </div>

            <p className="mt-2 text-lg font-bold text-slate-900">
              {stats.photos ?? 0}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" />

              <span className="text-xs font-semibold text-slate-500">
                Events
              </span>
            </div>

            <p className="mt-2 text-lg font-bold text-slate-900">
              {stats.events ?? 0}
            </p>
          </div>

        </div>
      </div>

      {/* ========================================================= */}
      {/* MEMBER APPROVALS */}
      {/* ========================================================= */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {/* HEADER */}

        <div className="border-b border-slate-100 p-5">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />

                <h2 className="font-semibold text-slate-900">
                  Member Approvals
                </h2>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Approve university members and control their platform access.
              </p>
            </div>

            <span className="w-fit rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
              {stats.pending ?? 0} pending
            </span>

          </div>

          {/* SEARCH */}

          <div className="mt-5 flex flex-col gap-3 md:flex-row">

            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* ROLE FILTER */}

            <select
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(e.target.value as 'all' | Role)
              }
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All roles</option>
              <option value="pending">Pending</option>
              <option value="student">Students</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Admins</option>
            </select>

          </div>

        </div>

        {/* ======================================================= */}
        {/* USER LIST */}
        {/* ======================================================= */}

        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center">

            <Users className="mx-auto h-10 w-10 text-slate-300" />

            <h3 className="mt-4 font-semibold text-slate-800">
              No members found
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Try changing your search or role filter.
            </p>

          </div>
        ) : (
          <div className="divide-y divide-slate-100">

            {filteredUsers.map((person) => {

              const isBusy = busyUser === person.id;
              const isAdmin = person.role === 'admin';

              return (
                <div
                  key={person.id}
                  className="flex flex-col gap-4 p-5 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >

                  {/* USER INFO */}

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 font-semibold text-blue-600">
                      {person.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>

                    <div>
                      <p className="font-semibold text-slate-800">
                        {person.full_name || 'Unknown User'}
                      </p>

                      <p className="text-sm text-slate-500">
                        {person.email}
                      </p>
                    </div>

                  </div>

                  {/* ACTIONS */}

                  <div className="flex flex-wrap items-center gap-2">

                    {/* ROLE BADGE */}

                    <span
                      className={`
                        rounded-lg px-2.5 py-1 text-xs font-semibold capitalize
                        ${
                          person.role === 'pending'
                            ? 'bg-amber-50 text-amber-700'
                            : person.role === 'admin'
                            ? 'bg-purple-50 text-purple-700'
                            : person.role === 'faculty'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }
                      `}
                    >
                      {person.role}
                    </span>

                    {/* PENDING ACTIONS */}

                    {person.role === 'pending' && (
                      <>
                        <button
                          disabled={isBusy}
                          onClick={() =>
                            void setRole(
                              person.id,
                              'student',
                              person.full_name
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isBusy ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}

                          Student
                        </button>

                        <button
                          disabled={isBusy}
                          onClick={() =>
                            void setRole(
                              person.id,
                              'faculty',
                              person.full_name
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isBusy ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Shield className="h-3 w-3" />
                          )}

                          Faculty
                        </button>
                      </>
                    )}

                    {/* REVOKE ACCESS */}

                    {person.role !== 'pending' && !isAdmin && (
                      <button
                        disabled={isBusy}
                        onClick={() =>
                          void setRole(
                            person.id,
                            'pending',
                            person.full_name
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Revoke access"
                      >
                        {isBusy ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </button>
                    )}

                    {/* ADMIN PROTECTION */}

                    {isAdmin && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
                        <Lock className="h-3 w-3" />
                        Protected
                      </span>
                    )}

                  </div>
                </div>
              );
            })}

          </div>
        )}

        {/* ======================================================= */}
        {/* FOOTER */}
        {/* ======================================================= */}

        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">

          <p className="text-xs text-slate-500">
            Showing{' '}
            <span className="font-semibold text-slate-700">
              {filteredUsers.length}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-slate-700">
              {users.length}
            </span>{' '}
            registered members.
          </p>

        </div>

      </div>

      {/* ========================================================= */}
      {/* SECURITY INFORMATION */}
      {/* ========================================================= */}

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">

        <div className="flex items-start gap-3">

          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

          <div>
            <h3 className="font-semibold text-blue-900">
              Indus Moments Security
            </h3>

            <p className="mt-1 text-sm leading-6 text-blue-800">
              Administrative actions should be protected by Supabase
              authentication and Row Level Security. Private event
              photographs should be stored in private storage and
              delivered using temporary signed URLs.
            </p>

            <div className="mt-4 grid gap-2 text-xs font-medium text-blue-800 sm:grid-cols-2 lg:grid-cols-4">
              <span>✓ Authentication</span>
              <span>✓ Role-based access</span>
              <span>✓ Database RLS</span>
              <span>✓ Private photo storage</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}