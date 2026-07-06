import { NextRequest, NextResponse } from 'next/server';
import { listFtpDirectory } from '@/lib/ftp';
import { normalizeFtpPath } from '@/lib/ftp-path';
import { getFtpSession } from '@/lib/ftp-sessions';
import { ftpSessionListRequestSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const parsed = ftpSessionListRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid directory request' },
        { status: 400 }
      );
    }

    const session = getFtpSession(parsed.data.sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'FTP session expired. Connect again.', code: 'SESSION_EXPIRED' },
        { status: 401 }
      );
    }

    const path = normalizeFtpPath(parsed.data.path);
    const items = await listFtpDirectory(
      { ...session.config, timeoutMs: 60000 },
      path
    );
    return NextResponse.json({ path, items });
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'Could not list directory';
    let message = raw;
    let status = 500;
    if (/invalid ftp path|path traversal/i.test(raw)) {
      message = 'Invalid FTP path.';
      status = 400;
    } else if (/timeout/i.test(raw)) {
      message = 'Directory listing timed out after 60 seconds.';
      status = 504;
    } else if (raw.includes('550') || /not found|no such/i.test(raw)) {
      message = 'Folder not found or access denied.';
      status = 404;
    }
    return NextResponse.json({ error: message }, { status });
  }
}
