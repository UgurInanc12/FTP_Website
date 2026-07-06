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
type SortOrder = 'default' | 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc';

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
const SORT_STORAGE_KEY = 'local-ftp:sort-order:v1';
const MAX_VIDEO_PREVIEWS = 2;
let activeVideoPreviews = 0;
const videoPreviewQueue: Array<(release: () => void) => void> = [];
const GRID_CONFIG: Record<GridSize, { minWidth: number; previewHeight: number; rowHeight: number; width: number }> = {
  compact: { minWidth: 130, previewHeight: 92, rowHeight: 190, width: 160 },
  standard: { minWidth: 190, previewHeight: 136, rowHeight: 242, width: 240 },
  large: { minWidth: 270, previewHeight: 190, rowHeight: 304, width: 360 },
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
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');
  const [sortPreferenceReady, setSortPreferenceReady] = useState(false);
  const [previewItem, setPreviewItem] = useState<FtpItem | null>(null);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(() => new Set());

  const sortedItems = useMemo(() => {
    const directories = items.filter((item) => item.type === 'directory');
    const files = items.filter((item) => item.type !== 'directory');
    return [...sortItems(directories, sortOrder), ...sortItems(files, sortOrder)];
  }, [items, sortOrder]);
  const selectedCount = items.reduce(
    (count, item) => count + (selectedNames.has(item.name) ? 1 : 0),
    0
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

  useEffect(() => {
    const saved = localStorage.getItem(SORT_STORAGE_KEY);
    if (isSortOrder(saved)) setSortOrder(saved);
    setSortPreferenceReady(true);
  }, []);

  useEffect(() => {
    if (!sortPreferenceReady) return;
    localStorage.setItem(SORT_STORAGE_KEY, sortOrder);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [sortOrder, sortPreferenceReady]);

  const navigateToChild = (name: string) => {
    setSelectedNames(new Set());
    const encodedPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    onNavigate(encodedPath);
  };

  const navigateToParent = () => {
    setSelectedNames(new Set());
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
            <span className="text-xs text-slate-500">
              {selectedCount} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedNames(new Set(items.map((item) => item.name)))}
              disabled={items.length === 0 || selectedCount === items.length}
              className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-40"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setSelectedNames(new Set())}
              disabled={selectedCount === 0}
              className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-40"
            >
              Unselect all
            </button>
            <label className="flex items-center gap-2 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-500">
              <span>Sort</span>
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                className="rounded bg-[#11151b] px-1 py-0.5 text-slate-200 outline-none"
                title="FTP does not expose creation dates. Newest and oldest use modification metadata or a timestamp in the filename."
              >
                <option value="default">Server order</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
                <option value="size-desc">Largest first</option>
                <option value="size-asc">Smallest first</option>
              </select>
            </label>
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

        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
          {loading && items.length > 0 && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b0d10]/75 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#11151b] px-4 py-3 text-sm text-slate-300 shadow-xl">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
                Opening folder…
              </div>
            </div>
          )}
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
                          selected={selectedNames.has(item.name)}
                          onToggleSelected={() =>
                            setSelectedNames((current) => {
                              const next = new Set(current);
                              if (next.has(item.name)) next.delete(item.name);
                              else next.add(item.name);
                              return next;
                            })
                          }
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
  selected,
  onToggleSelected,
  onOpen,
}: {
  item: FtpItem;
  kind: MediaKind;
  sessionId: string;
  remotePath: string;
  previewHeight: number;
  thumbnailWidth: number;
  selected: boolean;
  onToggleSelected: () => void;
  onOpen: () => void;
}) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const mediaUrl = createMediaUrl(sessionId, remotePath);
  const thumbnailParams = new URLSearchParams({
    path: remotePath,
    modifiedAt: item.modifiedAt || '',
    width: String(thumbnailWidth),
  });
  const thumbnailUrl = `/api/ftp/thumbnail/${sessionId}?${thumbnailParams.toString()}`;

  return (
    <article
      className={`group relative flex min-w-0 flex-col overflow-hidden rounded-lg border bg-[#0d1015] ${
        selected ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-white/10 hover:border-white/20'
      }`}
    >
      <label
        className="absolute left-2 top-2 z-20 flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-black/70"
        onClick={(event) => event.stopPropagation()}
        title={selected ? `Unselect ${item.name}` : `Select ${item.name}`}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={selected ? `Unselect ${item.name}` : `Select ${item.name}`}
          className="h-4 w-4 cursor-pointer accent-blue-600"
        />
      </label>
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
          <VideoThumbnail
            mediaUrl={mediaUrl}
            name={item.name}
            onError={() => setPreviewFailed(true)}
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
        <p className="mt-1 truncate text-[10px] text-slate-600">
          {item.modifiedAt ? formatDate(item.modifiedAt) : 'Date unavailable'}
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

function VideoThumbnail({
  mediaUrl,
  name,
  onError,
}: {
  mediaUrl: string;
  name: string;
  onError: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const posterRef = useRef<string | null>(null);
  const capturingRef = useRef(false);
  const mountedRef = useRef(true);
  const [active, setActive] = useState(false);
  const [poster, setPoster] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    acquireVideoPreviewSlot().then((release) => {
      if (cancelled) {
        release();
        return;
      }
      releaseRef.current = release;
      setActive(true);
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      releaseRef.current?.();
      releaseRef.current = null;
      if (posterRef.current) URL.revokeObjectURL(posterRef.current);
    };
  }, []);

  const release = () => {
    releaseRef.current?.();
    releaseRef.current = null;
    if (mountedRef.current) setActive(false);
  };

  const captureFrame = () => {
    const video = videoRef.current;
    if (
      capturingRef.current ||
      !video ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      return;
    }
    capturingRef.current = true;
    const scale = Math.min(1, 640 / video.videoWidth, 360 / video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          release();
          if (mountedRef.current) onError();
          return;
        }
        const url = URL.createObjectURL(blob);
        if (!mountedRef.current) {
          URL.revokeObjectURL(url);
          release();
          return;
        }
        posterRef.current = url;
        setPoster(url);
        release();
      },
      'image/webp',
      0.72
    );
  };

  if (poster) {
    return <img src={poster} alt="" className="h-full w-full object-cover" />;
  }

  if (!active) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Video className="h-9 w-9 text-slate-600" />
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={mediaUrl}
      aria-label={`Loading preview for ${name}`}
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={(event) => {
        event.currentTarget.currentTime = Math.min(0.1, event.currentTarget.duration || 0.1);
      }}
      onLoadedData={captureFrame}
      onSeeked={captureFrame}
      onError={() => {
        release();
        onError();
      }}
      className="h-full w-full object-cover"
    />
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function sortItems(items: FtpItem[], order: SortOrder) {
  if (order === 'default') return items;
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      let result = 0;
      if (order === 'name-asc' || order === 'name-desc') {
        result = a.item.name.localeCompare(b.item.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
        if (order === 'name-desc') result *= -1;
      } else if (order === 'size-desc' || order === 'size-asc') {
        result = a.item.size - b.item.size;
        if (order === 'size-desc') result *= -1;
      } else {
        const aTime = a.item.modifiedAt ? Date.parse(a.item.modifiedAt) : Number.NaN;
        const bTime = b.item.modifiedAt ? Date.parse(b.item.modifiedAt) : Number.NaN;
        if (Number.isNaN(aTime) && Number.isNaN(bTime)) result = 0;
        else if (Number.isNaN(aTime)) result = 1;
        else if (Number.isNaN(bTime)) result = -1;
        else result = aTime - bTime;
        if (order === 'newest') result *= -1;
      }
      return result || a.index - b.index;
    })
    .map(({ item }) => item);
}

function isSortOrder(value: string | null): value is SortOrder {
  return [
    'default',
    'newest',
    'oldest',
    'name-asc',
    'name-desc',
    'size-desc',
    'size-asc',
  ].includes(value || '');
}

function acquireVideoPreviewSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    const start = (release: () => void) => resolve(release);
    videoPreviewQueue.push(start);
    runVideoPreviewQueue();
  });
}

function runVideoPreviewQueue() {
  while (activeVideoPreviews < MAX_VIDEO_PREVIEWS && videoPreviewQueue.length > 0) {
    const start = videoPreviewQueue.shift();
    if (!start) return;
    activeVideoPreviews += 1;
    let released = false;
    start(() => {
      if (released) return;
      released = true;
      activeVideoPreviews = Math.max(0, activeVideoPreviews - 1);
      runVideoPreviewQueue();
    });
  }
}
