'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowLeft,
  Download,
  File,
  FileAudio,
  FileText,
  Folder,
  Image as ImageIcon,
  Maximize2,
  RefreshCw,
  Video,
} from 'lucide-react';
import FilePreviewModal, {
  createMediaUrl,
  MediaKind,
} from '@/components/FilePreviewModal';
import { FtpItem } from '@/types/ftp';

type GridSize = 'compact' | 'standard' | 'large';

interface FileBrowserProps {
  sessionId: string;
  currentPath: string;
  items: FtpItem[];
  loading: boolean;
  error: string | null;
  onNavigate: (newPath: string) => void;
  onRefresh: () => void;
}

const GRID_STORAGE_KEY = 'local-ftp:grid-size:v1';
const GRID_CONFIG: Record<GridSize, { minWidth: number; previewHeight: number; rowHeight: number; width: number }> = {
  compact: { minWidth: 130, previewHeight: 92, rowHeight: 174, width: 160 },
  standard: { minWidth: 190, previewHeight: 136, rowHeight: 226, width: 240 },
  large: { minWidth: 270, previewHeight: 190, rowHeight: 288, width: 360 },
};

export default function FileBrowser({
  sessionId,
  currentPath,
  items,
  loading,
  error,
  onNavigate,
  onRefresh,
}: FileBrowserProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(800);
  const [gridSize, setGridSize] = useState<GridSize>('standard');
  const [gridPreferenceReady, setGridPreferenceReady] = useState(false);
  const [previewItem, setPreviewItem] = useState<FtpItem | null>(null);

  const sortedItems = useMemo(
    () => [
      ...items.filter((item) => item.type === 'directory'),
      ...items.filter((item) => item.type !== 'directory'),
    ],
    [items]
  );

  const config = GRID_CONFIG[gridSize];
  const gap = 12;
  const columns = Math.max(1, Math.floor((contentWidth + gap) / (config.minWidth + gap)));
  const rowCount = Math.ceil(sortedItems.length / columns);
  // TanStack Virtual intentionally exposes mutable measurement functions.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => config.rowHeight + gap,
    overscan: 3,
  });

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setContentWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(GRID_STORAGE_KEY);
    if (saved === 'compact' || saved === 'standard' || saved === 'large') {
      setGridSize(saved);
    }
    setGridPreferenceReady(true);
  }, []);

  useEffect(() => {
    if (!gridPreferenceReady) return;
    localStorage.setItem(GRID_STORAGE_KEY, gridSize);
    rowVirtualizer.measure();
  }, [gridPreferenceReady, gridSize, rowVirtualizer]);

  const navigateToChild = (name: string) => {
    const encodedPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    onNavigate(encodedPath);
  };

  const navigateToParent = () => {
    const segments = currentPath.split('/').filter(Boolean);
    segments.pop();
    onNavigate(`/${segments.join('/')}`);
  };

  return (
    <>
      <div className="flex h-[calc(100vh-116px)] min-h-[560px] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#11151b]">
        <header className="flex flex-col justify-between gap-3 border-b border-white/10 bg-[#141920] p-4 xl:flex-row xl:items-center">
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-white">Files</h2>
            <p className="mt-1 truncate text-xs text-slate-500">
              {currentPath} · {items.length.toLocaleString()} items
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-white/10 p-0.5">
              {(['compact', 'standard', 'large'] as GridSize[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setGridSize(size)}
                  className={`rounded px-2.5 py-1.5 text-xs capitalize ${
                    gridSize === size ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            {currentPath !== '/' && (
              <button
                type="button"
                onClick={navigateToParent}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Parent
              </button>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <p className="m-3 rounded-md border border-red-400/20 bg-red-400/5 p-3 text-xs text-red-200">
            {error}
          </p>
        )}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
          {loading && items.length === 0 ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading files
            </div>
          ) : sortedItems.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-600">Empty folder</div>
          ) : (
            <div ref={contentRef} className="relative m-3" style={{ height: rowVirtualizer.getTotalSize() }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const rowItems = sortedItems.slice(
                  virtualRow.index * columns,
                  virtualRow.index * columns + columns
                );
                return (
                  <div
                    key={virtualRow.key}
                    className="absolute left-0 top-0 grid w-full gap-3"
                    style={{
                      height: config.rowHeight,
                      transform: `translateY(${virtualRow.start}px)`,
                      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    }}
                  >
                    {rowItems.map((item) => {
                      const remotePath = joinRemotePath(currentPath, item.name);
                      const kind = getMediaKind(item.name);
                      return (
                        <FileCard
                          key={item.name}
                          item={item}
                          kind={kind}
                          sessionId={sessionId}
                          remotePath={remotePath}
                          previewHeight={config.previewHeight}
                          thumbnailWidth={config.width}
                          onOpen={() =>
                            item.type === 'directory'
                              ? navigateToChild(item.name)
                              : setPreviewItem(item)
                          }
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {previewItem && (
        <FilePreviewModal
          item={previewItem}
          remotePath={joinRemotePath(currentPath, previewItem.name)}
          sessionId={sessionId}
          kind={getMediaKind(previewItem.name)}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </>
  );
}

function FileCard({
  item,
  kind,
  sessionId,
  remotePath,
  previewHeight,
  thumbnailWidth,
  onOpen,
}: {
  item: FtpItem;
  kind: MediaKind;
  sessionId: string;
  remotePath: string;
  previewHeight: number;
  thumbnailWidth: number;
  onOpen: () => void;
}) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const mediaUrl = createMediaUrl(sessionId, remotePath);
  const thumbnailParams = new URLSearchParams({
    path: remotePath,
    modifiedAt: item.modifiedAt,
    width: String(thumbnailWidth),
  });
  const thumbnailUrl = `/api/ftp/thumbnail/${sessionId}?${thumbnailParams.toString()}`;

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0d1015] hover:border-white/20">
      <button
        type="button"
        onClick={onOpen}
        className="relative flex w-full items-center justify-center overflow-hidden bg-black/20 text-left"
        style={{ height: previewHeight }}
        title={item.name}
      >
        {item.type === 'directory' ? (
          <Folder className="h-10 w-10 fill-blue-500/10 text-blue-400" />
        ) : kind === 'image' && !previewFailed ? (
          <img
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            onError={() => setPreviewFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : kind === 'video' && !previewFailed ? (
          <video
            src={mediaUrl}
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(event) => {
              try {
                event.currentTarget.currentTime = Math.min(0.1, event.currentTarget.duration || 0.1);
              } catch {
                setPreviewFailed(true);
              }
            }}
            onError={() => setPreviewFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <FileKindIcon kind={kind} />
        )}
        {item.type !== 'directory' && (
          <span className="absolute right-2 top-2 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <Maximize2 className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1 p-2.5">
        <p className="truncate text-xs font-medium text-slate-200" title={item.name}>
          {item.name}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-600">
          <span>{item.type === 'directory' ? 'Folder' : formatSize(item.size)}</span>
          {item.type !== 'directory' && (
            <a
              href={`${mediaUrl}&download=1`}
              onClick={(event) => event.stopPropagation()}
              aria-label={`Download ${item.name}`}
              className="rounded p-1 text-slate-500 hover:bg-white/5 hover:text-blue-300"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function FileKindIcon({ kind }: { kind: MediaKind }) {
  if (kind === 'image') return <ImageIcon className="h-9 w-9 text-slate-600" />;
  if (kind === 'video') return <Video className="h-9 w-9 text-slate-600" />;
  if (kind === 'audio') return <FileAudio className="h-9 w-9 text-slate-600" />;
  if (kind === 'text' || kind === 'pdf') return <FileText className="h-9 w-9 text-slate-600" />;
  return <File className="h-9 w-9 text-slate-600" />;
}

function joinRemotePath(parent: string, name: string) {
  return parent === '/' ? `/${name}` : `${parent}/${name}`;
}

function getMediaKind(filename: string): MediaKind {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'svg'].includes(extension)) return 'image';
  if (['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi'].includes(extension)) return 'video';
  if (['mp3', 'm4a', 'aac', 'wav', 'ogg', 'flac'].includes(extension)) return 'audio';
  if (extension === 'pdf') return 'pdf';
  if (['txt', 'log', 'md', 'json', 'csv', 'xml', 'js', 'ts', 'css', 'html'].includes(extension)) return 'text';
  return 'other';
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
