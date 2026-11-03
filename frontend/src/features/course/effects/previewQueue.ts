/** Preview warm-ups are bounded independently of the number of cards in the gallery. */
export function createPreviewQueue(limit = 2) {
  const jobs: { start: (done: () => void) => void; cancelled: boolean; done?: () => void }[] = [];
  let active = 0;
  const pump = () => {
    while (active < limit && jobs.length) {
      const job = jobs.shift()!;
      if (job.cancelled) continue;
      active++;
      let finished = false;
      job.done = () => {
        if (finished) return;
        finished = true;
        active--;
        pump();
      };
      job.start(job.done);
    }
  };
  return (start: (done: () => void) => void) => {
    const job = { start, cancelled: false, done: undefined as (() => void) | undefined };
    jobs.push(job);
    pump();
    return () => { job.cancelled = true; job.done?.(); };
  };
}
