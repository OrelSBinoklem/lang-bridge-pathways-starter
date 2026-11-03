<?php

namespace App\Services;

use App\Models\DenseTrainingSession;
use App\Models\UserDictionaryWord;
use Illuminate\Support\Carbon;

class DenseTrainingService
{
    public const INTERVAL_SEC = 900;

    public function getState(int $userId, int $categoryId, bool $applyRotate = true): array
    {
        $session = $this->fetchSession($userId, $categoryId);
        if ($session && $applyRotate) {
            $session = $this->maybeRotate($session);
        }

        return $this->toState($session);
    }

    public function addWords(int $userId, int $dictionaryId, int $categoryId, array $wordIds, bool $useRandom = true): array
    {
        $session = $this->fetchSession($userId, $categoryId);
        $data = $session ? $this->sessionToArray($session) : [
            'id' => null,
            'user_id' => $userId,
            'dictionary_id' => $dictionaryId,
            'category_id' => $categoryId,
            'dense_word_ids_direct' => [],
            'dense_review_word_ids_direct' => [],
            'dense_word_ids_revert' => [],
            'dense_review_word_ids_revert' => [],
            'attempts_left' => 3,
            'waiting_since' => null,
            'use_random' => $useRandom,
        ];

        $ids = $this->normalizeIds($wordIds);
        if ($ids === []) {
            return $this->toState($session);
        }

        foreach ($ids as $wid) {
            $data['dense_word_ids_direct'] = $this->removeId($data['dense_word_ids_direct'], $wid);
            $data['dense_review_word_ids_direct'] = $this->removeId($data['dense_review_word_ids_direct'], $wid);
            $data['dense_word_ids_revert'] = $this->removeId($data['dense_word_ids_revert'], $wid);
            $data['dense_review_word_ids_revert'] = $this->removeId($data['dense_review_word_ids_revert'], $wid);
            $data['dense_word_ids_direct'][] = $wid;
            $data['dense_word_ids_revert'][] = $wid;
        }

        $data['dense_word_ids_direct'] = array_values(array_unique($data['dense_word_ids_direct']));
        $data['dense_word_ids_revert'] = array_values(array_unique($data['dense_word_ids_revert']));
        $data['attempts_left'] = 3;
        $data['waiting_since'] = null;
        $data['use_random'] = $useRandom;
        $data['dictionary_id'] = $dictionaryId;

        $this->saveSession($data);
        $this->setWordsRetrainingMode($userId, $ids);

        return $this->toState($this->fetchSession($userId, $categoryId));
    }

    public function removeWord(int $userId, int $categoryId, int $wordId): array
    {
        $session = $this->fetchSession($userId, $categoryId);
        if (! $session) {
            return $this->toState(null);
        }

        $data = $this->sessionToArray($session);
        foreach (['dense_word_ids_direct', 'dense_review_word_ids_direct', 'dense_word_ids_revert', 'dense_review_word_ids_revert'] as $key) {
            $data[$key] = $this->removeId($data[$key], $wordId);
        }

        if (
            $data['dense_word_ids_direct'] === []
            && $data['dense_review_word_ids_direct'] === []
            && $data['dense_word_ids_revert'] === []
            && $data['dense_review_word_ids_revert'] === []
        ) {
            return $this->clear($userId, $categoryId);
        }

        $this->saveSession($data);

        return $this->toState($this->fetchSession($userId, $categoryId));
    }

    public function clear(int $userId, int $categoryId): array
    {
        DenseTrainingSession::query()
            ->where('user_id', $userId)
            ->where('category_id', $categoryId)
            ->delete();

        return $this->toState(null);
    }

    public function tick(int $userId, int $categoryId): array
    {
        return $this->getState($userId, $categoryId, true);
    }

