import * as ftp from 'basic-ftp';
import { Readable, PassThrough } from 'stream';
import { FtpItem } from '@/types/ftp';

interface FtpConfig {
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

      let modifiedStr = new Date().toISOString();
      if (item.modifiedAt) {
        if (item.modifiedAt instanceof Date) {
          modifiedStr = item.modifiedAt.toISOString();
        } else {
          modifiedStr = String(item.modifiedAt);
        }
      }

      return {
        name: item.name,
        type,
        size: item.size,
        modifiedAt: modifiedStr,
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
