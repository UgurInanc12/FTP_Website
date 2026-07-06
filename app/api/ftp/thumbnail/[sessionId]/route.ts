import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { streamFtpDownload } from '@/lib/ftp';
import { normalizeFtpPath } from '@/lib/ftp-path';
import { getFtpSession } from '@/lib/ftp-sessions';

export const runtime = 'nodejs';

const CACHE_LIMIT_BYTES = 512 * 1024 * 1024;
const ALLOWED_WIDTHS = new Set([160, 240, 360]);
const cacheDirectory = path.join(process.cwd(), '.cache', 'ftp-thumbnails');

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const session = getFtpSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'FTP session expired.' }, { status: 401 });
    }

    const pathParam = req.nextUrl.searchParams.get('path');
    if (!pathParam) {
      return NextResponse.json({ error: 'File path is required.' }, { status: 400 });
    }
    const remotePath = normalizeFtpPath(pathParam);
    const requestedWidth = Number(req.nextUrl.searchParams.get('width') || 240);
    const width = ALLOWED_WIDTHS.has(requestedWidth) ? requestedWidth : 240;
    const modifiedAt = req.nextUrl.searchParams.get('modifiedAt') || '';
    const key = createHash('sha256')
      .update(`${session.config.host}:${session.config.port}\0${remotePath}\0${modifiedAt}\0${width}`)
      .digest('hex');

    await fs.mkdir(cacheDirectory, { recursive: true });
    const cachedPath = path.join(cacheDirectory, `${key}.webp`);
    const cached = await readCachedFile(cachedPath);
    if (cached) {
      void touchFile(cachedPath);
      return thumbnailResponse(cached, 'public, max-age=86400, immutable');
    }

    const source = await streamFtpDownload(
      { ...session.config, timeoutMs: 60000 },
      remotePath
    );
    const transformer = sharp()
      .rotate()
      .resize({ width, height: Math.round(width * 0.75), fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 76 });
    source.pipe(transformer);
    const thumbnail = await transformer.toBuffer();

    await fs.writeFile(cachedPath, thumbnail);
    void trimCache();
    return thumbnailResponse(thumbnail, 'public, max-age=86400, immutable');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create thumbnail';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

function thumbnailResponse(data: Buffer, cacheControl: string) {
  return new NextResponse(data as any, {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(data.length),
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function readCachedFile(filePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

async function touchFile(filePath: string) {
  try {
    const now = new Date();
    await fs.utimes(filePath, now, now);
  } catch {
    // Cache maintenance must not fail the request.
  }
}

async function trimCache() {
  try {
    const names = await fs.readdir(cacheDirectory);
    const entries = await Promise.all(
      names.map(async (name) => {
        const filePath = path.join(cacheDirectory, name);
        const stat = await fs.stat(filePath);
        return { filePath, size: stat.size, touchedAt: stat.mtimeMs };
      })
    );
    let total = entries.reduce((sum, entry) => sum + entry.size, 0);
    if (total <= CACHE_LIMIT_BYTES) return;

    entries.sort((a, b) => a.touchedAt - b.touchedAt);
    for (const entry of entries) {
      await fs.unlink(entry.filePath);
      total -= entry.size;
      if (total <= CACHE_LIMIT_BYTES) break;
    }
  } catch {
    // Cache cleanup is best effort.
  }
}
