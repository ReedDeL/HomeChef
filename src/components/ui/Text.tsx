import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { type as typeScale } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Variant = keyof typeof typeScale;
type Tone = 'default' | 'muted' | 'accent' | 'ready' | 'near' | 'far' | 'danger' | 'onAccent';

interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
}

/**
 * Typography, bound to the scale in docs/04_UIUX_SPEC.md §1.2.
 *
 * Every string in the app goes through here so that a size or weight is chosen
 * from the seven defined steps rather than typed as a number. `tone` is a
 * closed set for the same reason — in particular it is the only way to reach
 * `danger`, which is reserved for allergen warnings and nothing else.
 */
export function Text({ variant = 'body', tone = 'default', style, ...rest }: TextProps) {
  const { color } = useTheme();

  const tones: Record<Tone, string> = {
    default: color.text,
    muted: color.textMuted,
    accent: color.accent,
    ready: color.ready,
    near: color.near,
    far: color.far,
    danger: color.danger,
    onAccent: color.accentText,
  };

  // The scale stores fontWeight as a string literal, which is exactly what
  // TextStyle wants but wider than it accepts without the assertion.
  const scale = typeScale[variant] as TextStyle;

  return <RNText style={[scale, { color: tones[tone] }, style]} {...rest} />;
}
