'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FolderSearch, Network, Plus, RefreshCw, Server } from 'lucide-react';
import ConnectionCard from '@/components/ConnectionCard';
import FileBrowser from '@/components/FileBrowser';
import { ConnectionEntry, LoginValues } from '@/types/connection';
import { FtpItem } from '@/types/ftp';
import { NetworkInterfaceInfo, ScanResult } from '@/types/network';

const DEFAULT_PORTS = [21, 2121, 2221, 8021, 3721];
const PATH_STORAGE_KEY = 'local-ftp:last-paths:v1';

export default function Home() {
  const started = useRef(false);
  const [connections, setConnections] = useState<Record<string, ConnectionEntry>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [subnets, setSubnets] = useState<string[]>([]);
  const [scanProgress, setScanProgress] = useState('');
  const [scanning, setScanning] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualHost, setManualHost] = useState('');
  const [manualPort, setManualPort] = useState(2121);

  const updateConnection = useCallback(
    (key: string, update: Partial<ConnectionEntry> | ((entry: ConnectionEntry) => Partial<ConnectionEntry>)) => {
      setConnections((current) => {
        const entry = current[key];
        if (!entry) return current;
        const patch = typeof update === 'function' ? update(entry) : update;
        return { ...current, [key]: { ...entry, ...patch } };
      });
    },
    []
  );

  const scanNetworks = useCallback(async () => {
    setScanning(true);
    setDiscoveryError(null);
    setScanProgress('Detecting local networks');

    try {
      const interfaceResponse = await fetch('/api/network/interfaces');
      const interfaces = (await interfaceResponse.json()) as NetworkInterfaceInfo[];
      if (!interfaceResponse.ok || !Array.isArray(interfaces)) {
        throw new Error('Could not detect local network interfaces.');
      }

      const detectedSubnets = [...new Set(interfaces.map((item) => addressTo24(item.address)))];
      if (detectedSubnets.length === 0) {
        throw new Error('No private IPv4 network was detected.');
      }
      setSubnets(detectedSubnets);

      const allResults = new Map<string, ScanResult>();
      for (let index = 0; index < detectedSubnets.length; index += 1) {
        const cidr = detectedSubnets[index];
        setScanProgress(`Scanning ${cidr} (${index + 1}/${detectedSubnets.length})`);
        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cidr, ports: DEFAULT_PORTS }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Could not scan ${cidr}.`);
        }
        for (const result of (data.results || []) as ScanResult[]) {
          allResults.set(connectionKey(result.host, result.port), result);
        }
      }

      setConnections((current) => {
        const next = { ...current };
        for (const [key, server] of allResults) {
          next[key] = next[key] || createConnection(server);
        }
        return next;
      });

      const firstKey = allResults.keys().next().value as string | undefined;
      if (firstKey) {
        setSelectedKey((current) => current || firstKey);
      } else {
        setDiscoveryError('No FTP servers were found. You can add one manually.');
      }
      setScanProgress('');
    } catch (error) {
      setDiscoveryError(error instanceof Error ? error.message : 'Network discovery failed.');
      setScanProgress('');
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void scanNetworks();
  }, [scanNetworks]);

  const connect = async (key: string) => {
    const connection = connections[key];
    if (!connection) return;
    updateConnection(key, { status: 'connecting', loading: true, error: undefined });

    const savedPath = readSavedPaths()[key] || connection.path || '/';
    try {
      const response = await fetch('/api/ftp/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: connection.server.host,
          port: connection.server.port,
          username: connection.anonymous ? 'anonymous' : connection.username,
          password: connection.anonymous ? '' : connection.password,
          path: savedPath,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not connect to the FTP server.');
      }

      updateConnection(key, {
        status: 'connected',
        loading: false,
        error: undefined,
        sessionId: data.sessionId,
        path: data.path,
        items: data.items || [],
      });
      savePath(key, data.path);
      setSelectedKey(key);
    } catch (error) {
      updateConnection(key, {
        status: 'error',
        loading: false,
        error: error instanceof Error ? error.message : 'Could not connect.',
      });
    }
  };

  const disconnect = async (key: string) => {
    const connection = connections[key];
    if (connection?.sessionId) {
      await fetch(`/api/ftp/session/${connection.sessionId}`, { method: 'DELETE' }).catch(() => undefined);
    }
    updateConnection(key, {
      status: 'disconnected',
      sessionId: undefined,
      items: [],
      loading: false,
      error: undefined,
      password: '',
    });
  };

  const loadDirectory = async (key: string, path: string) => {
    const connection = connections[key];
    if (!connection?.sessionId) return;
    updateConnection(key, { loading: true, error: undefined });

    try {
      const response = await fetch('/api/ftp/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: connection.sessionId, path }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === 'SESSION_EXPIRED') {
          updateConnection(key, { status: 'disconnected', sessionId: undefined, items: [] });
        }
        throw new Error(data.error || 'Could not open this folder.');
      }

      updateConnection(key, {
        path: data.path,
        items: data.items as FtpItem[],
        loading: false,
      });
      savePath(key, data.path);
    } catch (error) {
      updateConnection(key, {
        loading: false,
        error: error instanceof Error ? error.message : 'Could not open this folder.',
      });
    }
  };

  const addManualConnection = (event: React.FormEvent) => {
    event.preventDefault();
    const host = manualHost.trim();
    if (!host) return;
    const key = connectionKey(host, manualPort);
    const server: ScanResult = {
      host,
      port: manualPort,
      status: 'open',
      banner: 'Manual connection',
      likelyFtp: true,
    };
    setConnections((current) => ({
      ...current,
      [key]: current[key] || createConnection(server),
    }));
    setSelectedKey(key);
    setShowManual(false);
  };

  const connectionList = Object.values(connections);
  const selected = selectedKey ? connections[selectedKey] : undefined;

  return (
    <main className="min-h-screen bg-[#0b0d10] text-slate-200">
      <header className="border-b border-white/10 bg-[#101318]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-600">
              <Network className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">Local FTP</h1>
              <p className="text-xs text-slate-500">
                {scanProgress || `${connectionList.length} FTP server${connectionList.length === 1 ? '' : 's'} found`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void scanNetworks()}
            disabled={scanning}
            className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
            Scan again
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-5 px-5 py-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-3">
          {subnets.length > 0 && (
            <p className="px-1 text-xs leading-5 text-slate-600">{subnets.join(' · ')}</p>
          )}

          {discoveryError && (
            <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200">
              {discoveryError}
            </p>
          )}

          {connectionList.map((connection) => (
            <ConnectionCard
              key={connection.key}
              connection={connection}
              selected={selectedKey === connection.key}
              onSelect={() => setSelectedKey(connection.key)}
              onLoginChange={(values: LoginValues) => updateConnection(connection.key, values)}
              onConnect={() => void connect(connection.key)}
              onDisconnect={() => void disconnect(connection.key)}
            />
          ))}

          {showManual ? (
            <form
              onSubmit={addManualConnection}
              className="space-y-3 rounded-lg border border-white/10 bg-[#11151b] p-4"
            >
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <input
                  type="text"
                  value={manualHost}
                  onChange={(event) => setManualHost(event.target.value)}
                  placeholder="192.168.1.20"
                  required
                  className="min-w-0 rounded-md border border-white/10 bg-[#0b0d10] px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  value={manualPort}
                  onChange={(event) => setManualPort(Number(event.target.value))}
                  min={1}
                  max={65535}
                  required
                  className="rounded-md border border-white/10 bg-[#0b0d10] px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white">
                  Add server
                </button>
                <button
                  type="button"
                  onClick={() => setShowManual(false)}
                  className="rounded-md border border-white/10 px-3 py-2 text-xs text-slate-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 px-3 py-3 text-xs text-slate-500 hover:border-white/20 hover:text-slate-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Add server manually
            </button>
          )}
        </aside>

        <section className="min-w-0">
          {selected?.status === 'connected' && selected.sessionId ? (
            <FileBrowser
              key={selected.key}
              sessionId={selected.sessionId}
              currentPath={selected.path}
              items={selected.items}
              loading={selected.loading}
              error={selected.error || null}
              onNavigate={(path) => void loadDirectory(selected.key, path)}
              onRefresh={() => void loadDirectory(selected.key, selected.path)}
            />
          ) : (
            <div className="flex min-h-[560px] items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#0e1116] p-8 text-center">
              <div className="max-w-sm">
                {selected ? (
                  <Server className="mx-auto h-8 w-8 text-slate-700" />
                ) : (
                  <FolderSearch className="mx-auto h-8 w-8 text-slate-700" />
                )}
                <h2 className="mt-4 text-sm font-medium text-slate-300">
                  {selected ? 'Connect to browse this server' : 'Select an FTP server'}
                </h2>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  Files from the selected connected server will appear here.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function addressTo24(address: string): string {
  const octets = address.split('.');
  if (octets.length !== 4) throw new Error(`Unsupported network address: ${address}`);
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
}

function connectionKey(host: string, port: number) {
  return `${host}:${port}`;
}

function createConnection(server: ScanResult): ConnectionEntry {
  return {
    key: connectionKey(server.host, server.port),
    server,
    status: 'disconnected',
    path: '/',
    items: [],
    loading: false,
    anonymous: true,
    username: 'anonymous',
    password: '',
  };
}

function readSavedPaths(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PATH_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function savePath(key: string, path: string) {
  const paths = readSavedPaths();
  paths[key] = path;
  localStorage.setItem(PATH_STORAGE_KEY, JSON.stringify(paths));
}
