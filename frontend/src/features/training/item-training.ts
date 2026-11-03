export type TrainingDirection = 'direct' | 'reverse';
export type TrainingSide = {
  prompt: string;
  choices: string[];
  available: boolean;
  mode_education: boolean;
  correct_attempts: number;
  next_review_at: string | null;
};
export type TrainingItem = {
  key: string;
  prompt: string;
  display_letter: string | null;
  display_hint: string | null;
  choices: string[];
  direction: TrainingDirection | null;
  available: boolean;
  mode_education: boolean;
  direct_correct: boolean;
  reverse_correct: boolean;
  steps: number;
  completed: boolean;
  next_review_at: string | null;
  directions: Record<TrainingDirection, TrainingSide>;
};
export type ItemQueueEntry = { key: string; direction: TrainingDirection };

export function buildItemTrainingQueue(items: TrainingItem[], practice = false, random = Math.random): ItemQueueEntry[] {
  return (['direct', 'reverse'] as const).flatMap(direction => {
    const entries = items.filter(item => practice || item.directions[direction].available)
      .map(item => ({ key: item.key, direction }));
    for (let index = entries.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [entries[index], entries[other]] = [entries[other], entries[index]];
    }
    return entries;
  });
}
