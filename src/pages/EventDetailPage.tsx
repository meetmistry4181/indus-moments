import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, User, ArrowLeft, Download, Heart, QrCode, Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import type { ClubEvent, Photo } from '@/lib/types';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [event, setEvent] = useState<ClubEvent | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);

  const fetchEvent = useCallback(async () => {
    if (!id) return;
    const { data: eventData } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
    setEvent(eventData as ClubEvent | null);

    const { data: photoData } = await supabase.from('photos').select('*').eq('event_id', id);
    setPhotos(photoData ?? []);

    // Get signed URLs for each photo
    if (photoData && photoData.length > 0) {
      const urls: Record<string, string> = {};
      for (const p of photoData) {
        const { data: urlData } = await supabase.storage
          .from('event-photos')
          .createSignedUrl(p.storage_path, 300);
        if (urlData?.signedUrl) urls[p.id] = urlData.signedUrl;
      }
      setPhotoUrls(urls);
    }

    // Fetch favorites
    if (profile) {
      const { data: favs } = await supabase
        .from('favorites')
        .select('photo_id')
        .eq('user_id', profile.id);
      if (favs) setFavorites(new Set(favs.map((f) => f.photo_id)));
    }

    setLoading(false);
  }, [id, profile]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const toggleFavorite = async (photoId: string) => {
    if (!profile) return;
    if (favorites.has(photoId)) {
      await supabase.from('favorites').delete().eq('user_id', profile.id).eq('photo_id', photoId);
      setFavorites((prev) => {
        const next = new Set(prev);
        next.delete(photoId);
        return next;
      });
    } else {
      await supabase.from('favorites').insert({ user_id: profile.id, photo_id: photoId });
      setFavorites((prev) => new Set(prev).add(photoId));
    }
  };

  const downloadPhoto = async (photoId: string, path: string) => {
    const { data } = await supabase.storage.from('event-photos').createSignedUrl(path, 3600, {
      download: true,
    });
    if (data?.signedUrl) {
      if (profile) {
        await supabase.from('downloads_log').insert({ user_id: profile.id, photo_id: photoId });
      }
      window.open(data.signedUrl, '_blank');
    }
  };

  const qrUrl = `${window.location.origin}/events/${id}`;

  return (
    <div className="space-y-6">
      <Link to="/events" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Events
      </Link>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 animate-pulse h-48" />
      ) : !event ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Event not found.</p>
        </div>
      ) : (
        <>
          {/* Event header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium mb-3">
                  {event.category}
                </span>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">{event.title}</h1>
                <p className="text-sm text-slate-500 mb-4">{event.description}</p>
                <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {new Date(event.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                  {event.venue && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" /> {event.venue}
                    </span>
                  )}
                  {event.photographer && (
                    <span className="flex items-center gap-1.5">
                      <Camera className="w-4 h-4" /> {event.photographer}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowQR(!showQR)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <QrCode className="w-4 h-4" /> QR Code
              </button>
            </div>

            {showQR && (
              <div className="mt-4 p-4 bg-slate-50 rounded-xl flex flex-col items-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
                  alt="Event QR Code"
                  className="w-40 h-40 rounded-lg"
                />
                <p className="text-xs text-slate-500 mt-2 text-center">
                  Scan to open this event gallery
                </p>
              </div>
            )}
          </div>

          {/* Photos */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Photos ({photos.length})</h2>
            </div>

            {photos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <Camera className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No photos uploaded for this event yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200"
                  >
                    {photoUrls[photo.id] ? (
                      <img
                        src={photoUrls[photo.id]}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera className="w-6 h-6 text-slate-300" />
                      </div>
                    )}
                    {/* Overlay actions */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2">
                      <button
                        onClick={() => toggleFavorite(photo.id)}
                        className="w-8 h-8 rounded-lg bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
                      >
                        <Heart
                          className={`w-4 h-4 ${
                            favorites.has(photo.id) ? 'fill-red-500 text-red-500' : 'text-slate-600'
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => downloadPhoto(photo.id, photo.storage_path)}
                        className="w-8 h-8 rounded-lg bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
                      >
                        <Download className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
