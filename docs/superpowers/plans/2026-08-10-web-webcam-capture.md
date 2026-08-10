# Web Webcam Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the web build, "Take a photo" in `app/scan.tsx` opens a live `getUserMedia` camera preview (with a device picker when more than one camera exists) instead of falling through to a file dialog, while native is untouched.

**Architecture:** A platform-split component pair — `src/components/CameraCapture.tsx` (native no-op) and `src/components/CameraCapture.web.tsx` (real implementation, resolved by Metro for the web bundle) — plus a small pure-logic module, `src/lib/webcam.ts`, that shapes the device list and builds `getUserMedia` constraints so that logic is unit-testable without a browser. `app/scan.tsx` renders `CameraCapture` unconditionally and only branches on `Platform.OS` inside its existing `pick()` handler to decide whether to open it.

**Tech Stack:** Expo 57 / React Native 0.86 / React 19.2 / TypeScript 6.0 (`strict: true`), `react-native-web`, browser `MediaDevices`/`getUserMedia` API, vitest.

**Full design spec:** `docs/superpowers/specs/2026-08-10-web-webcam-capture-design.md`

## Global Constraints

- TypeScript `strict: true`, plus `noUncheckedIndexedAccess` and `noImplicitOverride` — array/optional access needs explicit narrowing.
- No `any` — use `unknown` at boundaries and narrow (`@typescript-eslint/no-explicit-any` is an error).
- Named exports only, except `app/` route files (which must default-export — not touched by this plan except `app/scan.tsx`'s existing default export, which stays as-is).
- Accessibility props (`accessibilityLabel`/`accessibilityHint`/`accessibilityRole`) required on every interactive element — CI enforces this.
- No hardcoded colors or spacing — use `src/theme/tokens.ts` (`space`, `radius`) and `useTheme()` for colors.
- Commits: imperative, under 50 chars (e.g. `Add web camera device picker`).
- Line length 100.
- No new dependencies (no `expo-camera`) — the spec is explicit about this.
- No new automated test infrastructure for the DOM-heavy component — the spec's Testing section documents why (no `.tsx`/component tests exist anywhere in this codebase; `vitest.config.ts` only includes `src/**/*.test.ts`). Only the pure logic in `src/lib/webcam.ts` gets unit tests, matching the existing `lib/` split (e.g. `candidates.ts` pure vs. `pantry-photo.ts` I/O).

---

### Task 1: Pure webcam device-list helpers

**Files:**
- Create: `src/lib/webcam.ts`
- Test: `src/lib/webcam.test.ts`

**Interfaces:**
- Produces: `export interface CameraDevice { deviceId: string; label: string }`, `export function toCameraDevices(devices: readonly { kind: string; deviceId: string; label: string }[]): CameraDevice[]`, `export function videoConstraintsFor(deviceId: string | null): MediaTrackConstraints | boolean`. Consumed by Task 3.

- [ ] **Step 1: Write the failing test**

Create `src/lib/webcam.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/webcam.test.ts`
Expected: FAIL — `Cannot find module '@/lib/webcam'` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/webcam.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/webcam.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/webcam.ts src/lib/webcam.test.ts
git commit -m "Add pure webcam device-list helpers"
```

---

### Task 2: Native no-op `CameraCapture`

**Files:**
- Create: `src/components/CameraCapture.tsx`

**Interfaces:**
- Produces: `export function CameraCapture(props: CameraCaptureProps): null` where `CameraCaptureProps = { visible: boolean; onCapture: (dataUri: string) => void; onClose: () => void; onUnavailable: () => void; }`. This is the import target Metro resolves for iOS/Android; Task 3 defines the same prop shape for the web-resolved file, and Task 4 is the consumer of both.

This file has no test — it's a one-line stub with no branching logic, consistent with the "no new component test infra" constraint above.

- [ ] **Step 1: Write the stub**

Create `src/components/CameraCapture.tsx`:

```tsx
interface CameraCaptureProps {
  visible: boolean;
  onCapture: (dataUri: string) => void;
  onClose: () => void;
  onUnavailable: () => void;
}

/**
 * Native already has a working live camera through expo-image-picker's
 * launchCameraAsync, so this component exists only for the web bundle.
 * Metro resolves CameraCapture.web.tsx there; this file is the import
 * target for iOS/Android, and intentionally renders nothing.
 */
export function CameraCapture(_props: CameraCaptureProps) {
  return null;
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors. (`_props` is unused but the eslint config's `argsIgnorePattern: '^_'` allows it.)

- [ ] **Step 3: Commit**

```bash
git add src/components/CameraCapture.tsx
git commit -m "Add native no-op CameraCapture stub"
```

---

### Task 3: Web live camera implementation

**Files:**
- Create: `src/components/CameraCapture.web.tsx`

**Interfaces:**
- Consumes: `toCameraDevices`, `videoConstraintsFor`, `type CameraDevice` from `@/lib/webcam` (Task 1); `Chip` from `@/components/ui/Chip` (props: `label`, `selected?`, `onPress?`, `accessibilityLabel`, `accessibilityHint?`); `PrimaryButton` from `@/components/ui/PrimaryButton` (props: `label`, `onPress`, `accessibilityHint`, `disabled?`, `variant?: 'primary' | 'ghost'`); `Text` from `@/components/ui/Text`; `useTheme` from `@/theme/useTheme` (returns `{ color }` with `color.bg`, `color.border`); `radius`, `space` from `@/theme/tokens`.
- Produces: `export function CameraCapture(props: CameraCaptureProps)` with the same `CameraCaptureProps` shape as Task 2 — Metro picks this file over `CameraCapture.tsx` when bundling for web. Consumed by Task 4.

This file has no automated test (DOM/`getUserMedia`-heavy — see the constraint above); it's verified by typecheck/lint here and manually in Task 5.

- [ ] **Step 1: Write the implementation**

Create `src/components/CameraCapture.web.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/ui/Chip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Text } from '@/components/ui/Text';
import { toCameraDevices, videoConstraintsFor, type CameraDevice } from '@/lib/webcam';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Phase = 'requesting' | 'live' | 'closed';

interface CameraCaptureProps {
  visible: boolean;
  onCapture: (dataUri: string) => void;
  onClose: () => void;
  onUnavailable: () => void;
}

/**
 * Live getUserMedia camera for the web build
 * (docs/superpowers/specs/2026-08-10-web-webcam-capture-design.md).
 * expo-image-picker has no real camera on web, so this replaces "Take a
 * photo" there. Native gets CameraCapture.tsx, which renders nothing.
 */
export function CameraCapture({ visible, onCapture, onClose, onUnavailable }: CameraCaptureProps) {
  const { color } = useTheme();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<Phase>('closed');
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startStream = useCallback(
    async (deviceId: string | null) => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        onUnavailable();
        return;
      }

      setPhase('requesting');
      stopStream();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraintsFor(deviceId),
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const settledDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId;
        setActiveDeviceId(settledDeviceId ?? null);

        const mediaDevices = await navigator.mediaDevices.enumerateDevices();
        setDevices(toCameraDevices(mediaDevices));

        setPhase('live');
      } catch {
        setPhase('closed');
        onUnavailable();
      }
    },
    [onUnavailable, stopStream]
  );

  useEffect(() => {
    if (!visible) {
      stopStream();
      setPhase('closed');
      setDevices([]);
      setActiveDeviceId(null);
      return;
    }

    void startStream(null);

    return () => {
      stopStream();
    };
    // Deliberately depends on `visible` alone: startStream/stopStream are
    // stable (useCallback), and this effect should re-run only when the
    // parent opens or closes the view, not on every render.
  }, [visible]);

  const setPreviewContainer = useCallback((node: View | null) => {
    // react-native-web forwards a View's ref to its underlying DOM node.
    const element = node as unknown as HTMLElement | null;

    if (!element) {
      videoRef.current?.remove();
      videoRef.current = null;
      return;
    }

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    element.appendChild(video);
    videoRef.current = video;

    if (streamRef.current) {
      video.srcObject = streamRef.current;
      void video.play();
    }
  }, []);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement('canvas');
    }
    const canvas = captureCanvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    onCapture(canvas.toDataURL('image/jpeg', 0.92));
  }, [onCapture]);

  const handleSelectDevice = useCallback(
    (deviceId: string) => {
      if (deviceId === activeDeviceId) return;
      void startStream(deviceId);
    },
    [activeDeviceId, startStream]
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.overlay, { backgroundColor: color.bg }]}>
        <View style={styles.content}>
          <Text variant="display">Point your camera</Text>
          <Text variant="body" tone="muted">
            {phase === 'requesting'
              ? 'Requesting camera access…'
              : 'Get the shelves in frame, then capture.'}
          </Text>

          <View ref={setPreviewContainer} style={[styles.preview, { borderColor: color.border }]} />

          {devices.length > 1 ? (
            <View style={styles.deviceRow}>
              {devices.map((device) => (
                <Chip
                  key={device.deviceId}
                  label={device.label}
                  selected={device.deviceId === activeDeviceId}
                  onPress={() => handleSelectDevice(device.deviceId)}
                  accessibilityLabel={`Use ${device.label}`}
                  accessibilityHint="Switches the live preview to this camera"
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            label="Capture photo"
            onPress={handleCapture}
            disabled={phase !== 'live'}
            accessibilityHint="Takes a photo with the live camera"
          />
          <PrimaryButton
            label="Cancel"
            variant="ghost"
            onPress={onClose}
            accessibilityHint="Closes the camera without taking a photo"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'space-between' },
  content: { padding: space.lg, gap: space.md },
  preview: {
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  deviceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  footer: { padding: space.lg, gap: space.sm },
});
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors. (`eslint.config.mjs` doesn't configure `eslint-plugin-react-hooks`, so the effect's single-dependency array needs no disable comment — it's already omitted above.)

- [ ] **Step 3: Commit**

```bash
git add src/components/CameraCapture.web.tsx
git commit -m "Add live webcam capture for web"
```

---

### Task 4: Wire `CameraCapture` into the scan screen

**Files:**
- Modify: `app/scan.tsx`

**Interfaces:**
- Consumes: `CameraCapture` from `@/components/CameraCapture` (Tasks 2 + 3), props `{ visible, onCapture, onClose, onUnavailable }`.

- [ ] **Step 1: Add the `Platform` import and `CameraCapture` import**

In `app/scan.tsx`, change line 4 from:

```tsx
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
```

to:

```tsx
import { Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
```

Add a new import before the existing `import { CandidateRow } from '@/components/ui/CandidateRow';` line (line 6), so the import block reads:

```tsx
import { CameraCapture } from '@/components/CameraCapture';
import { CandidateRow } from '@/components/ui/CandidateRow';
```

- [ ] **Step 2: Add `cameraOpen` state**

Immediately after the existing:

```tsx
  const [error, setError] = useState<string | null>(null);
```

add:

```tsx
  const [cameraOpen, setCameraOpen] = useState(false);
```

- [ ] **Step 3: Branch `pick()` for web, and add the capture/fallback handlers**

Replace the existing `pick` callback:

```tsx
  const pick = useCallback(async (source: 'camera' | 'library') => {
    setError(null);

    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('We need camera access to photograph your kitchen.');
        return;
      }
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            quality: 1,
            allowsMultipleSelection: true,
            selectionLimit: MAX_PHOTOS,
          });

    if (result.canceled) return;

    setUris((current) =>
      [...current, ...result.assets.map((asset) => asset.uri)].slice(0, MAX_PHOTOS)
    );
  }, []);
```

with:

```tsx
  const pick = useCallback(async (source: 'camera' | 'library') => {
    setError(null);

    if (source === 'camera' && Platform.OS === 'web') {
      setCameraOpen(true);
      return;
    }

    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('We need camera access to photograph your kitchen.');
        return;
      }
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            quality: 1,
            allowsMultipleSelection: true,
            selectionLimit: MAX_PHOTOS,
          });

    if (result.canceled) return;

    setUris((current) =>
      [...current, ...result.assets.map((asset) => asset.uri)].slice(0, MAX_PHOTOS)
    );
  }, []);

  const handleWebCapture = useCallback((dataUri: string) => {
    setCameraOpen(false);
    setUris((current) => [...current, dataUri].slice(0, MAX_PHOTOS));
  }, []);

  const handleWebCameraUnavailable = useCallback(() => {
    setCameraOpen(false);
    void pick('library');
  }, [pick]);
