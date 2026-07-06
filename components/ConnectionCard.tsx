'use client';

import { ChevronDown, ChevronRight, LoaderCircle, LogIn, Unplug } from 'lucide-react';
import { ConnectionEntry, LoginValues } from '@/types/connection';

interface ConnectionCardProps {
  connection: ConnectionEntry;
  selected: boolean;
  onSelect: () => void;
  onLoginChange: (values: LoginValues) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export default function ConnectionCard({
  connection,
  selected,
  onSelect,
  onLoginChange,
  onConnect,
  onDisconnect,
}: ConnectionCardProps) {
  const connected = connection.status === 'connected';
  const connecting = connection.status === 'connecting';

  return (
    <article
      className={`overflow-hidden rounded-lg border bg-[#11151b] transition-colors ${
        selected ? 'border-blue-500/50' : 'border-white/10'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.03]"
      >
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
            connected ? 'bg-emerald-400' : connection.status === 'error' ? 'bg-amber-400' : 'bg-slate-600'
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-100">{connection.server.host}</span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            Port {connection.server.port}
            {connection.server.banner ? ` · ${connection.server.banner}` : ''}
          </span>
        </span>
        {selected ? (
          <ChevronDown className="mt-0.5 h-4 w-4 text-slate-500" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 text-slate-500" />
        )}
      </button>

      {selected && (
        <div className="space-y-3 border-t border-white/10 p-4">
          {connection.error && (
            <p className="rounded-md border border-amber-400/20 bg-amber-400/5 p-2.5 text-xs leading-5 text-amber-200">
              {connection.error}
            </p>
          )}

          {connected ? (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-300">Connected</span>
                <span className="max-w-[190px] truncate text-slate-500">{connection.path}</span>
              </div>
              <button
                type="button"
                onClick={onDisconnect}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
              >
                <Unplug className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </>
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={connection.anonymous}
                  onChange={(event) =>
                    onLoginChange({
                      anonymous: event.target.checked,
                      username: event.target.checked ? 'anonymous' : '',
                      password: event.target.checked ? '' : connection.password,
                    })
                  }
                  className="h-4 w-4 rounded border-white/10 bg-[#0b0d10]"
                />
                Connect anonymously
              </label>

              {!connection.anonymous && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <label className="space-y-1 text-xs text-slate-500">
                    <span>Username</span>
                    <input
                      type="text"
                      value={connection.username}
                      onChange={(event) =>
                        onLoginChange({
                          anonymous: false,
                          username: event.target.value,
                          password: connection.password,
                        })
                      }
                      className="w-full rounded-md border border-white/10 bg-[#0b0d10] px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-slate-500">
                    <span>Password</span>
                    <input
                      type="password"
                      value={connection.password}
                      onChange={(event) =>
                        onLoginChange({
                          anonymous: false,
                          username: connection.username,
                          password: event.target.value,
                        })
                      }
                      className="w-full rounded-md border border-white/10 bg-[#0b0d10] px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                    />
                  </label>
                </div>
              )}

              <button
                type="button"
                onClick={onConnect}
                disabled={connecting || (!connection.anonymous && !connection.username)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {connecting ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogIn className="h-3.5 w-3.5" />
                )}
                {connecting ? 'Connecting…' : 'Connect'}
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
