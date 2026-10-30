import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { mediaFor, signMedia } from '@/features/feed/data';
import { localized, useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { alpha, color, iconSize, iconStroke, radius, space, themedStyles } from '@/theme/tokens';

import type { Child } from './useParent';

const SHOWN = 3;

/**
 * The child's last few videos as posters, three across (Family C). A tap opens
 * the child's page, where each one can be hidden. Hidden videos are left out.
 */
export function RecentStrip({ child, onOpen }: { child: Child; onOpen: () => void }) {
  const { lang } = useT();
  const rows = child.recent.filter((r) => !r.hidden).slice(0, SHOWN);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const signed = useRef('');
  useEffect(() => {
    const key = rows.map((r) => r.id).join();
    if (key === signed.current) return;
    signed.current = key;
    signMedia(rows).then(setUrls);
  }, [rows]);

  return (
    <View style={styles.row}>
      {rows.map((r) => {
        const m = mediaFor(r, urls);
        return (
          <Pressable
            key={r.id}
            onPress={() => {
              fx.tap();
              onOpen();
            }}
            accessibilityRole="button"
            accessibilityLabel={localized(lang, r.caption, r.caption_i18n)}
            style={styles.tile}
          >
            {m && <Image source={m.thumb} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} contentFit="cover" />}
            <View style={styles.play}>
              <Icon name="play" size={iconSize.sm} color={color.white} strokeWidth={iconStroke(iconSize.sm)} />
            </View>
          </Pressable>
        );
      })}
      {/* Keep three columns when there are fewer videos, so posters never stretch. */}
      {Array.from({ length: SHOWN - rows.length }, (_, i) => (
        <View key={i} style={styles.spacer} />
      ))}
    </View>
  );
}

const styles = themedStyles(() => ({
  row: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, aspectRatio: 3 / 4, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: color.surface2, justifyContent: 'flex-end', padding: space.sm },
  play: { width: iconSize.lg + space.xs, height: iconSize.lg + space.xs, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(color.black, 0.45) },
  spacer: { flex: 1 },
}));
