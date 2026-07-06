import { NextRequest, NextResponse } from 'next/server';
import { deleteFtpSession } from '@/lib/ftp-sessions';

export const runtime = 'nodejs';

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const deleted = deleteFtpSession(id);
  return NextResponse.json({ deleted });
}