    public function submitAnswer(int $userId, int $categoryId, int $wordId, bool $isRevert, bool $isCorrect): array
    {
        $session = $this->fetchSession($userId, $categoryId);
        if (! $session) {
            return $this->toState(null);
        }

        $session = $this->maybeRotate($session);
        if (! $session) {
            return $this->toState(null);
        }

        $data = $this->sessionToArray($session);
        $directStart = $data['dense_word_ids_direct'];
        $directReview = $data['dense_review_word_ids_direct'];
        $revertStart = $data['dense_word_ids_revert'];
        $revertReview = $data['dense_review_word_ids_revert'];

        if ($isRevert) {
            if ($isCorrect) {
                $revertStart = $this->removeId($revertStart, $wordId);
                if (! in_array($wordId, $revertReview, true)) {
                    $revertReview[] = $wordId;
                }
            } else {
                $revertReview = $this->removeId($revertReview, $wordId);
                if (! in_array($wordId, $revertStart, true)) {
                    $revertStart[] = $wordId;
                }
            }
        } elseif ($isCorrect) {
            $directStart = $this->removeId($directStart, $wordId);
            if (! in_array($wordId, $directReview, true)) {
                $directReview[] = $wordId;
            }
        } else {
            $directReview = $this->removeId($directReview, $wordId);
            if (! in_array($wordId, $directStart, true)) {
                $directStart[] = $wordId;
            }
        }

        $data['dense_word_ids_direct'] = $directStart;
        $data['dense_review_word_ids_direct'] = $directReview;
        $data['dense_word_ids_revert'] = $revertStart;
        $data['dense_review_word_ids_revert'] = $revertReview;

        $directDone = $data['dense_word_ids_direct'] === [];
        $revertDone = $data['dense_word_ids_revert'] === [];
        $bothDone = $directDone && $revertDone
            && $data['dense_review_word_ids_direct'] !== []
            && $data['dense_review_word_ids_revert'] !== [];

        if ($data['attempts_left'] <= 1 && $directDone && $revertDone) {
            $data['attempts_left'] = 0;
            $data['dense_word_ids_direct'] = [];
            $data['dense_review_word_ids_direct'] = [];
            $data['dense_word_ids_revert'] = [];
            $data['dense_review_word_ids_revert'] = [];
            $data['waiting_since'] = null;
        } elseif ($bothDone && empty($data['waiting_since']) && $data['attempts_left'] > 1) {
            $data['attempts_left'] = max(0, $data['attempts_left'] - 1);
            $data['waiting_since'] = now('UTC');
        }

        $this->saveSession($data);

        return $this->toState($this->fetchSession($userId, $categoryId));
    }

    public function matchGameSuccess(int $userId, int $categoryId): array
    {
        $session = $this->fetchSession($userId, $categoryId);
        if (! $session || $session->attempts_left <= 0) {
            return $this->toState($session);
        }

        $data = $this->sessionToArray($session);
        if (! empty($data['waiting_since'])) {
            $remaining = $this->waitingRemaining($data['waiting_since']);
            if ($remaining > 0) {
                return $this->toState($session);
            }
        }

        if ($data['attempts_left'] <= 1) {
            return $this->clear($userId, $categoryId);
        }

        $data['dense_review_word_ids_direct'] = array_values(array_unique(array_merge(
            $data['dense_word_ids_direct'],
            $data['dense_review_word_ids_direct'],
        )));
        $data['dense_review_word_ids_revert'] = array_values(array_unique(array_merge(
            $data['dense_word_ids_revert'],
            $data['dense_review_word_ids_revert'],
        )));
        $data['dense_word_ids_direct'] = [];
        $data['dense_word_ids_revert'] = [];
        $data['attempts_left'] = max(0, $data['attempts_left'] - 1);
        $data['waiting_since'] = now('UTC');
        $this->saveSession($data);

        return $this->toState($this->fetchSession($userId, $categoryId));
    }

    private function fetchSession(int $userId, int $categoryId): ?DenseTrainingSession
    {
        return DenseTrainingSession::query()
            ->where('user_id', $userId)
            ->where('category_id', $categoryId)
            ->first();
    }

    /** @return array<string, mixed> */
    private function sessionToArray(DenseTrainingSession $session): array
    {
        return [
            'id' => $session->id,
            'user_id' => $session->user_id,
            'dictionary_id' => $session->dictionary_id,
            'category_id' => $session->category_id,
            'dense_word_ids_direct' => $session->decodeIds($session->dense_word_ids_direct),
            'dense_review_word_ids_direct' => $session->decodeIds($session->dense_review_word_ids_direct),
            'dense_word_ids_revert' => $session->decodeIds($session->dense_word_ids_revert),
            'dense_review_word_ids_revert' => $session->decodeIds($session->dense_review_word_ids_revert),
            'attempts_left' => (int) $session->attempts_left,
            'waiting_since' => $session->waiting_since,
            'use_random' => (bool) $session->use_random,
        ];
    }

    /** @param array<string, mixed> $data */
    private function saveSession(array $data): void
    {
        $payload = [
            'user_id' => $data['user_id'],
            'dictionary_id' => $data['dictionary_id'],
            'category_id' => $data['category_id'],
            'dense_word_ids_direct' => json_encode(array_values($data['dense_word_ids_direct'])),
            'dense_review_word_ids_direct' => json_encode(array_values($data['dense_review_word_ids_direct'])),
            'dense_word_ids_revert' => json_encode(array_values($data['dense_word_ids_revert'])),
            'dense_review_word_ids_revert' => json_encode(array_values($data['dense_review_word_ids_revert'])),
            'attempts_left' => max(0, (int) $data['attempts_left']),
            'waiting_since' => $data['waiting_since'],
            'use_random' => (bool) $data['use_random'],
        ];

        if (! empty($data['id'])) {
            DenseTrainingSession::query()->where('id', $data['id'])->update($payload);
        } else {
            DenseTrainingSession::query()->create($payload);
        }
    }

