import { NextRequest, NextResponse } from 'next/server';
import { scanRequestSchema } from '@/lib/validation';
import { scanSubnet } from '@/lib/scanner';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request schema
    const parseResult = scanRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Invalid scan request' },
        { status: 400 }
      );
    }

    const { cidr, ports } = parseResult.data;

    // Scan subnet for open ports
    const scanResults = await scanSubnet(cidr, ports, 200, 1000);

    return NextResponse.json({ results: scanResults });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Subnet scan failed: ' + error.message },
      { status: 500 }
    );
  }
}
