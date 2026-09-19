import { useEffect, useState } from 'react';
import { Heart, Download, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

type Favorite = { id: string; photo_id: string };
type PhotoRow = { storage_path: string } | null;
type Item = { id: string; photoId: string; url?: string };

export default function GalleryPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    (async () => {
      if (!profile) return;

      const { data } = await supabase
        .from('favorites')
        .select('id, photo_id')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      const favs: Favorite[] = (data as unknown as Favorite[]) ?? [];

      const result = await Promise.all(
        favs.map(async (fav: Favorite): Promise<Item> => {
          const { data: photo } = await supabase
            .from('photos')
            .select('storage_path')
            .eq('id', fav.photo_id)
            .maybeSingle();

          if (!photo) return { id: fav.id, photoId: fav.photo_id };

          const { data: signed } = await supabase.storage
            .from('event-photos')
            .createSignedUrl(photo.storage_path, 300);

          return { id: fav.id, photoId: fav.photo_id, url: signed?.signedUrl };
        })
      );

      setItems(result);
    })();
  }, [profile]);

  const remove = async (id: string) => {
    await supabase.from('favorites').delete().eq('id', id);
    setItems((prev: Item[]) => prev.filter((item: Item) => item.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-blue-600">Your collection</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">My Gallery</h1>
        <p className="mt-2 text-sm text-slate-500">A private collection of photos you saved.</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-14 text-center">
          <Heart className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          <h2 className="font-semibold text-slate-700">Nothing saved yet</h2>
          <p className="mt-1 text-sm text-slate-500">Tap the heart on any event photo to save it here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {item.url ? (
                <img src={item.url} alt="Saved event" className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center">
                  <ImageIcon className="h-7 w-7 text-slate-300" />
                </div>
              )}

              <div className="absolute inset-0 flex items-end justify-between p-3 opacity-0 transition group-hover:opacity-100">
                <button onClick={() => remove(item.id)} className="rounded-full bg-white/80 p-2">
                  <Heart className="h-4 w-4 text-red-500" />
                </button>
                <div className="flex gap-2">
                  <a href={item.url} download target="_blank" rel="noreferrer" className="rounded-full bg-white/80 p-2">
                    <Download className="h-4 w-4 text-slate-700" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
