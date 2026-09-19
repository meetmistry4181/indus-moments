import { useCallback, useEffect, useRef, useState } from 'react';
import { UploadCloud, ImagePlus, X, CheckCircle2, Loader2, CalendarPlus, Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { EVENT_CATEGORIES, type ClubEvent } from '@/lib/types';
import { detectFaces, descriptorToArray } from '@/lib/faceApi';

export default function UploadPage() {
  const { user, role } = useAuth();
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [eventId, setEventId] = useState('');
  const [createEvent, setCreateEvent] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', venue: '', event_date: new Date().toISOString().slice(0, 10), category: 'General', photographer: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const canUpload = role === 'admin' || role === 'faculty';

  const loadEvents = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').order('event_date', { ascending: false });
    setEvents(data ?? []);
  }, []);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  const onFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setFiles(Array.from(incoming).filter((file) => ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'].includes(file.type) || /\.(jpe?g|png|heic|webp)$/i.test(file.name)).slice(0, 1000));
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });

      cameraStreamRef.current = stream;
      setCameraOpen(true);

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play();
      }
    } catch (error) {
      console.error('Camera access failed:', error);
      setDebugInfo('Camera access was not available. Please use the Add photo button instead.');
      cameraInputRef.current?.click();
    }
  };

  const captureFromCamera = () => {
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const nextFiles = [...files, file];
      setFiles(nextFiles.slice(0, 1000));
      stopCamera();
    }, 'image/jpeg', 0.92);
  };

  const submit = async () => {
    if (!user || !canUpload || files.length === 0) return;
    setBusy(true); setMessage(''); setDebugInfo('');
    let targetEvent = eventId;
    if (createEvent) {
      const { data, error } = await supabase.from('events').insert({ ...form, created_by: user.id }).select().maybeSingle();
      if (error || !data) { setMessage(`Could not create the event: ${error?.message ?? 'No event was returned.'}`); setBusy(false); return; }
      targetEvent = data.id; setEvents((prev) => [data as ClubEvent, ...prev]);
    }
    if (!targetEvent) { setMessage('Choose an event first.'); setBusy(false); return; }
    const event = events.find((item) => item.id === targetEvent);
    if (!event && !createEvent) { setMessage('That event could not be found.'); setBusy(false); return; }
    let uploaded = 0;
    for (const file of files) {
      const path = `${event?.club_id ?? 'unassigned'}/${targetEvent}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
      const upload = await supabase.storage.from('event-photos').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
      if (upload.error) continue;
      const { data: photo, error } = await supabase.from('photos').insert({ event_id: targetEvent, storage_path: path, uploaded_by: user.id }).select('id').single();
      if (error || !photo) continue;

      const image = new Image();
      image.src = URL.createObjectURL(file);
      await new Promise<void>((resolve) => {
        image.onload = () => resolve();
        image.onerror = () => resolve();
      });
      if (image.complete && image.naturalWidth > 0) {
        const faces = await detectFaces(image);
        console.info('Face detection result for upload', {
          photoId: photo.id,
          storagePath: path,
          faceCount: faces.length,
          width: image.naturalWidth,
          height: image.naturalHeight,
        });

        if (faces.length > 0) {
          const rows = faces.map((face) => ({
            photo_id: photo.id,
            embedding: `[${descriptorToArray(face.descriptor).join(',')}]`,
          }));

          console.info('Inserting face encodings', {
            photoId: photo.id,
            rowCount: rows.length,
          });

          const { error: faceError } = await supabase.from('face_encodings').insert(rows);

          if (faceError) {
            console.error('Face encoding insert failed', {
              photoId: photo.id,
              error: faceError,
            });
            setDebugInfo(`Debug: upload photo ${path} was detected, but face encoding insert failed: ${faceError.message}`);
          } else {
            setDebugInfo(`Debug: upload photo ${path} detected ${faces.length} face(s) and stored embeddings successfully.`);
          }
        } else {
          console.warn('No face detected for uploaded photo', {
            photoId: photo.id,
            storagePath: path,
          });
          setDebugInfo(`Debug: upload photo ${path} had no detectable face, so no embedding was stored.`);
        }
      }
      URL.revokeObjectURL(image.src);
      uploaded += 1;
    }
    setMessage(`${uploaded} photo${uploaded === 1 ? '' : 's'} uploaded successfully.`);
    setFiles([]); setBusy(false); loadEvents();
  };

  if (!canUpload) return <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center"><UploadCloud className="mx-auto mb-3 h-10 w-10 text-slate-300" /><h1 className="text-lg font-bold text-slate-900">Upload access is restricted</h1><p className="mt-2 text-sm text-slate-500">Faculty and approved event team members can add event photos.</p></div>;

  return <div className="mx-auto max-w-3xl space-y-6">
    <div><p className="text-sm font-medium text-blue-600">Photographer portal</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Add event photos</h1><p className="mt-2 text-sm text-slate-500">Upload a full event album in one go. Images stay private to approved university members.</p></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">1. Choose an event</h2><button onClick={() => setCreateEvent(!createEvent)} className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700"><CalendarPlus className="h-4 w-4" /> New event</button></div>
      {createEvent ? <div className="grid gap-3 sm:grid-cols-2">{[['title','Event name'],['venue','Venue'],['photographer','Photographer']].map(([key,label]) => <input key={key} placeholder={label} value={form[key as keyof typeof form]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400" />)}<input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm">{EVENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select><textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="sm:col-span-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /></div> : <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"><option value="">Select event</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title} · {event.event_date}</option>)}</select>}
      <div><h2 className="mb-3 font-semibold text-slate-900">2. Add images</h2><div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }} className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 px-6 py-12 text-center hover:bg-blue-50"><ImagePlus className="mb-3 h-9 w-9 text-blue-500" /><span className="text-sm font-semibold text-slate-700">Drag and drop images here</span><span className="mt-1 text-xs text-slate-500">or choose from your device or use the camera</span></div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => uploadInputRef.current?.click()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><UploadCloud className="h-4 w-4" /> Add photo</button><button type="button" onClick={openCamera} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"><Camera className="h-4 w-4" /> Open camera</button></div><input ref={uploadInputRef} type="file" accept="image/jpeg,image/png,image/heic,image/webp" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} /><input ref={cameraInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} /></div>
      {cameraOpen && <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="overflow-hidden rounded-xl bg-slate-100"><video ref={cameraVideoRef} autoPlay muted playsInline className="h-64 w-full object-cover" /></div><div className="mt-3 flex gap-2"><button type="button" onClick={captureFromCamera} className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">Capture</button><button type="button" onClick={stopCamera} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button></div></div>}
      {files.length > 0 && <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><span className="flex items-center gap-2 text-slate-600"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {files.length} images ready</span><button onClick={() => setFiles([])} className="text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button></div>}
      {message && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {debugInfo && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-xs text-amber-800">{debugInfo}</div>}
      <button disabled={busy || files.length === 0} onClick={submit} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading album...</> : <><UploadCloud className="h-4 w-4" /> Upload photos</>}</button>
    </div>
  </div>;
}