```

- [ ] **Step 4: Render `CameraCapture` alongside the capture-phase `Screen`**

The capture/analyzing phase's `return` (currently the final `return` in the component, after the `if (phase === 'review')` branch) starts with:

```tsx
  return (
    <Screen
      footer={
```

and ends with:

```tsx
      ) : null}
    </Screen>
  );
}
```

Wrap that `<Screen>` in a fragment and add `<CameraCapture>` as a sibling, so it reads:

```tsx
  return (
    <>
      <Screen
        footer={
```

```tsx
        ) : null}
      </Screen>

      <CameraCapture
        visible={cameraOpen}
        onCapture={handleWebCapture}
        onClose={() => setCameraOpen(false)}
        onUnavailable={handleWebCameraUnavailable}
      />
    </>
  );
}
```

(Only the outermost `return (`/closing `);` and the `<Screen>`/`</Screen>` tags change — everything between stays as it is today. `cameraOpen` can only become `true` from this phase, since `pick('camera')` is only reachable from the capture-phase buttons, so `CameraCapture` doesn't need to appear in the `phase === 'review'` branch.)

- [ ] **Step 5: Typecheck, lint, and run the existing test suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: no errors; all existing tests still pass (this task doesn't touch anything under `src/engine/`, `src/lib/adapters/`, or the other tested modules).

- [ ] **Step 6: Commit**

```bash
git add app/scan.tsx
git commit -m "Open live camera for web pantry scan"
```

---

### Task 5: Manual verification in the web build

**Files:** none — this is a manual QA pass, not a code change.

- [ ] **Step 1: Start the web dev server**

Run: `npm run web`

- [ ] **Step 2: Single-camera flow**

On a machine with one camera (typical laptop), open the scan screen and tap "Take a photo." Confirm: the live preview appears with no device-chip row, "Requesting camera access…" shows briefly first, "Capture photo" is disabled until the preview is live, capturing adds a thumbnail to the strip and closes the camera view, and "Add to pantry" / "Start over" still work as before.

- [ ] **Step 3: Multi-camera flow**

With more than one camera available (built-in + a USB webcam, or an OS-level virtual camera), confirm the device-chip row appears above the preview and tapping a chip switches the live preview to that device.

- [ ] **Step 4: Permission denied and no-camera fallback**

Deny the browser's camera permission prompt. Confirm the camera view closes and the existing file picker ("Choose from library" flow) opens instead, with no error message shown — matching the spec's "silently fall back" decision.

If reachable in your dev setup, also try a non-secure context (e.g. loading the dev server over your LAN IP instead of `localhost`, where `getUserMedia` is unavailable by browser policy) and confirm the same silent fallback happens. This case is harder to reach than permission-denial, so treat it as best-effort rather than a blocker.

- [ ] **Step 5: Cancel**

Open the camera view and tap "Cancel." Confirm it closes with no photo added and no fallback file picker opens (fallback is only for unavailability, not a deliberate cancel).

- [ ] **Step 6: Native regression check**

On iOS or Android (Expo Go or a dev build), confirm "Take a photo" still opens the native camera exactly as before — this change should be invisible there.

- [ ] **Step 7: Full check**

Run: `npm run check`
Expected: lint, typecheck, tests, and format all pass.
