'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import { useEffect, useState } from 'react';
import { getEcho } from '@/lib/echo';
import { apiFetch, type Paginated, type Product } from '@/lib/api';

type LiveEvent = {
  id: number;
  name: string;
  price: number;
  stock: number;
  published: boolean;
  updated_at: string | null;
};

export default function DemoLivePage() {
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);

  const productsQuery = useQuery({
    queryKey: ['products', 'live'],
    queryFn: () => apiFetch<Paginated<Product>>('/products?include=category&published_only=0'),
    refetchInterval: connected ? false : 8000,
  });

  useEffect(() => {
    try {
      const echo = getEcho();
      const channel = echo.channel('demo');

      setConnected(true);

      channel.listen('.product.updated', (payload: LiveEvent) => {
        setEvents((prev) => [payload, ...prev].slice(0, 12));
        void queryClient.invalidateQueries({ queryKey: ['products'] });
      });

      return () => {
        echo.leave('demo');
      };
    } catch {
      setConnected(false);
    }
  }, [queryClient]);

  const products = productsQuery.data?.data ?? [];

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Live product updates</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Edit a product in Filament (`/admin/products`). With Reverb running, this page updates over
          WebSocket. Without Reverb, it falls back to polling every 8s.
        </p>
      </div>

      <Message
        severity={connected ? 'success' : 'warn'}
        text={
          connected
            ? 'Echo connected to Reverb channel `demo`.'
            : 'Echo not connected — using TanStack Query polling fallback.'
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold">Current products</h2>
          <ul className="grid gap-2 text-sm">
            {products.slice(0, 10).map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2 dark:border-zinc-800">
                <span>{product.name}</span>
                <span className="flex items-center gap-2">
                  <Tag value={`€${Number(product.price).toFixed(2)}`} />
                  <span className="text-zinc-500">stock {product.stock}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold">Recent events</h2>
          {events.length === 0 ? (
            <p className="text-sm text-zinc-500">No websocket events yet.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {events.map((event, index) => (
                <li key={`${event.id}-${event.updated_at}-${index}`} className="border-b border-zinc-100 py-2 dark:border-zinc-800">
                  <p className="font-medium">{event.name}</p>
                  <p className="text-zinc-500">
                    €{Number(event.price).toFixed(2)} · stock {event.stock} · {event.updated_at}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
