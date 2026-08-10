# Web live camera (webcam) capture for pantry scan

**Date:** 2026-08-10
**Status:** Draft

## Problem

`app/scan.tsx` uses `expo-image-picker`'s `launchCameraAsync` for "Take a
photo." On web, `expo-image-picker` has no real camera implementation —
`launchCameraAsync` falls through to the same file-input dialog as "Choose
from library." A laptop with a built-in or USB webcam has no way to actually
take a live photo through the app; the button's label is a lie on that
platform.

`app/scan.tsx` is the only call site of the ImagePicker camera APIs in the
codebase.

## Goals

1. On web, "Take a photo" opens a live camera preview backed by
   `getUserMedia`, not a file dialog.
2. If more than one camera is available (built-in + external webcam), the
   user can pick which one to use.
3. Captured photos feed the existing `uris` → `analyzePantryPhotos` pipeline
   unchanged.
4. Native (iOS/Android) behavior is untouched.
5. Never dead-end: if live capture isn't available (no `getUserMedia`,
   permission denied, no camera found), fall back to the existing file
   picker automatically.

## Non-goals

- No native camera changes — `launchCameraAsync` on iOS/Android is untouched.
- No new icon/dependency (e.g. `expo-camera`) — the shutter and controls are
  the same text-driven `PrimaryButton`/`Chip` components used everywhere else.
- No multi-shot session — matching native, the live view captures one photo
  and closes; re-tapping "Take a photo" reopens it.
- No mirrored preview — this isn't a selfie flow, the preview should show
  exactly what gets captured.
- No new automated test infrastructure for this component (see Testing).

## Design

### File structure

Follows the existing `src/lib/storage.ts` / `storage.web.ts` platform-split
pattern (Metro resolves `.web.tsx` for the web bundle, the base file for
native), inverted so the *base* file is the no-op:

- `src/components/CameraCapture.tsx` — native stub. Renders `null`, ignores
  props. Exists only so the import resolves on iOS/Android without pulling in
  DOM-only code.
- `src/components/CameraCapture.web.tsx` — the real implementation.

`app/scan.tsx` imports one path, `@/components/CameraCapture`, and always
renders it; no `Platform.OS` check is needed at the render site, only inside
the `pick()` handler that decides *whether to open it*.

### Why imperative DOM, not JSX

The project's `tsconfig` extends `expo/tsconfig.base`, which targets React
Native's JSX namespace — it has no `'video'`/`'canvas'` intrinsic elements,
so writing `<video>` JSX would not type-check even inside a `.web.tsx` file
(the same `tsconfig` covers every file). Instead, `CameraCapture.web.tsx`
gets a `View`'s underlying DOM node via `ref` and imperatively
`document.createElement('video')` / `createElement('canvas')` in a
`useEffect`, appending the video to the ref'd container and keeping the
canvas off-DOM entirely (it's only used to grab a frame).

### `CameraCapture` API

```ts
type CameraCaptureProps = {
  visible: boolean;
  onCapture: (dataUri: string) => void;
  onClose: () => void;       // user cancels — no fallback
  onUnavailable: () => void; // no getUserMedia / denied / no camera — triggers fallback
};
```

### Lifecycle

1. `visible` flips `true` → check `navigator.mediaDevices?.getUserMedia`.
   Missing → `onUnavailable()` immediately, nothing else happens.
2. Otherwise call `getUserMedia({ video: true, audio: false })`. This is what
   triggers the browser's native permission prompt; a "Requesting camera
   access…" label covers the wait.
3. On grant: attach the stream to the imperative `<video>`
   (`videoEl.srcObject = stream; videoEl.play()`), then call
   `navigator.mediaDevices.enumerateDevices()` (device labels are only
   populated once permission is granted) and keep the `videoinput` entries.
4. On any rejection (`NotAllowedError`, `NotFoundError`,
   `OverconstrainedError`, or any other `getUserMedia` failure) →
   `onUnavailable()`.
5. `visible` flips back to `false`, or the component unmounts: stop every
   track on the current `MediaStream` and remove the imperative video/canvas
   nodes. No dangling camera light.

### Device switching

If `enumerateDevices()` returns more than one `videoinput`, a row of existing
`Chip` components renders above the preview — one per device, labeled from
`device.label`, selected state reflecting the active device. Tapping a chip
stops the current stream and starts a new one constrained to
`{ deviceId: { exact: id } }`. With zero or one camera, the row doesn't
render at all.

### Capture

The shutter is a `PrimaryButton` labeled "Capture photo" (no new icon
dependency). On press: draw the current video frame onto the off-screen
canvas sized to `videoWidth`/`videoHeight`, then
`canvas.toDataURL('image/jpeg', 0.92)`, and call `onCapture(dataUri)`. The
parent sets `visible={false}` in response, which runs the teardown in step 5
above — this is what makes capture close the view, matching native's
one-shot-then-close flow.

### Presentation

An RN `Modal` (supported on web via `react-native-web`) wrapping a
`Screen`-style layout: title text, the bordered video preview box
(`radius.md` / `color.border`, matching the existing photo-thumbnail
styling), the device-chip row when applicable, and a footer with "Capture
photo" plus a ghost "Cancel" button wired to `onClose`.

### `scan.tsx` integration

```ts
const [cameraOpen, setCameraOpen] = useState(false);

const pick = useCallback(async (source: 'camera' | 'library') => {
  setError(null);
  if (source === 'camera' && Platform.OS === 'web') {
    setCameraOpen(true);
    return;
  }
  // ...existing native camera / library logic, unchanged
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

`CameraCapture` is rendered unconditionally with `visible={cameraOpen}`; on
native it's the stub and renders nothing. `onUnavailable` reuses the existing
`pick('library')` path rather than duplicating file-picker logic — this is
also what implements "silently fall back to the file picker": no error
message, no new state, `pick('library')` already does the right thing on web.

### Data flow after capture

The captured `dataUri` is pushed into the same `uris: string[]` state that
picked photos use. `compressForUpload()` in `src/lib/pantry-photo.ts` already
runs any URI (data URI or blob URI) through `expo-image-manipulator`
unmodified, so nothing downstream of capture changes.

## Testing

No `.tsx` component tests exist anywhere in this codebase today — the
`vitest.config.ts` `include` is `src/**/*.test.ts`, and everything tested is
pure engine/lib logic. The closest analog, `src/lib/pantry-photo.ts` (I/O
glue calling Supabase), has no test either. Consistent with that existing
pattern, `CameraCapture.web.tsx` gets manual verification in the web build
(`npm run web` or equivalent), not new component-testing infrastructure.

Manual verification plan:

- Single camera (typical laptop): "Take a photo" opens the live preview with
  no device-chip row, capture adds a thumbnail, "Add to pantry" flow
  unaffected.
- Multiple cameras (built-in + USB webcam, or use OS virtual camera):
  device-chip row appears, switching chips swaps the live preview.
- Permission denied: browser's deny prompt → falls through to the file
  picker with no error message shown.
- Non-secure context / no `getUserMedia` (if reachable in dev): falls
  through to the file picker.
- Native (iOS/Android via Expo Go or a dev build): "Take a photo" opens the
  native camera exactly as before — unaffected by this change.
