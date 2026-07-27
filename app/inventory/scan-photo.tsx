import { useRef, useState } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useInventory } from '@/features/inventory/useInventory';
import {
  recognizeIngredientsFromImage,
  type RecognizedIngredient,
} from '@/features/inventory/recognizeIngredients';

export default function ScanPhotoScreen() {
  const { addItem } = useInventory();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [recognized, setRecognized] = useState<RecognizedIngredient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const processImage = async (uri: string) => {
    setImageUri(uri);
    setRecognizing(true);
    try {
      const results = await recognizeIngredientsFromImage(uri);
      setRecognized(results);
      setSelected(new Set(results.map((r) => r.name)));
    } catch (error) {
      Alert.alert('Recognition failed', 'Could not identify ingredients from that photo.');
    } finally {
      setRecognizing(false);
    }
  };

  const capturePhoto = async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
    if (photo) await processImage(photo.uri);
  };

  const retake = () => {
    setImageUri(null);
    setRecognized([]);
    setSelected(new Set());
  };

  const pickFromLibrary = async () => {
    const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!libraryPermission.granted) {
      Alert.alert('Photos permission needed', 'Enable photo access to scan ingredients.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled) await processImage(result.assets[0].uri);
  };

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const addSelected = async () => {
    for (const name of selected) {
      await addItem({ ingredientName: name });
    }
    router.back();
  };

  // Live camera view — the primary "take a picture" path, not just a file upload.
  if (!imageUri) {
    if (!permission) {
      return (
        <View style={styles.container}>
          <ActivityIndicator />
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={[styles.container, styles.permissionPrompt]}>
          <Text style={styles.permissionText}>
            HomeChef needs camera access to scan ingredients.
          </Text>
          <PrimaryButton label="Enable camera" onPress={requestPermission} />
          <PrimaryButton label="Choose from library instead" variant="secondary" onPress={pickFromLibrary} />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        <View style={styles.cameraControls}>
          <Pressable onPress={pickFromLibrary} style={styles.libraryButton}>
            <Text style={styles.libraryButtonLabel}>Library</Text>
          </Pressable>
          <Pressable onPress={capturePhoto} style={styles.shutterOuter}>
            <View style={styles.shutterInner} />
          </Pressable>
          <View style={styles.libraryButton} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Image source={{ uri: imageUri }} style={styles.preview} />

      {recognizing && <ActivityIndicator style={{ marginTop: 20 }} />}

      {!recognizing && recognized.length > 0 && (
        <View style={styles.results}>
          <Text style={styles.resultsTitle}>We found these ingredients:</Text>
          {recognized.map((item) => {
            const isSelected = selected.has(item.name);
            return (
              <Pressable
                key={item.name}
                onPress={() => toggle(item.name)}
                style={[styles.resultRow, isSelected && styles.resultRowSelected]}
              >
                <Text style={styles.resultText}>{item.name}</Text>
                <Text style={styles.confidence}>{Math.round(item.confidence * 100)}%</Text>
              </Pressable>
            );
          })}
          <PrimaryButton
            label={`Add ${selected.size} to pantry`}
            onPress={addSelected}
            disabled={selected.size === 0}
          />
          <PrimaryButton label="Retake" variant="secondary" onPress={retake} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F2' },
  content: { padding: 16, gap: 16 },
  permissionPrompt: { justifyContent: 'center', padding: 24, gap: 12 },
  permissionText: { fontSize: 15, color: '#1A1A1A', textAlign: 'center', marginBottom: 8 },
  camera: { flex: 1 },
  cameraControls: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  libraryButton: {
    width: 64,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryButtonLabel: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  preview: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#EAEAE5' },
  results: { gap: 8 },
  resultsTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', marginBottom: 4 },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EAEAE5',
  },
  resultRowSelected: { borderColor: '#1F6F50', backgroundColor: '#EAF5EF' },
  resultText: { fontSize: 15, textTransform: 'capitalize', color: '#1A1A1A' },
  confidence: { fontSize: 13, color: '#6B6B6B' },
});
