'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';

type QueueStatus = {
  connection: string;
  pending_jobs: number;
  failed_jobs: number;
  last_result: {
    requested_by: string;
    message: string;
    processed_at: string;
  } | null;
};

export default function DemoQueuePage() {
  const [message, setMessage] = useState('Hello from Next demo');
  const [authError, setAuthError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['queue-status'],
    queryFn: () => apiFetch<QueueStatus>('/demo/queue-status'),
    refetchInterval: 3000,
  });

  const pingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/demo/queue-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.message ?? 'Login required to queue jobs');
      }

      return body;
    },
    onSuccess: async () => {
      setAuthError(null);
      await queryClient.invalidateQueries({ queryKey: ['queue-status'] });
    },
    onError: (error: Error) => setAuthError(error.message),
  });

  const status = statusQuery.data;

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Queue demo</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Horizon is Linux-only. On Windows/OSPanel we use `php artisan queue:work`. Sign in first,
          then enqueue a job and watch pending count drop when the worker runs.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="grid gap-2 text-sm">
          <span>Message</span>
          <InputText value={message} onChange={(e) => setMessage(e.target.value)} className="w-full" />
        </label>
        <Button
          label="Queue ProcessDemoReport"
          icon="pi pi-send"
          loading={pingMutation.isPending}
          onClick={() => pingMutation.mutate()}
        />
        {authError && <Message severity="error" text={authError} />}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p>
          Connection: <strong>{status?.connection ?? '…'}</strong>
        </p>
        <p>Pending jobs: {status?.pending_jobs ?? '…'}</p>
        <p>Failed jobs: {status?.failed_jobs ?? '…'}</p>
        {status?.last_result ? (
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Last result: {status.last_result.message} by {status.last_result.requested_by} at{' '}
            {status.last_result.processed_at}
          </p>
        ) : (
          <p className="mt-2 text-zinc-500">No processed result in cache yet.</p>
        )}
      </div>
    </section>
  );
}
