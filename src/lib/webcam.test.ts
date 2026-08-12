import { describe, expect, it } from 'vitest';

import { toCameraDevices, videoConstraintsFor } from '@/lib/webcam';

describe('toCameraDevices', () => {
  it('keeps only videoinput devices', () => {
    const devices = toCameraDevices([
      { kind: 'audioinput', deviceId: 'a1', label: 'Mic' },
      { kind: 'videoinput', deviceId: 'v1', label: 'Webcam' },
      { kind: 'audiooutput', deviceId: 'o1', label: 'Speaker' },
    ]);

    expect(devices).toEqual([{ deviceId: 'v1', label: 'Webcam' }]);
  });

  it('falls back to a numbered label when the browser has not granted one yet', () => {
    const devices = toCameraDevices([
      { kind: 'videoinput', deviceId: 'v1', label: '' },
      { kind: 'videoinput', deviceId: 'v2', label: '' },
    ]);

    expect(devices).toEqual([
      { deviceId: 'v1', label: 'Camera 1' },
      { deviceId: 'v2', label: 'Camera 2' },
    ]);
  });

  it('keeps real labels when present', () => {
    const devices = toCameraDevices([
      { kind: 'videoinput', deviceId: 'v1', label: 'FaceTime HD Camera' },
    ]);

    expect(devices).toEqual([{ deviceId: 'v1', label: 'FaceTime HD Camera' }]);
  });
});

describe('videoConstraintsFor', () => {
  it('returns true when no device is chosen', () => {
    expect(videoConstraintsFor(null)).toBe(true);
  });

  it('constrains to the exact device id when one is chosen', () => {
    expect(videoConstraintsFor('v1')).toEqual({ deviceId: { exact: 'v1' } });
  });
});
