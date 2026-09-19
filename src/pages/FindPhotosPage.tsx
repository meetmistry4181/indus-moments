import { useRef, useState } from 'react';
import {
  Search,
  Sparkles,
  Upload,
  Loader2,
  Image as ImageIcon,
  Camera,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { detectSingleFace, descriptorToArray } from '@/lib/faceApi';
import { useAuth } from '@/lib/AuthContext';

type MatchResult = {
  photo_id: string;
  distance: number;
  url?: string;
};

export default function FindPhotosPage() {
  const { profile } = useAuth();

  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [results, setResults] = useState<MatchResult[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const findMatches = async (embedding: number[]) => {
    const thresholds = [0.6, 0.8, 0.95];

    for (const maxDistance of thresholds) {
      const { data, error } = await supabase.rpc('match_faces', {
        query_embedding: `[${embedding.join(',')}]`,
        max_distance: maxDistance,
      });

      if (error) {
        console.error('Face matching error:', error);
        return { matches: [] as { photo_id: string; distance: number }[], error };
      }

      if (data && data.length > 0) {
        return {
          matches: data as { photo_id: string; distance: number }[],
          error: null,
          usedThreshold: maxDistance,
        };
      }
    }

    return { matches: [] as { photo_id: string; distance: number }[], error: null, usedThreshold: null };
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
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopCamera();
      await choose(file);
    }, 'image/jpeg', 0.92);
  };

  const choose = async (file?: File) => {
    if (!file) return;

    // Only allow image files
    if (!file.type.startsWith('image/')) {
      setMessage('Please select a valid image file.');
      return;
    }

    // Limit selfie size to 10 MB
    if (file.size > 10 * 1024 * 1024) {
      setMessage('Please choose an image smaller than 10 MB.');
      return;
    }

    // Create one temporary URL for the selfie
    const imageUrl = URL.createObjectURL(file);

    setPreview(imageUrl);
    setBusy(true);
    setMessage('');
    setDebugInfo('');
    setResults([]);

    try {
      // Load image
      const img = new Image();
      img.src = imageUrl;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Could not load image'));
      });

      // Detect face
      const descriptor = await detectSingleFace(img);

      if (!descriptor) {
        setDebugInfo('Debug: no face was detected in the uploaded selfie image.');
        setMessage(
          'No clear face found. Try a front-facing selfie with good lighting.'
        );
        return;
      }

      // Convert face descriptor
      const embedding = descriptorToArray(descriptor);

      const debugSummary = `Debug: selfie descriptor generated successfully (${embedding.length} values).`;
      setDebugInfo(debugSummary);
      console.info('Selfie face descriptor ready', {
        embeddingLength: embedding.length,
        sample: embedding.slice(0, 8),
      });

      const { matches, error, usedThreshold } = await findMatches(embedding);

      if (error) {
        setDebugInfo('Debug: face matching RPC returned an error.');
        setMessage(
          'Matching is unavailable right now. Please try again later.'
        );
        return;
      }

      if (usedThreshold !== null) {
        const summary = `Debug: match found using threshold ${usedThreshold} (${matches.length} result${matches.length === 1 ? '' : 's'}).`;
        setDebugInfo(summary);
        console.info('Face match succeeded using threshold', {
          threshold: usedThreshold,
          matchCount: matches.length,
        });
      } else {
        const summary = 'Debug: no match found at any tested threshold (0.6, 0.8, 0.95). This usually means no face embedding exists for the event photos or the face is too different.';
        setDebugInfo(summary);
        console.warn('No match found for selfie at any threshold', {
          embeddingLength: embedding.length,
          sample: embedding.slice(0, 8),
        });
      }

      // Generate short-lived signed URLs
      const withUrls: MatchResult[] = await Promise.all(
        matches.map(async (match): Promise<MatchResult> => {
          const { data: photo, error: photoError } = await supabase
            .from('photos')
            .select('storage_path')
            .eq('id', match.photo_id)
            .maybeSingle();

          if (photoError || !photo) {
            return match;
          }

          // IMPORTANT:
          // event-photos is PRIVATE.
          // Signed URL expires after 5 minutes.
          const { data: signed, error: signedError } =
            await supabase.storage
              .from('event-photos')
              .createSignedUrl(photo.storage_path, 300);

          if (signedError || !signed?.signedUrl) {
            return match;
          }

          return {
            ...match,
            url: signed.signedUrl,
          };
        })
      );

      const validResults = withUrls.filter(
        (result): result is MatchResult & { url: string } => Boolean(result.url)
      );

      setResults(validResults);

      if (validResults.length === 0) {
        setMessage(
          'No clear face match was found. Try a front-facing selfie with better lighting or a closer crop.'
        );
        return;
      }

      setMessage(
        `Found ${validResults.length} matching photo${
          validResults.length === 1 ? '' : 's'
        }.`
      );
    } catch (error) {
      console.error('Photo search error:', error);

      setMessage(
        'We could not process that image. Please try another selfie.'
      );
    } finally {
      setBusy(false);

      // Remove temporary browser object URL
      URL.revokeObjectURL(imageUrl);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm font-medium text-blue-600">
          Your private photo finder
        </p>

        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Find My Photos
        </h1>

        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Upload one selfie and we’ll look through approved event albums
          for photos where you appear. Your selfie is used only for
          matching.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* SELFIE UPLOAD */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="overflow-hidden rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 text-center">
            <div className="block cursor-pointer" onClick={() => uploadInputRef.current?.click()}>
              {preview ? (
                <img
                  src={preview}
                  alt="Selfie preview"
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square flex-col items-center justify-center p-4">
                  <Upload className="mb-3 h-8 w-8 text-blue-500" />

                  <span className="text-sm font-semibold text-slate-700">
                    Choose selfie
                  </span>

                  <span className="mt-1 text-xs text-slate-500">
                    Clear face, good lighting
                  </span>
                </div>
              )}
            </div>

            <input
              ref={uploadInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => choose(e.target.files?.[0])}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => uploadInputRef.current?.click()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Upload className="h-4 w-4" /> Add photo
            </button>
            <button type="button" onClick={openCamera} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
              <Camera className="h-4 w-4" /> Open camera
            </button>
          </div>

          {cameraOpen && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="overflow-hidden rounded-xl bg-slate-100">
                <video ref={cameraVideoRef} autoPlay muted playsInline className="h-64 w-full object-cover" />
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={captureFromCamera} className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">Capture</button>
                <button type="button" onClick={stopCamera} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          )}

          {busy && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Scanning albums...
            </div>
          )}

          {message && (
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-center text-sm text-slate-600">
              {message}
            </p>
          )}

          {debugInfo && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-800">
              {debugInfo}
            </p>
          )}
        </div>

        {/* RESULTS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />

            <h2 className="font-semibold text-slate-900">
              Your matches
            </h2>
          </div>

          {results.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <Search className="mb-3 h-10 w-10 text-slate-200" />

              <p className="text-sm text-slate-500">
                Your matched photos will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {results.map((result) => (
                <div
                  key={result.photo_id}
                  className="group relative overflow-hidden rounded-xl bg-slate-100"
                >
                  {result.url ? (
                    <img
                      src={result.url}
                      alt="Matched event"
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-slate-300" />
                    </div>
                  )}

                  <span className="absolute bottom-2 left-2 rounded-lg bg-black/65 px-2 py-1 text-xs text-white">
                    {Math.max(
                      0,
                      Math.round((1 - result.distance) * 100)
                    )}
                    % match
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}