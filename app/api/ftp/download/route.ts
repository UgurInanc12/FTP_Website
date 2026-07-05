import { NextRequest, NextResponse } from 'next/server';
import { ftpDownloadRequestSchema } from '@/lib/validation';
import { streamFtpDownload } from '@/lib/ftp';
import { isCloudEnvironment, isLocalLanIp } from '@/lib/ip';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate request schema
    const parseResult = ftpDownloadRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Invalid FTP download parameters' },
        { status: 400 }
      );
    }

    const { host, port, username, password, remotePath } = parseResult.data;

    // Extract filename from path (e.g. "/DCIM/Camera/photo.jpg" -> "photo.jpg")
    const filename = remotePath.split('/').filter(Boolean).pop() || 'downloaded_file';

    // Get readable stream
    const ftpStream = await streamFtpDownload(
      {
        host,
        port,
        username,
        password,
        timeoutMs: 15000, // 15s timeout for file transfer setup
      },
      remotePath
    );

    // Create NextResponse with the raw stream
    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    headers.set('Content-Type', 'application/octet-stream');

    return new NextResponse(ftpStream as any, {
      headers,
    });
  } catch (error: any) {
    let errorMessage = error.message || 'Failed to download file';
    
    // Check if we are running in the cloud and connecting to a private LAN IP
    const hostHeader = req.headers.get('host');
    
    // Fallback: extract host from body safely
    let targetHost = '';
    try {
      const clonedReq = req.clone();
      const body = await clonedReq.json();
      targetHost = body.host || '';
    } catch {
      // Ignore
    }

    if (targetHost && isLocalLanIp(targetHost) && isCloudEnvironment(hostHeader)) {
      errorMessage = `Cloud Sandbox Limitation: The cloud server cannot reach your phone's local network IP address (${targetHost}) because private addresses are not routable over the public internet. To download this file successfully, please click the settings/export menu in the top right, download this project as a ZIP, and run it locally on your computer with 'npm install && npm run dev'.`;
    } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
      errorMessage = 'Download connection timed out. Ensure the FTP server is active.';
    } else if (errorMessage.includes('550') || errorMessage.toLowerCase().includes('not found')) {
      errorMessage = 'File not found or access denied on FTP server.';
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
