import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import type { VocabularyEntry } from '@/data/catalog';
import { searchVocabulary } from '@/lib/ingredients/resolve';
import { CONFIDENCE_THRESHOLD, type PantryCandidate } from '@/lib/pantry-photo';
import { radius, space, touchTarget } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface CandidateRowProps {
  candidate: PantryCandidate;
  onToggle: (key: string) => void;
  onCorrect: (key: string, entry: VocabularyEntry) => void;
  onDismiss: (key: string) => void;
}

/** Enough to choose from without turning the sheet into a scroll marathon. */
const SEARCH_LIMIT = 8;

/**
 * One detected ingredient, with everything the user needs to judge it.
 *
 * The design premise is that the model will be wrong sometimes and the user is
 * the only one who can tell. So the row always shows what the model actually
 * said, states plainly why an item is flagged, and puts the correction one tap
 * away. Nothing here is written to the pantry until the sheet is confirmed.
 */
export function CandidateRow({ candidate, onToggle, onCorrect, onDismiss }: CandidateRowProps) {
  const { color } = useTheme();
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');

  const isOutOfCatalog = candidate.unmatchedReason === 'out_of_catalog';
  const results = editing ? searchVocabulary(query, SEARCH_LIMIT) : [];
  const flag = flagFor(candidate);

  return (
    <View style={[styles.row, { borderColor: flag ? color.near : color.border }]}>
      <Pressable
        accessible
        accessibilityRole="checkbox"
        accessibilityState={{
          checked: candidate.accepted,
          disabled: candidate.ingredientId === null,
        }}
        accessibilityLabel={candidate.displayName ?? candidate.detectedName}
        accessibilityHint={
          candidate.ingredientId === null
            ? isOutOfCatalog
              ? 'No recipe in our catalog uses this ingredient, so it cannot be added to your pantry.'
              : 'We could not read this ingredient. Choose an ingredient before adding.'
            : 'Include this in your pantry'
        }
        disabled={candidate.ingredientId === null}
        onPress={() => onToggle(candidate.key)}
        style={styles.main}
      >
        <View
          style={[
            styles.check,
            { borderColor: candidate.accepted ? color.accent : color.border },
            candidate.accepted && { backgroundColor: color.accent },
          ]}
        />

        <View style={styles.copy}>
          <Text variant="bodyStrong" tone={candidate.ingredientId ? 'default' : 'muted'}>
            {candidate.displayName ?? candidate.detectedName}
          </Text>

          {/* Only shown when it differs, so the row stays quiet when nothing
              was changed and loud when something was. */}
          {candidate.displayName !== null &&
          candidate.displayName.toLowerCase() !== candidate.detectedName.toLowerCase() ? (
            <Text variant="caption" tone="muted">
              Photo said &ldquo;{candidate.detectedName}&rdquo;
            </Text>
          ) : null}

          {flag ? (
            <Text
              variant="caption"
              tone={candidate.unmatchedReason === 'misread' ? 'danger' : 'near'}
            >
              {flag}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.actions}>
        {!isOutOfCatalog ? (
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Change ${candidate.displayName ?? candidate.detectedName}`}
            accessibilityHint="Search for the right ingredient"
            onPress={() => {
              setEditing((current) => !current);
              setQuery(editing ? '' : candidate.detectedName);
            }}
            style={styles.action}
          >
            <Text variant="caption" tone="accent">
              {editing ? 'Cancel' : 'Change'}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Remove ${candidate.displayName ?? candidate.detectedName}`}
          accessibilityHint="Drops this item from the scan"
          onPress={() => onDismiss(candidate.key)}
          style={styles.action}
        >
          <Text variant="caption" tone="muted">
            Remove
          </Text>
        </Pressable>
      </View>

      {editing ? (
        <View style={styles.editor}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search ingredients"
            placeholderTextColor={color.textMuted}
            accessibilityLabel="Search for the correct ingredient"
            accessibilityHint="Type the ingredient you meant instead"
            autoCorrect={false}
            autoFocus
            style={[
              styles.input,
              { borderColor: color.border, backgroundColor: color.bg, color: color.text },
            ]}
          />
          <View style={styles.results}>
            {results.map((entry) => (
              <Chip
                key={entry.id}
                label={entry.displayName}
                onPress={() => {
                  onCorrect(candidate.key, entry);
                  setEditing(false);
                  setQuery('');
                }}
                accessibilityLabel={entry.displayName}
                accessibilityHint="Use this ingredient instead"
              />
            ))}
            {query.trim().length > 0 && results.length === 0 ? (
              <Text variant="caption" tone="muted">
                Nothing matching &ldquo;{query.trim()}&rdquo;.
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Why this row needs attention, in the user's terms. Returns null when the row
 * is fine — a flag on everything is a flag on nothing.
 */
function flagFor(candidate: PantryCandidate): string | null {
  if (candidate.corrected) return null;
  if (candidate.unmatchedReason === 'out_of_catalog') {
    return `No recipe in our catalog uses ${candidate.detectedName}.`;
  }
  if (candidate.unmatchedReason === 'misread') return "We couldn't read this one.";
  if (candidate.match === 'partial') return 'We simplified this name — check it';
  if (candidate.match === 'fuzzy') return 'Close match, not exact';
  if (candidate.confidence < CONFIDENCE_THRESHOLD) return 'Hard to see in the photo';
  return null;
}

const styles = StyleSheet.create({
  row: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  main: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  check: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 2 },
  copy: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', gap: space.md },
  action: { minHeight: 44, justifyContent: 'center' },
  editor: { gap: space.sm },
  input: {
    minHeight: touchTarget.standard,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    fontSize: 17,
  },
  results: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
