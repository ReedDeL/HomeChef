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
