'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from 'react';
import { Download, FileQuestion, LoaderCircle, X } from 'lucide-react';
import { FtpItem } from '@/types/ftp';

export type MediaKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'other';

interface FilePreviewModalProps {
  item: FtpItem;
  remotePath: string;
  sessionId: string;
  kind: MediaKind;
  onClose: () => void;
}

export default function FilePreviewModal({
  item,
  remotePath,
  sessionId,
  kind,
  onClose,
}: FilePreviewModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [text, setText] = useState('');
  const [textLoading, setTextLoading] = useState(kind === 'text');
  const [error, setError] = useState<string | null>(null);
  const mediaUrl = createMediaUrl(sessionId, remotePath);
  const downloadUrl = `${mediaUrl}&download=1`;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previous?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (kind !== 'text') return;
    const controller = new AbortController();
    fetch(mediaUrl, {
      headers: { Range: 'bytes=0-2097151' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load text preview.');
        return response.text();
      })
      .then(setText)
      .catch((reason) => {
        if (reason instanceof Error && reason.name !== 'AbortError') setError(reason.message);
      })
      .finally(() => setTextLoading(false));
    return () => controller.abort();
  }, [kind, mediaUrl]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${item.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#101318] shadow-2xl">
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-medium text-white">{item.name}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{formatSize(item.size)}</p>
          </div>
          <a
            href={downloadUrl}
            className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-md border border-white/10 p-2 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto bg-[#090b0e] p-4">
          {kind === 'image' && (
            <img src={mediaUrl} alt={item.name} className="mx-auto max-h-[78vh] max-w-full object-contain" />
          )}
          {kind === 'video' && (
            <video src={mediaUrl} controls autoPlay className="mx-auto max-h-[78vh] max-w-full" />
          )}
          {kind === 'audio' && (
            <div className="flex min-h-64 items-center justify-center">
              <audio src={mediaUrl} controls autoPlay className="w-full max-w-2xl" />
            </div>
          )}
          {kind === 'pdf' && (
            <iframe src={mediaUrl} title={item.name} className="h-[78vh] w-full rounded bg-white" />
          )}
          {kind === 'text' && (
            <>
              {textLoading && (
                <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Loading preview
                </div>
              )}
              {error && <p className="p-6 text-sm text-red-300">{error}</p>}
              {!textLoading && !error && (
                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-300">
                  {text}
                  {item.size > 2 * 1024 * 1024 ? '\n\n— Preview limited to the first 2 MB —' : ''}
                </pre>
              )}
            </>
          )}
          {kind === 'other' && (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <FileQuestion className="h-10 w-10 text-slate-700" />
              <p className="mt-4 text-sm text-slate-300">Preview is not available for this file type.</p>
              <p className="mt-1 text-xs text-slate-600">Use Download to open it with a local application.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function createMediaUrl(sessionId: string, remotePath: string) {
  const params = new URLSearchParams({ path: remotePath });
  return `/api/ftp/media/${sessionId}?${params.toString()}`;
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
