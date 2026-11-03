export class TutorReconnect {
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  schedule(reconnect: () => void) {
    if (this.timer !== null) return;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.attempt++, 5));
    this.timer = setTimeout(() => {
      this.timer = null;
      reconnect();
    }, delay);
  }

  cancel() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  ready() {
    this.cancel();
    this.attempt = 0;
  }
}
