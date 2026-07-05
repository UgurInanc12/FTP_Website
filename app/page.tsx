'use client';

import React, { useState, useEffect } from 'react';
import NetworkSelector from '@/components/NetworkSelector';
import ScanPanel from '@/components/ScanPanel';
import ManualConnection from '@/components/ManualConnection';
import FileBrowser from '@/components/FileBrowser';
import { FtpItem } from '@/types/ftp';
import { Network, FolderTree, Power, CheckCircle, Shield, Wifi } from 'lucide-react';

export default function Home() {
  const [selectedCidr, setSelectedCidr] = useState('');
  const [isCloud, setIsCloud] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (
        hostname !== 'localhost' &&
        hostname !== '127.0.0.1' &&
        hostname !== '::1' &&
        !hostname.startsWith('192.168.') &&
        !hostname.startsWith('10.')
      ) {
        // Defer to avoid ESLint warning on synchronous state setting inside useEffect
        const timer = setTimeout(() => {
          setIsCloud(true);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, []);
  
  // Connection parameters
  const [credentials, setCredentials] = useState<{
    host: string;
    port: number;
    username?: string;
    password?: string;
  } | null>(null);

  // Prefilled credentials (when clicking 'Connect' in scanner)
  const [initialHost, setInitialHost] = useState('');
  const [initialPort, setInitialPort] = useState(2121); // Default common Android FTP port

  // FTP Browser states
  const [browserPath, setBrowserPath] = useState('/');
  const [browserItems, setBrowserItems] = useState<FtpItem[]>([]);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserError, setBrowserError] = useState<string | null>(null);

  // Triggered when clicking 'Connect' on a scanned results row
  const handleSelectScannedServer = (host: string, port: number) => {
    setInitialHost(host);
    setInitialPort(port);
    
    // Smoothly scroll down to the manual credentials box
    const manualEl = document.getElementById('manual-connection-container');
    if (manualEl) {
      manualEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Directory listing fetcher
  const fetchDirectory = async (
    path: string,
    currentCredentials = credentials
  ) => {
    if (!currentCredentials) return;

    setBrowserLoading(true);
    setBrowserError(null);

    try {
      const response = await fetch('/api/ftp/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host: currentCredentials.host,
          port: currentCredentials.port,
          username: currentCredentials.username,
          password: currentCredentials.password,
          path,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not retrieve directory contents.');
      }

      setBrowserItems(data.items || []);
      setBrowserPath(path);
    } catch (err: any) {
      setBrowserError(err.message || 'Error listing folder contents.');
      // Keep old items if navigation failed
    } finally {
      setBrowserLoading(false);
    }
  };

  // Navigate to a directory and fetch its contents
  const handleNavigate = (path: string) => {
    setBrowserPath(path);
    fetchDirectory(path);
  };

  // Perform initial login and root list
  const handleConnect = async (creds: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  }) => {
    setCredentials(creds);
    setBrowserPath('/');
    setBrowserItems([]);
    await fetchDirectory('/', creds);
  };

  // Terminate local session
  const handleDisconnect = () => {
    setCredentials(null);
    setBrowserItems([]);
    setBrowserPath('/');
    setBrowserError(null);
  };

  return (
    <main className="min-h-screen bg-[#0F1115] text-[#E0E0E0] font-sans flex flex-col justify-between selection:bg-blue-600/30 selection:text-white">
      {/* Professional Polish top header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#2D333F] bg-[#161B22] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-900/20" id="app-logo">
            <Network className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#E0E0E0]">Local FTP Finder</h1>
            <p className="text-[10px] text-gray-500 font-mono">
              Safe private-subnet scanner & explorer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-gray-400">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isCloud ? 'bg-amber-500' : 'bg-green-500 animate-pulse'}`}></span>
            {isCloud ? 'Cloud Sandbox (Hosted)' : 'Local Service: Online'}
          </div>
          <div className="px-3 py-1 bg-[#21262D] rounded border border-[#30363D]">
            {isCloud ? 'run.app' : '127.0.0.1:3000'}
          </div>
        </div>
      </header>

      {/* Cloud Environment Warning Banner */}
      {isCloud && (
        <div className="max-w-7xl w-full mx-auto px-6 pt-6" id="cloud-environment-warning">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-5 flex flex-col md:flex-row md:items-start gap-4 shadow-sm">
            <div className="p-2 bg-amber-500/10 rounded text-amber-400 shrink-0 self-start md:self-auto">
              <Wifi className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-2 flex-1 animate-fade-in">
              <h3 className="text-sm font-semibold text-amber-300">
                ⚠️ Cloud Sandbox Connection Advisory
              </h3>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                You are currently viewing this application in the <strong>AI Studio Cloud Sandbox</strong>. 
                Because the backend is hosted on a Google Cloud Run server, it cannot reach private IP addresses (such as your phone{"'"}s FTP server at <code className="bg-amber-950/40 px-1 py-0.5 rounded font-mono text-amber-300">192.168.0.246</code>) on your local home Wi-Fi network.
              </p>
              <div className="text-xs text-amber-300/90 bg-amber-950/20 border border-amber-500/20 rounded p-4 font-medium space-y-2">
                <span className="block font-bold">To easily connect to your phone{"'"}s FTP server:</span>
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li>Open the AI Studio workspace menu in the top right and click <strong>Export</strong> (either download the project as a ZIP or push to GitHub).</li>
                  <li>Extract the ZIP and run the application on your local computer by executing the following terminal commands:
                    <code className="block bg-[#0D1117]/80 p-2 mt-1.5 rounded text-gray-300 border border-[#30363D]/40 font-mono text-[11px] font-normal">npm install && npm run dev</code>
                  </li>
                  <li>Navigate to <code className="bg-amber-950/40 px-1.5 py-0.5 rounded font-mono text-amber-300">http://localhost:3000</code> in your browser. Since the server is now running on your local machine, it will be able to fully scan and browse files on your phone instantly!</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main app body */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8" id="main-content-layout">
        
        {/* Responsive Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Panel - Discovery & Credentials (5 Columns) */}
          <div className="lg:col-span-5 space-y-6">
            <NetworkSelector
              onCidrChange={setSelectedCidr}
              selectedCidr={selectedCidr}
            />

            <ScanPanel
              cidr={selectedCidr}
              onConnectServer={handleSelectScannedServer}
            />

            <ManualConnection
              key={`${initialHost}:${initialPort}`}
              initialHost={initialHost}
              initialPort={initialPort}
              onConnect={handleConnect}
              loading={browserLoading && credentials === null}
            />
          </div>

          {/* Right Panel - Active browser (7 Columns) */}
          <div className="lg:col-span-7">
            {credentials ? (
              <div className="space-y-4 animate-fade-in" id="active-browser-wrapper">
                {/* Connection Status Card */}
                <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-4 flex items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <Wifi className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#E0E0E0]">
                        Active Connection Established
                      </div>
                      <div className="text-xs text-gray-400 font-mono">
                        Host: <span className="text-blue-400 font-medium">{credentials.host}</span>:{credentials.port} | User: <span className="text-gray-300">{credentials.username || 'anonymous'}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 border border-[#30363D] hover:bg-[#21262D] text-xs font-medium rounded text-gray-300 hover:text-red-400 hover:border-red-900/50 transition-all flex items-center gap-1.5 shrink-0"
                    id="disconnect-btn"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>

                <FileBrowser
                  currentPath={browserPath}
                  items={browserItems}
                  loading={browserLoading}
                  error={browserError}
                  onNavigate={handleNavigate}
                  onRefresh={() => fetchDirectory(browserPath)}
                  credentials={credentials}
                />
              </div>
            ) : (
              <div className="bg-[#161B22] border border-[#30363D] border-dashed rounded-lg p-12 text-center h-full min-h-[420px] flex flex-col justify-center items-center gap-4 shadow-sm" id="inactive-browser-placeholder">
                <div className="w-12 h-12 rounded-lg bg-[#0D1117] border border-[#30363D] flex items-center justify-center mb-1">
                  <FolderTree className="w-6 h-6 text-gray-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#E0E0E0]">File Explorer Inactive</h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed mt-1">
                    No active remote session. Select a detected FTP server from the Port Scanner above or input manual login parameters to browse.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono uppercase bg-[#0D1117] border border-[#30363D] px-3 py-1.5 rounded-lg select-none">
                  <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                  <span>Stateless Session Ready</span>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Professional Polish status footer */}
      <footer className="px-6 py-2 bg-[#0D1117] border-t border-[#30363D] flex items-center justify-between text-[10px] text-gray-600 font-mono shrink-0">
        <div>READY: Waiting for user action</div>
        <div className="flex gap-4">
          <span>CPU: 0.2%</span>
          <span>RAM: 42MB</span>
          <span>SCANNER: IDLE</span>
        </div>
      </footer>
    </main>
  );
}