    private function maybeRotate(?DenseTrainingSession $session): ?DenseTrainingSession
    {
        if (! $session) {
            return null;
        }

        $data = $this->sessionToArray($session);
        $changed = false;

        $directDone = $data['dense_word_ids_direct'] === [];
        $revertDone = $data['dense_word_ids_revert'] === [];
        $bothDone = $directDone && $revertDone
            && $data['dense_review_word_ids_direct'] !== []
            && $data['dense_review_word_ids_revert'] !== [];

        if ($bothDone && empty($data['waiting_since']) && $data['attempts_left'] > 1) {
            $data['attempts_left'] = max(0, $data['attempts_left'] - 1);
            $data['waiting_since'] = now('UTC');
            $changed = true;
        }

        if (! empty($data['waiting_since']) && $this->waitingRemaining($data['waiting_since']) === 0) {
            if ($data['attempts_left'] <= 0) {
                $data['attempts_left'] = 0;
                $data['dense_word_ids_direct'] = [];
                $data['dense_review_word_ids_direct'] = [];
                $data['dense_word_ids_revert'] = [];
                $data['dense_review_word_ids_revert'] = [];
                $data['waiting_since'] = null;
            } else {
                $data['dense_word_ids_direct'] = $data['dense_review_word_ids_direct'];
                $data['dense_review_word_ids_direct'] = [];
                $data['dense_word_ids_revert'] = $data['dense_review_word_ids_revert'];
                $data['dense_review_word_ids_revert'] = [];
                $data['waiting_since'] = null;
            }
            $changed = true;
        }

        if ($changed) {
            $this->saveSession($data);
        }

        return $this->fetchSession((int) $data['user_id'], (int) $data['category_id']);
    }

    private function toState(?DenseTrainingSession $session): array
    {
        if (! $session) {
            return [
                'exists' => false,
                'attempts_left' => 0,
                'waiting_since' => null,
                'waiting_remaining_sec' => 0,
                'use_random' => 1,
                'dense_word_ids_direct' => [],
                'dense_review_word_ids_direct' => [],
                'dense_word_ids_revert' => [],
                'dense_review_word_ids_revert' => [],
                'active_word_ids' => [],
            ];
        }

        $direct = $session->decodeIds($session->dense_word_ids_direct);
        $reviewDirect = $session->decodeIds($session->dense_review_word_ids_direct);
        $revert = $session->decodeIds($session->dense_word_ids_revert);
        $reviewRevert = $session->decodeIds($session->dense_review_word_ids_revert);

        $waitingSince = $session->waiting_since;

        return [
            'exists' => true,
            'attempts_left' => (int) $session->attempts_left,
            // nullsafe на всём chain: optional()?->utc()->format ломался, когда utc() возвращал null
            'waiting_since' => $waitingSince instanceof Carbon
                ? $waitingSince->clone()->utc()->format('Y-m-d H:i:s')
                : ($waitingSince
                    ? Carbon::parse((string) $waitingSince, 'UTC')->format('Y-m-d H:i:s')
                    : null),
            'waiting_remaining_sec' => $this->waitingRemaining($waitingSince),
            'use_random' => $session->use_random ? 1 : 0,
            'dense_word_ids_direct' => $direct,
            'dense_review_word_ids_direct' => $reviewDirect,
            'dense_word_ids_revert' => $revert,
            'dense_review_word_ids_revert' => $reviewRevert,
            'active_word_ids' => array_values(array_unique(array_merge($direct, $reviewDirect, $revert, $reviewRevert))),
        ];
    }

    private function waitingRemaining(mixed $waitingSince): int
    {
        if (! $waitingSince) {
            return 0;
        }

        $ts = $waitingSince instanceof Carbon
            ? $waitingSince->utc()->getTimestamp()
            : Carbon::parse((string) $waitingSince, 'UTC')->getTimestamp();

        return max(0, self::INTERVAL_SEC - (time() - $ts));
    }

    /** @param list<int|string> $ids
     *  @return list<int> */
    private function normalizeIds(array $ids): array
    {
        return array_values(array_unique(array_filter(array_map('intval', $ids), fn ($v) => $v > 0)));
    }

    /** @param list<int> $arr
     *  @return list<int> */
    private function removeId(array $arr, int $wordId): array
    {
        return array_values(array_filter($arr, fn ($id) => (int) $id !== $wordId));
    }

    /** @param list<int> $wordIds */
    private function setWordsRetrainingMode(int $userId, array $wordIds): void
    {
        foreach ($wordIds as $wordId) {
            $row = UserDictionaryWord::query()->firstOrNew([
                'user_id' => $userId,
                'dict_word_id' => $wordId,
            ]);

            $row->mode_education = true;
            $row->mode_education_revert = true;
            $row->last_shown = null;
            $row->last_shown_revert = null;
            $row->save();
        }
    }
}
