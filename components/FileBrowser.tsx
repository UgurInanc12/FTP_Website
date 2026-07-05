'use client';

import React, { useState } from 'react';
import { FtpItem } from '@/types/ftp';
import { Folder, File, ArrowLeft, Download, RefreshCw, AlertTriangle, FileText } from 'lucide-react';

interface FileBrowserProps {
  currentPath: string;
  items: FtpItem[];
  loading: boolean;
  error: string | null;
  onNavigate: (newPath: string) => void;
  onRefresh: () => void;
  credentials: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  } | null;
}

export default function FileBrowser({
  currentPath,
  items,
  loading,
  error,
  onNavigate,
  onRefresh,
  credentials,
}: FileBrowserProps) {
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!credentials) {
    return null;
  }

  // Format file size nicely
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Traverse to a child directory or parent directory
  const handleFolderClick = (folderName: string) => {
    let newPath = currentPath;
    if (newPath.endsWith('/')) {
      newPath += folderName;
    } else {
      newPath += '/' + folderName;
    }
    onNavigate(newPath);
  };

  const handleParentClick = () => {
    if (currentPath === '/') return;
    const segments = currentPath.split('/').filter(Boolean);
    segments.pop();
    const newPath = '/' + segments.join('/');
    onNavigate(newPath);
  };

  // Download a remote file
  const handleDownload = async (item: FtpItem) => {
    const fullRemotePath = currentPath.endsWith('/')
      ? `${currentPath}${item.name}`
      : `${currentPath}/${item.name}`;

    setDownloadingFile(item.name);
    setDownloadError(null);

    try {
      const response = await fetch('/api/ftp/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host: credentials.host,
          port: credentials.port,
          username: credentials.username,
          password: credentials.password,
          remotePath: fullRemotePath,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Could not download file.');
      }

      // Convert the response to a Blob stream and trigger a client-side download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', item.name);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setDownloadError(`Could not download file: ${err.message}`);
    } finally {
      setDownloadingFile(null);
    }
  };

  return (
    <div className="bg-[#161B22] rounded-lg border border-[#30363D] flex flex-col overflow-hidden shadow-sm" id="file-browser-container">
      {/* Header bar */}
      <div className="p-4 border-b border-[#30363D] bg-[#1C2128] flex flex-col sm:flex-row sm:items-center justify-between gap-3" id="file-browser-header">
        <div className="space-y-1">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">FTP File Browser</h2>
          <div className="flex items-center gap-1.5 bg-[#0D1117] px-3 py-1.5 rounded border border-[#30363D] text-xs font-mono text-[#E0E0E0]" id="current-path-display">
            <span className="text-blue-400 font-semibold select-none">Path:</span>
            <span className="truncate">{currentPath}</span>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {currentPath !== '/' && (
            <button
              type="button"
              onClick={handleParentClick}
              className="px-3 py-1.5 text-xs border border-[#30363D] rounded hover:bg-[#21262D] text-gray-300 font-medium transition-colors inline-flex items-center gap-1"
              id="navigate-parent-btn"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Parent Folder
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs bg-gray-750 hover:bg-gray-700 text-[#E0E0E0] rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1 border border-[#30363D]"
            id="refresh-directory-btn"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Download error display */}
      {downloadError && (
        <div className="m-4 p-3 bg-red-950/40 border border-red-900/50 rounded text-red-400 text-xs flex items-start gap-2" id="download-error-box">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{downloadError}</span>
        </div>
      )}

      {/* Directory Contents */}
      {loading ? (
        <div className="py-12 flex flex-col justify-center items-center gap-2 text-gray-400 text-xs font-medium" id="browser-loading-spinner">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
          <span>Loading files...</span>
        </div>
      ) : error ? (
        <div className="py-10 text-center bg-[#0D1117] border border-[#30363D] rounded m-4 space-y-2 px-4" id="browser-error-box">
          <AlertTriangle className="w-6 h-6 text-red-500 mx-auto" />
          <h4 className="text-xs font-semibold text-gray-300">Could not list directory</h4>
          <p className="text-[11px] text-gray-500 max-w-sm mx-auto leading-relaxed">{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center bg-[#0D1117] border border-[#30363D] rounded m-4 text-xs text-gray-500" id="browser-empty-box">
          Empty directory
        </div>
      ) : (
        <div className="overflow-x-auto bg-[#0D1117]" id="files-table-container">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="sticky top-0 bg-[#161B22] text-[11px] text-gray-500 uppercase tracking-widest border-b border-[#30363D]">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold text-right">Size</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm font-mono text-[#E0E0E0]">
              {items.map((item) => (
                <tr key={item.name} className="border-b border-[#21262D] hover:bg-[#21262D]/50 transition-colors group">
                  <td className="px-4 py-3 max-w-[280px] truncate flex items-center gap-2">
                    {item.type === 'directory' ? (
                      <button
                        type="button"
                        onClick={() => handleFolderClick(item.name)}
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 hover:underline font-medium text-left"
                        id={`folder-link-${item.name.toLowerCase()}`}
                      >
                        <Folder className="w-4 h-4 shrink-0 text-blue-500 fill-blue-500/10" />
                        <span>{item.name}</span>
                      </button>
                    ) : (
                      <span className="flex items-center gap-2 text-gray-300">
                        {item.name.endsWith('.txt') || item.name.endsWith('.log') ? (
                          <FileText className="w-4 h-4 shrink-0 text-gray-500" />
                        ) : (
                          <File className="w-4 h-4 shrink-0 text-gray-500" />
                        )}
                        <span>{item.name}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-gray-500 select-none">
                    {item.type === 'directory' ? 'DIR' : 'FILE'}
                  </td>
                  <td className="px-4 py-3 text-right text-[11px] text-gray-400">
                    {item.type === 'file' ? formatSize(item.size) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-sans">
                    {item.type === 'file' ? (
                      <button
                        type="button"
                        disabled={downloadingFile !== null}
                        onClick={() => handleDownload(item)}
                        className="px-2 py-1 text-xs bg-blue-600/10 text-blue-400 border border-blue-600/30 rounded hover:bg-blue-600/20 inline-flex items-center gap-1 transition-colors disabled:opacity-50 ml-auto cursor-pointer"
                        id={`download-file-${item.name.toLowerCase()}`}
                      >
                        {downloadingFile === item.name ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                            <span>Downloading...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3 h-3" />
                            <span>Download</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleFolderClick(item.name)}
                        className="text-xs text-blue-400 hover:underline font-medium"
                        id={`open-folder-${item.name.toLowerCase()}`}
                      >
                        Open
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Table bottom summary */}
      {!loading && !error && items.length > 0 && (
        <div className="p-3 bg-[#0D1117] border-t border-[#30363D] flex items-center justify-between">
          <div className="text-[11px] text-gray-500 font-mono">
            {items.length} item{items.length > 1 ? 's' : ''} total &bull; Path: {currentPath}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-orange-500/85 font-semibold hidden sm:block">
            Only scan networks you have permission to access.
          </div>
        </div>
      )}
    </div>
  );
}
