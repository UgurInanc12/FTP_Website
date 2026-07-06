import { NextRequest, NextResponse } from 'next/server';
import { getFtpFileSize, streamFtpMedia } from '@/lib/ftp';
import { normalizeFtpPath } from '@/lib/ftp-path';
import { getFtpSession } from '@/lib/ftp-sessions';
import { getMimeType, getSafeFilename } from '@/lib/media';

export const runtime = 'nodejs';

export async function HEAD(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  return handleMedia(req, context, true);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  return handleMedia(req, context, false);
}

async function handleMedia(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
  headOnly: boolean
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
    const filename = getSafeFilename(remotePath);
    const disposition = req.nextUrl.searchParams.get('download') === '1'
      ? `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      : `inline; filename*=UTF-8''${encodeURIComponent(filename)}`;

    const commonHeaders = {
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-store',
      'Content-Type': getMimeType(filename),
      'Content-Disposition': disposition,
      'X-Content-Type-Options': 'nosniff',
    };

    if (headOnly) {
      const size = await getFtpFileSize(session.config, remotePath);
      return new NextResponse(null, {
        headers: { ...commonHeaders, 'Content-Length': String(size) },
      });
    }

    const rangeHeader = req.headers.get('range');
    if (!rangeHeader) {
      const media = await streamFtpMedia(
        { ...session.config, timeoutMs: 60000 },
        remotePath
      );
      return new NextResponse(media.stream as any, {
        headers: { ...commonHeaders, 'Content-Length': String(media.size) },
      });
    }

    const requested = parseRange(rangeHeader);
    if (!requested) {
      return new NextResponse(null, {
        status: 416,
        headers: commonHeaders,
      });
    }

    const size = await getFtpFileSize(session.config, remotePath);
    const start = requested.suffixLength !== undefined
      ? Math.max(0, size - requested.suffixLength)
      : requested.start ?? 0;
    const end = Math.min(requested.end ?? size - 1, size - 1);
    if (start >= size || end < start) {
      return new NextResponse(null, {
        status: 416,
        headers: { ...commonHeaders, 'Content-Range': `bytes */${size}` },
      });
    }

    const length = end - start + 1;
    const media = await streamFtpMedia(
      { ...session.config, timeoutMs: 60000 },
      remotePath,
      start,
      length
    );
    return new NextResponse(media.stream as any, {
      status: 206,
      headers: {
        ...commonHeaders,
        'Content-Length': String(length),
        'Content-Range': `bytes ${start}-${end}/${size}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not stream file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseRange(
  value: string
): { start?: number; end?: number; suffixLength?: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match) return null;
  if (!match[1] && !match[2]) return null;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    return Number.isSafeInteger(suffixLength) && suffixLength > 0
      ? { suffixLength }
      : null;
  }

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : undefined;
  if (!Number.isSafeInteger(start) || (end !== undefined && !Number.isSafeInteger(end))) {
    return null;
  }
  return { start, end };
}
