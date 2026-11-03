import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { playAlphabetAudio, stopAlphabetAudio } from '../../frontend/src/features/training/alphabet-audio.ts';

test('grid and training share versioned Flash playback; switching stops previous audio', async () => {
  const previousAudio = globalThis.Audio;
  const clips = [];
  class FakeAudio {
    constructor(src) { this.src = src; this.paused = false; this.played = false; clips.push(this); }
    async play() { this.played = true; }
    pause() { this.paused = true; }
  }
  globalThis.Audio = FakeAudio;
  try {
    await playAlphabetAudio('g-soft');
    assert.equal(clips[0].src, '/audio/grammar/alphabet/gemini38-20261013-aoede/g-soft.mp3');
    assert.equal(clips[0].played, true);
    await playAlphabetAudio('a-long');
    assert.equal(clips[0].paused, true);
    assert.equal(clips[0].src, '');
    assert.equal(clips[1].src, '/audio/grammar/alphabet/gemini38-20261013-aoede/a-long.mp3');
    await assert.rejects(playAlphabetAudio('../secret'), /Invalid letter/);
    assert.equal(clips.length, 2);
    stopAlphabetAudio();
    assert.equal(clips[1].paused, true);
    assert.equal(clips[1].src, '');
  } finally { stopAlphabetAudio(); globalThis.Audio = previousAudio; }
});

test('all 33 new names match canonical source and file hashes; old recordings remain intact', async () => {
  const source = JSON.parse(await readFile(new URL('../../resources/course/alphabet-letter-names.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(await readFile(new URL('../../frontend/public/audio/grammar/alphabet/gemini38-20261013-aoede/manifest.json', import.meta.url), 'utf8'));
  const previous = JSON.parse(await readFile(new URL('../../frontend/public/audio/grammar/alphabet/gemini38-20261013/manifest.json', import.meta.url), 'utf8'));
  const old = JSON.parse(await readFile(new URL('../../frontend/public/audio/grammar/alphabet/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.model, 'gemini-3.8-flash-tts');
  assert.equal(manifest.voice, 'Aoede');
  assert.equal(manifest.post_processing_speed, false);
  assert.equal(Object.keys(manifest.clips).length, 33);
  for (const item of source.items) {
    const clip = manifest.clips[item.key];
    assert.equal(clip.letter, item.letter);
    assert.equal(clip.name, item.name);
    assert.equal(clip.audio_url, `/audio/grammar/alphabet/gemini38-20261013-aoede/${item.key}.mp3`);
    const digest = bytes => createHash('sha256').update(bytes).digest('hex');
    assert.equal(digest(await readFile(new URL(`../../frontend/public${clip.audio_url}`, import.meta.url))), clip.file_sha256);
    assert.equal(digest(await readFile(new URL(`../../frontend/public${old.clips[item.key].audio_url}`, import.meta.url))), old.clips[item.key].file_sha256);
    assert.equal(digest(await readFile(new URL(`../../frontend/public${previous.clips[item.key].audio_url}`, import.meta.url))), previous.clips[item.key].file_sha256);
  }
});
