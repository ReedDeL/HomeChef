import { useState } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
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

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Enable camera access to scan ingredients.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) await processImage(result.assets[0].uri);
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}

      {!imageUri && (
        <View style={{ gap: 12 }}>
          <PrimaryButton label="Take a photo" onPress={takePhoto} />
          <PrimaryButton label="Choose from library" variant="secondary" onPress={pickFromLibrary} />
        </View>
      )}

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
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F2' },
  content: { padding: 16, gap: 16 },
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
