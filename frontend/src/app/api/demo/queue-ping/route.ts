import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';

export async function POST(request: Request) {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ message: 'Login required' }, { status: 401 });
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const data = await apiFetch('/demo/queue-ping', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    });

    return NextResponse.json(data, { status: 202 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { message: error.message, errors: error.errors },
        { status: error.status },
      );
    }

    return NextResponse.json({ message: 'Unable to queue job' }, { status: 500 });
  }
}
