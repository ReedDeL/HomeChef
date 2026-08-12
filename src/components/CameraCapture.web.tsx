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
  // Bumped on every stopStream() and every new startStream() call so a
  // slow-resolving getUserMedia from a superseded request can tell it's
  // stale and back out instead of orphaning a stream or stomping newer state.
  const requestIdRef = useRef(0);

  const [phase, setPhase] = useState<Phase>('closed');
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    requestIdRef.current += 1;
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
      const requestId = ++requestIdRef.current;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraintsFor(deviceId),
          audio: false,
        });

        // A newer request (cancel, close, or another device switch) landed
        // while this one was in flight — stop the now-unwanted tracks and
        // leave streamRef/videoRef/state alone; they belong to that request.
        if (requestId !== requestIdRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

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
        if (requestId !== requestIdRef.current) return;
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
