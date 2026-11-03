import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';

/** Same-origin helper: expose Sanctum PAT for Training WS (cookie is httpOnly). */
export async function GET() {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }

  return NextResponse.json(
    { token },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
