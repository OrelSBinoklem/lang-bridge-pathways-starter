import type { Metadata } from 'next';
import { apiFetch, type DemoDashboard } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';

export const metadata: Metadata = { title: 'Demo dashboard' };

export default async function DemoPage() {
  const token = await getAuthToken();
  const data = await apiFetch<DemoDashboard>('/demo/dashboard', { token });

  return (
    <section className="grid gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Aggregate demo dashboard</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          One `GET /api/demo/dashboard` call — stats, products, posts, queue snapshot.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(data.stats).map(([key, value]) => (
          <div
            key={key}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-sm text-zinc-500">{key.replaceAll('_', ' ')}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold">Latest products</h2>
          <ul className="grid gap-2 text-sm">
            {data.latest_products.map((product) => (
              <li key={product.id} className="flex justify-between gap-3 border-b border-zinc-100 py-2 dark:border-zinc-800">
                <span>{product.name}</span>
                <span className="text-zinc-500">€{product.price.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold">Latest posts</h2>
          <ul className="grid gap-2 text-sm">
            {data.latest_posts.map((post) => (
              <li key={post.id} className="border-b border-zinc-100 py-2 dark:border-zinc-800">
                <p className="font-medium">{post.title}</p>
                <p className="text-zinc-500">{post.excerpt}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
        Queue: <strong>{data.queue.connection}</strong> · pending {data.queue.pending_jobs} · failed{' '}
        {data.queue.failed_jobs}
        {data.queue.last_result && (
          <span>
            {' '}
            · last: {data.queue.last_result.message} at {data.queue.last_result.processed_at}
          </span>
        )}
      </div>
    </section>
  );
}
