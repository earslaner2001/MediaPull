const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./format-state');

test('default state resolves to free 1080p H.264', () => {
  const state = F.createFormatState();
  const format = F.resolveFormat(state);
  assert.equal(format.id, 'yt-1080-avc1');
  assert.equal(format.pro, false);
  assert.equal(F.isCardActive(state, 'mp4'), true);
  assert.equal(F.isCardActive(state, '1080p'), true);
});

test('4K card selects pro H.264 and unlocks only for Pro', () => {
  const state = F.selectCard(F.createFormatState(), '4k');
  const format = F.resolveFormat(state);
  assert.equal(format.id, 'yt-4k-avc1');
  assert.equal(format.pro, true);
  assert.equal(F.isCardActive(state, '4k'), true);
  assert.equal(F.isCardLocked(state, '4k', false), true);
  assert.equal(F.isCardLocked(state, '4k', true), false);
});

test('ProRes card maps to yt-prores', () => {
  const state = F.selectCard(F.createFormatState(), 'prores');
  assert.equal(F.resolveFormat(state).id, 'yt-prores');
  assert.equal(F.isCardActive(state, 'prores'), true);
});

test('audio card defaults to MP3 and can switch to WAV', () => {
  const mp3 = F.selectCard(F.createFormatState(), 'audio');
  assert.equal(F.resolveFormat(mp3).id, 'bestaudio');
  const wav = F.selectCard(mp3, 'wav');
  assert.equal(F.resolveFormat(wav).id, 'yt-wav');
  assert.equal(F.resolveFormat(wav).pro, true);
});

test('resolution cards leave audio mode', () => {
  const audio = F.selectCard(F.createFormatState(), 'audio');
  const back = F.selectCard(audio, '4k');
  assert.equal(back.kind, F.KIND.MP4);
  assert.equal(F.resolveFormat(back).id, 'yt-4k-avc1');
});

test('1080p and 4K leave ProRes instead of staying stuck', () => {
  const prores = F.selectCard(F.createFormatState(), 'prores');
  const hd = F.selectCard(prores, '1080p');
  assert.equal(hd.kind, F.KIND.MP4);
  assert.equal(F.resolveFormat(hd).id, 'yt-1080-avc1');
  assert.equal(F.isCardActive(hd, 'prores'), false);
  assert.equal(F.isCardActive(hd, '1080p'), true);

  const uhd = F.selectCard(prores, '4k');
  assert.equal(F.resolveFormat(uhd).id, 'yt-4k-avc1');
  assert.equal(F.isCardActive(uhd, '4k'), true);
  assert.equal(F.isCardActive(prores, '1080p'), false);
});

test('MP3 card always selects MP3 even if WAV was leftover', () => {
  const wav = F.selectCard(F.createFormatState(), 'wav');
  const mp3 = F.selectCard(wav, 'mp3');
  assert.equal(F.resolveFormat(mp3).id, 'bestaudio');
  assert.equal(F.isCardActive(mp3, 'mp3'), true);
  assert.equal(F.isCardActive(mp3, 'wav'), false);
});

test('URL detectors accept YouTube and X only', () => {
  assert.equal(F.isYoutubeUrl('https://www.youtube.com/watch?v=abc'), true);
  assert.equal(F.isYoutubeUrl('https://youtu.be/abc'), true);
  assert.equal(F.isTwitterOrXUrl('https://x.com/i/status/1'), true);
  assert.equal(F.isSupportedUrl('https://example.com/video'), false);
  assert.equal(F.detectPlatform('https://music.youtube.com/watch?v=1'), 'youtube');
  assert.equal(F.detectPlatform('https://twitter.com/a/status/1'), 'x');
});

test('progress payload normalizes number and object forms', () => {
  assert.deepEqual(F.normalizeProgress(42.2), {
    percent: 42.2,
    speed: null,
    size: null,
    eta: null
  });
  assert.equal(F.normalizeProgress({ percent: 80, speed: '4.2 MiB/s', eta: '00:12' }).speed, '4.2 MiB/s');
  assert.equal(F.displaySpeed(' 12.4  MB/s '), '12.4 MB/s');
  assert.equal(F.displayEta('00:18'), '00:18');
});
