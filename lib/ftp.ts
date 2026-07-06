import * as ftp from 'basic-ftp';
import { Readable, PassThrough, Transform, TransformCallback } from 'stream';
import { FtpItem } from '@/types/ftp';

export interface FtpConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  timeoutMs?: number;
}

/**
 * Cleanly list directory items from a remote FTP server.
 */
export async function listFtpDirectory(config: FtpConfig, path: string): Promise<FtpItem[]> {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  
  // Set explicit connection timeout
  (client.ftp as any).timeout = config.timeoutMs || 5000;

  try {
    await client.access({
      host: config.host,
      port: config.port,
      user: config.username || 'anonymous',
      password: config.password || '',
      secure: false,
    });

    const list = await client.list(path);

    // Map basic-ftp FileInfo objects to our custom FtpItem interface
    return list.map((item) => {
      let type: 'directory' | 'file' | 'link' = 'file';
      if (item.isDirectory) {
        type = 'directory';
      } else if (item.isSymbolicLink) {
        type = 'link';
      }

      return {
        name: item.name,
        type,
        size: item.size,
        modifiedAt: resolveItemDate(item.name, item.modifiedAt, item.rawModifiedAt),
      };
    });
  } finally {
    client.close();
  }
}

/**
 * Returns a readable pass-through stream of the requested remote file,
 * closing the FTP client when streaming completes or errors.
 */
export async function streamFtpDownload(config: FtpConfig, remotePath: string): Promise<Readable> {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  (client.ftp as any).timeout = config.timeoutMs || 10000; // Longer timeout for downloads

  await client.access({
    host: config.host,
    port: config.port,
    user: config.username || 'anonymous',
    password: config.password || '',
    secure: false,
  });

  const passthrough = new PassThrough();

  // Run download asynchronously and pipe into passthrough
  client.downloadTo(passthrough, remotePath)
    .then(() => {
      passthrough.end();
    })
    .catch((err) => {
      passthrough.destroy(err);
    })
    .finally(() => {
      client.close();
    });

  return passthrough;
}

export interface FtpMediaStream {
  stream: Readable;
  size: number;
}

/**
 * Streams a file from an optional byte offset and stops after length bytes.
 * The FTP connection is closed as soon as the requested range is complete.
 */
export async function streamFtpMedia(
  config: FtpConfig,
  remotePath: string,
  startAt = 0,
  length?: number
): Promise<FtpMediaStream> {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  (client.ftp as any).timeout = config.timeoutMs || 60000;

  await client.access({
    host: config.host,
    port: config.port,
    user: config.username || 'anonymous',
    password: config.password || '',
    secure: false,
  });

  const { directory, name } = splitRemotePath(remotePath);
  if (directory !== '/') {
    await client.cd(directory);
  }
  const size = await client.size(name);
  const available = Math.max(0, size - startAt);
  const requestedLength = length === undefined ? available : Math.min(length, available);
  if (requestedLength === 0) {
    client.close();
    return { stream: Readable.from([]), size };
  }
  let intentionalClose = false;
  let supportsRestart = startAt === 0;
  if (startAt > 0) {
    try {
      const features = await client.features();
      supportsRestart = features.has('REST STREAM') || features.has('REST');
    } catch {
      supportsRestart = false;
    }
  }

  const limiter = new ByteLimitTransform(
    supportsRestart ? 0 : startAt,
    requestedLength,
    () => {
    intentionalClose = true;
    client.close();
    }
  );

  client.downloadTo(limiter, name, supportsRestart ? startAt : 0)
    .then(() => limiter.end())
    .catch((error) => {
      if (!intentionalClose) {
        limiter.destroy(error);
      }
    })
    .finally(() => client.close());

  return { stream: limiter, size };
}

export async function getFtpFileSize(config: FtpConfig, remotePath: string): Promise<number> {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  (client.ftp as any).timeout = config.timeoutMs || 15000;

  try {
    await client.access({
      host: config.host,
      port: config.port,
      user: config.username || 'anonymous',
      password: config.password || '',
      secure: false,
    });
    const { directory, name } = splitRemotePath(remotePath);
    if (directory !== '/') {
      await client.cd(directory);
    }
    return await client.size(name);
  } finally {
    client.close();
  }
}

class ByteLimitTransform extends Transform {
  private skipRemaining: number;
  private remaining: number;
  private completed = false;

  constructor(skip: number, length: number, private readonly onComplete: () => void) {
    super();
    this.skipRemaining = skip;
    this.remaining = length;
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
    if (this.completed) {
      callback();
      return;
    }

    if (this.skipRemaining >= chunk.length) {
      this.skipRemaining -= chunk.length;
      callback();
      return;
    }

    const start = this.skipRemaining;
    this.skipRemaining = 0;
    const output = chunk.subarray(start, start + this.remaining);
    this.remaining -= output.length;
    if (output.length > 0) {
      this.push(output);
    }

    if (this.remaining <= 0) {
      this.completed = true;
      this.push(null);
      this.onComplete();
    }

    callback();
  }
}

function splitRemotePath(remotePath: string) {
  const segments = remotePath.split('/').filter(Boolean);
  const name = segments.pop();
  if (!name) throw new Error('File path is required');
  return {
    directory: segments.length > 0 ? `/${segments.join('/')}` : '/',
    name,
  };
}

function resolveItemDate(
  name: string,
  modifiedAt?: Date,
  rawModifiedAt?: string
): string | null {
  if (modifiedAt instanceof Date && !Number.isNaN(modifiedAt.getTime())) {
    return modifiedAt.toISOString();
  }

  // Xiaomi camera files preserve their capture timestamp in the filename.
  const filenameDate = /(?:^|[_-])((?:19|20)\d{2})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/.exec(name);
  if (filenameDate) {
    const [, year, month, day, hour, minute, second] = filenameDate;
    const timestamp = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
    if (!Number.isNaN(timestamp)) return new Date(timestamp).toISOString();
  }

  if (!rawModifiedAt) return null;
  const withYear = /^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})$/.exec(rawModifiedAt.trim());
  if (withYear) {
    const timestamp = Date.parse(`${withYear[1]} ${withYear[2]}, ${withYear[3]} UTC`);
    return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
  }

  // Standard FTP LIST omits the year for recent files. Pick the nearest
  // non-future occurrence; this is necessarily approximate for older servers.
  const recent = /^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{1,2}):(\d{2})$/.exec(rawModifiedAt.trim());
  if (recent) {
    const now = new Date();
    let timestamp = Date.parse(
      `${recent[1]} ${recent[2]}, ${now.getUTCFullYear()} ${recent[3]}:${recent[4]} UTC`
    );
    if (timestamp > now.getTime() + 24 * 60 * 60 * 1000) {
      timestamp = Date.parse(
        `${recent[1]} ${recent[2]}, ${now.getUTCFullYear() - 1} ${recent[3]}:${recent[4]} UTC`
      );
    }
    return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
  }

  return null;
}
