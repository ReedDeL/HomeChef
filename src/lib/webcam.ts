/**
 * Pure helpers for the web camera picker (src/components/CameraCapture.web.tsx).
 * Kept separate from the DOM-heavy component so device-list shaping and
 * constraint-building can be unit tested without a browser.
 */

export interface CameraDevice {
  deviceId: string;
  label: string;
}

interface DeviceLike {
  kind: string;
  deviceId: string;
  label: string;
}

/**
 * Video-input devices only, with a numbered fallback label for the moment
 * before permission is granted, when the browser reports every label as "".
 */
export function toCameraDevices(devices: readonly DeviceLike[]): CameraDevice[] {
  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Camera ${index + 1}`,
    }));
}

/** getUserMedia's video constraint: the exact chosen device, or the browser default. */
export function videoConstraintsFor(deviceId: string | null): MediaTrackConstraints | boolean {
  return deviceId ? { deviceId: { exact: deviceId } } : true;
}
