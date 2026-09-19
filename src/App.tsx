import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Component, ErrorInfo, ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';

import Layout from '@/components/Layout';
import AuthPage from '@/pages/AuthPage';
import HomePage from '@/pages/HomePage';
import EventsPage from '@/pages/EventsPage';
import EventDetailPage from '@/pages/EventDetailPage';
import UploadPage from '@/pages/UploadPage';
import FindPhotosPage from '@/pages/FindPhotosPage';
import GalleryPage from '@/pages/GalleryPage';
import ProfilePage from '@/pages/ProfilePage';
import AdminPage from '@/pages/AdminPage';

class ProtectedRenderBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Authenticated page render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="max-w-xl rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold text-slate-900">Unable to load your account</h1>
            <p className="mt-2 break-words text-sm text-red-600">{this.state.error.message}</p>
            <button onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function Protected({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    session,
    profile,
    loading,
  } = useAuth();

  // Authentication/profile is still loading
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Loading Indus Moments...
        </p>
      </div>
    );
  }

  // User is not logged in
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // User is logged in but profile hasn't loaded
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-sm text-slate-600">
            Preparing your account...
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Please wait...
          </p>
        </div>
      </div>
    );
  }

  return <ProtectedRenderBoundary><Layout>{children}</Layout></ProtectedRenderBoundary>;
}

function AdminOnly({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/auth" element={<AuthPage />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <Protected>
            <HomePage />
          </Protected>
        }
      />

      <Route
        path="/events"
        element={
          <Protected>
            <EventsPage />
          </Protected>
        }
      />

      <Route
        path="/events/:id"
        element={
          <Protected>
            <EventDetailPage />
          </Protected>
        }
      />

      <Route
        path="/upload"
        element={
          <Protected>
            <UploadPage />
          </Protected>
        }
      />

      <Route
        path="/find-my-photos"
        element={
          <Protected>
            <FindPhotosPage />
          </Protected>
        }
      />

      <Route
        path="/gallery"
        element={
          <Protected>
            <GalleryPage />
          </Protected>
        }
      />

      <Route
        path="/profile"
        element={
          <Protected>
            <ProfilePage />
          </Protected>
        }
      />

      <Route
        path="/admin"
        element={
          <Protected>
            <AdminOnly>
              <AdminPage />
            </AdminOnly>
          </Protected>
        }
      />

      {/* Unknown route */}
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}