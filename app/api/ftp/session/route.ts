import { NextRequest, NextResponse } from 'next/server';
import { listFtpDirectory } from '@/lib/ftp';
import { normalizeFtpPath } from '@/lib/ftp-path';
import { createFtpSession } from '@/lib/ftp-sessions';
import { ftpSessionRequestSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const parsed = ftpSessionRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid FTP connection request' },
        { status: 400 }
      );
    }

    const { host, port, username, password } = parsed.data;
    const requestedPath = normalizeFtpPath(parsed.data.path);
    const config = { host, port, username, password, timeoutMs: 60000 };

    let path = requestedPath;
    let pathRestored = true;
    let items;

    try {
      items = await listFtpDirectory(config, requestedPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (requestedPath === '/' || !isMissingPathError(message)) {
        throw error;
      }
      path = '/';
      pathRestored = false;
      items = await listFtpDirectory(config, '/');
    }

    const session = createFtpSession(config);
    return NextResponse.json({
      sessionId: session.id,
      path,
      pathRestored,
      items,
    });
  } catch (error) {
    return ftpErrorResponse(error);
  }
}

function isMissingPathError(message: string) {
  const lower = message.toLowerCase();
  return (
    message.includes('450') ||
    message.includes('550') ||
    lower.includes('not found') ||
    lower.includes('no such') ||
    lower.includes("couldn't list")
  );
}

function ftpErrorResponse(error: unknown) {
  const raw = error instanceof Error ? error.message : 'FTP connection failed';
  let message = raw;
  let status = 500;

  if (/invalid ftp path|path traversal/i.test(raw)) {
    message = 'Invalid FTP path.';
    status = 400;
  } else if (raw.includes('530') || raw.toLowerCase().includes('login')) {
    message = 'Login failed. Check the username, password, or anonymous access setting.';
    status = 401;
  } else if (/timeout/i.test(raw)) {
    message = 'Connection timed out after 60 seconds.';
    status = 504;
  } else if (raw.includes('ECONNREFUSED')) {
    message = 'Connection refused. Check that the FTP server is running.';
    status = 502;
  }

  return NextResponse.json({ error: message }, { status });
}
