import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon, IconName } from '@/components/Icon';
import { PressScale } from '@/components/motion/PressScale';
import { Toggle } from '@/components/motion/Toggle';
import { Segmented } from '@/components/Segmented';
import { hourLabel } from '@/features/library/useScreenTime';
import { laneKey, TKey, topicLabel, useT } from '@/i18n';
import { Constants, Tables } from '@/lib/database.types';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { color, font, Lane, lane as lanes, radius, space } from '@/theme/tokens';

import { useParentSession, withParent } from './ParentSession';
import { Step } from './Step';

export type ChildSummary = { id: string; name: string; lane: Lane; limit: number | null };

type Sub = 'name' | 'birth' | 'interests' | 'mix' | 'time';
const SUBS: Sub[] = ['name', 'birth', 'interests', 'mix', 'time'];
const LIMITS: (number | null)[] = [null, 15, 30, 45, 60, 90, 120];

/** What we suggest per lane: minutes a day, bedtime, and whether quiet hours start on. */
const DEFAULTS: Record<Lane, { limit: number | null; bedtime: number; quiet: boolean }> = {
  little: { limit: 30, bedtime: 19, quiet: true },
  kids: { limit: 60, bedtime: 20, quiet: true },
  teen: { limit: 90, bedtime: 22, quiet: false },
  adult: { limit: null, bedtime: 23, quiet: false },
};

const MIX: { value: 0 | 1 | 2; icon: IconName; label: TKey; hint: TKey }[] = [
  { value: 2, icon: 'sparkle', label: 'onboarding.mix.learning', hint: 'onboarding.mix.learningHint' },
  { value: 1, icon: 'star', label: 'onboarding.mix.both', hint: 'onboarding.mix.bothHint' },
  { value: 0, icon: 'smile', label: 'onboarding.mix.fun', hint: 'onboarding.mix.funHint' },
];

const laneRank = (l: Lane) => Constants.public.Enums.lane.indexOf(l);

/** Same rule as private.lane_for_birth on the server: age today → lane. */
export function laneForBirth(year: number, month: number, today = new Date()): Lane {
  const age = today.getFullYear() - year - (today.getMonth() + 1 < month ? 1 : 0);
  return age < 7 ? 'little' : age < 13 ? 'kids' : age < 18 ? 'teen' : 'adult';
}

type Props = {
  /** Where this flow sits on the outer progress bar. */
  progress: [from: number, to: number];
  onDone: (child: ChildSummary) => void;
  onCancel: () => void;
};

/**
 * Everything a child's profile needs, a question per screen: name, birth
 * month (→ lane, shown live), interests for that lane, learning-vs-fun, and
 * screen time with age-based suggestions. Saved in one call at the end.
 */
export function ChildSetup({ progress, onDone, onCancel }: Props) {
  const { t, lang } = useT();
  const gate = useParentSession();
  const now = new Date();
  const [sub, setSub] = useState<Sub>('name');
  const [name, setName] = useState('');
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [interests, setInterests] = useState<Tables<'interests'>[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mix, setMix] = useState<0 | 1 | 2>(1);
  const [limit, setLimit] = useState<number | null>(60);
  const [quiet, setQuiet] = useState(true);
  const [bedtime, setBedtime] = useState(20);
  const [wake, setWake] = useState(7);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeSeeded = useRef<Lane | null>(null);

  useEffect(() => {
    supabase
      .from('interests')
      .select('*')
      .order('sort')
      .then(({ data }) => setInterests(data ?? []));
  }, []);

  const lane = year && month ? laneForBirth(year, month) : null;
  const options = useMemo(() => (lane ? interests.filter((i) => laneRank(i.youngest_lane) <= laneRank(lane)) : []), [interests, lane]);
  const nm = name.trim();

  // Seed screen time from the lane the first time we know it (and again if it changes).
  useEffect(() => {
    if (!lane || timeSeeded.current === lane) return;
    timeSeeded.current = lane;
    const d = DEFAULTS[lane];
    setLimit(d.limit);
    setBedtime(d.bedtime);
    setQuiet(d.quiet);
    // Interests no longer allowed for the new lane drop out.
    setPicked((cur) => new Set([...cur].filter((s) => options.some((o) => o.slug === s) || !interests.length)));
  }, [lane]); // eslint-disable-line react-hooks/exhaustive-deps

  const idx = SUBS.indexOf(sub);
  const prog = progress[0] + ((progress[1] - progress[0]) * idx) / SUBS.length;
  const go = (d: 1 | -1) => (idx + d < 0 ? onCancel() : setSub(SUBS[idx + d]));

  const save = async () => {
    if (!lane || !year || !month) return;
    setSaving(true);
    setError(null);
    const res = await withParent(gate, (token) =>
      supabase.rpc('create_profile', {
        p_parent: token,
        p_name: nm,
        p_birth_month: `${year}-${String(month).padStart(2, '0')}-01`,
        p_language: lang,
        p_learning_mix: mix,
        p_interests: [...picked],
        p_daily_limit_minutes: limit,
        p_quiet_hours: quiet,
        p_bedtime_hour: bedtime,
        p_wake_hour: wake,
      }),
    );
    setSaving(false);
    if (!res) return; // PIN cancelled
    if (res.error || !res.data) {
      fx.error();
      return setError(res.error?.message.includes('6 profiles') ? t('onboarding.error.full') : t('onboarding.error.generic'));
    }
    fx.success();
    onDone({ id: res.data, name: nm, lane, limit });
  };

  if (sub === 'name') {
    return (
      <Step
        stepKey="name"
        progress={prog}
        onBack={() => go(-1)}
        title={t('onboarding.child.nameTitle')}
        action={{ label: t('common.continue'), onPress: () => go(1), disabled: nm.length === 0 }}
      >
        <TextInput
          style={styles.nameInput}
          placeholder={t('onboarding.child.namePlaceholder')}
          placeholderTextColor={color.text3}
          value={name}
          onChangeText={setName}
          maxLength={30}
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => nm && go(1)}
        />
      </Step>
    );
  }

  if (sub === 'birth') {
    const years = Array.from({ length: 18 }, (_, i) => now.getFullYear() - i);
    return (
      <Step
        stepKey="birth"
        progress={prog}
        onBack={() => go(-1)}
        title={t('onboarding.child.birthTitle', { name: nm })}
        action={{ label: t('common.continue'), onPress: () => go(1), disabled: !lane }}
      >
        <Text style={styles.label}>{t('onboarding.child.year')}</Text>
        <View style={styles.grid}>
          {years.map((y) => (
            <Chip key={y} label={String(y)} on={year === y} onPress={() => setYear(y)} />
          ))}
        </View>
        <Text style={styles.label}>{t('onboarding.child.month')}</Text>
        <View style={styles.grid}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const future = year === now.getFullYear() && m > now.getMonth() + 1;
            return <Chip key={m} label={t(`onboarding.m${m}` as TKey)} on={month === m} disabled={future} onPress={() => setMonth(m)} />;
          })}
        </View>
        {lane && (
          <View style={[styles.laneCard, { borderColor: lanes[lane].color }]}>
            <View style={[styles.laneDot, { backgroundColor: lanes[lane].color }]} />
            <Text style={styles.laneText}>{t('onboarding.child.laneResult', { name: nm, lane: t(laneKey(lane)), ages: lanes[lane].ages })}</Text>
          </View>
        )}
      </Step>
    );
  }

  if (sub === 'interests') {
    return (
      <Step
        stepKey="interests"
        progress={prog}
        onBack={() => go(-1)}
        title={t('onboarding.child.interestsTitle', { name: nm })}
        hint={t('onboarding.child.interestsHint')}
        action={{ label: t('common.continue'), onPress: () => go(1), disabled: picked.size === 0 }}
      >
        <View style={styles.chips}>
          {options.map((i) => {
            const on = picked.has(i.slug);
            return (
              <Pressable
                key={i.slug}
                onPress={() => {
                  fx.toggle(!on);
                  setPicked((cur) => {
                    const next = new Set(cur);
                    if (on) next.delete(i.slug);
                    else next.add(i.slug);
                    return next;
                  });
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={[styles.topic, on && styles.topicOn]}
              >
                <Text style={styles.topicEmoji}>{i.emoji}</Text>
                <Text style={[styles.topicText, on && { color: color.ink }]}>{topicLabel(t, i.slug, i.label)}</Text>
              </Pressable>
            );
          })}
        </View>
      </Step>
    );
  }

  if (sub === 'mix') {
    return (
      <Step
        stepKey="mix"
        progress={prog}
        onBack={() => go(-1)}
        title={t('onboarding.child.mixTitle', { name: nm })}
        action={{ label: t('common.continue'), onPress: () => go(1) }}
      >
        {MIX.map((m) => {
          const on = mix === m.value;
          return (
            <PressScale
              key={m.value}
              onPress={() => {
                fx.tab();
                setMix(m.value);
              }}
              pressedScale={0.98}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.option, on && styles.optionOn]}
            >
              <View style={[styles.optionIcon, on && { backgroundColor: color.ember }]}>
                <Icon name={m.icon} size={20} color={on ? color.ink : color.text} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.optionTitle}>{t(m.label)}</Text>
                <Text style={styles.optionHint}>{t(m.hint)}</Text>
              </View>
            </PressScale>
          );
        })}
      </Step>
    );
  }

  // time
  const suggested = lane ? DEFAULTS[lane].limit : null;
  return (
    <Step
      stepKey="time"
      progress={prog}
      onBack={() => go(-1)}
      title={t('onboarding.child.timeTitle', { name: nm })}
      hint={suggested ? t('onboarding.child.timeHint', { minutes: t('common.minutes', { count: suggested }) }) : undefined}
      action={{ label: saving ? t('onboarding.child.saving') : t('onboarding.child.create'), onPress: save, disabled: saving }}
    >
      <Text style={styles.label}>{t('onboarding.child.dailyLimit')}</Text>
      <Segmented options={LIMITS} value={limit} onChange={setLimit} label={(l) => (l == null ? t('common.off') : String(l))} />
      <Pressable
        onPress={() => {
          fx.toggle(!quiet);
          setQuiet((q) => !q);
        }}
        accessibilityRole="switch"
        accessibilityState={{ checked: quiet }}
        style={styles.toggleRow}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.optionTitle}>{t('onboarding.child.quietHours')}</Text>
          <Text style={styles.optionHint}>{t('onboarding.child.quietHint')}</Text>
        </View>
        <Toggle on={quiet} />
      </Pressable>
      {quiet && (
        <View style={styles.hours}>
          <HourStepper label={t('onboarding.child.bedtime')} value={bedtime} onChange={setBedtime} lang={lang} />
          <HourStepper label={t('onboarding.child.wake')} value={wake} onChange={setWake} lang={lang} />
        </View>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </Step>
  );
}

function Chip({ label, on, disabled, onPress }: { label: string; on: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        fx.tab();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: on, disabled }}
      style={[styles.chip, on && styles.chipOn, disabled && { opacity: 0.3 }]}
    >
      <Text style={[styles.chipText, on && { color: color.ink }]}>{label}</Text>
    </Pressable>
  );
}

function HourStepper({ label, value, onChange, lang }: { label: string; value: number; onChange: (h: number) => void; lang: Parameters<typeof hourLabel>[1] }) {
  const step = (d: number) => {
    fx.key();
    onChange((value + d + 24) % 24);
  };
  return (
    <View style={styles.stepper}>
      <Text style={styles.optionHint}>{label}</Text>
      <View style={styles.stepRow}>
        <PressScale onPress={() => step(-1)} pressedScale={0.85} accessibilityRole="button" accessibilityLabel={`${label} −1`} style={styles.stepButton}>
          <Icon name="minus" size={16} strokeWidth={2.6} />
        </PressScale>
        <Text style={styles.stepValue}>{hourLabel(value, lang)}</Text>
        <PressScale onPress={() => step(1)} pressedScale={0.85} accessibilityRole="button" accessibilityLabel={`${label} +1`} style={styles.stepButton}>
          <Icon name="plus" size={16} strokeWidth={2.6} />
        </PressScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nameInput: { color: color.text, fontFamily: font.display, fontSize: 32, paddingVertical: space.md, borderBottomWidth: 2, borderBottomColor: color.line },
  label: { color: color.text2, fontFamily: font.semibold, fontSize: 14, marginTop: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minWidth: 64, height: 44, paddingHorizontal: space.md, borderRadius: 14, backgroundColor: color.surface1, borderWidth: 1, borderColor: color.line, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: color.text, borderColor: color.text },
  chipText: { color: color.text, fontFamily: font.semibold, fontSize: 15 },
  laneCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, borderWidth: 1.5, backgroundColor: color.surface1, marginTop: space.sm },
  laneDot: { width: 12, height: 12, borderRadius: 6 },
  laneText: { flex: 1, color: color.text, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: color.surface1, borderWidth: 1, borderColor: color.line },
  topicOn: { backgroundColor: color.text, borderColor: color.text },
  topicEmoji: { fontSize: 18 },
  topicText: { color: color.text, fontFamily: font.semibold, fontSize: 15 },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: color.surface1, borderWidth: 1.5, borderColor: color.surface1 },
  optionOn: { borderColor: color.ember },
  optionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { color: color.text, fontFamily: font.bold, fontSize: 16 },
  optionHint: { color: color.text3, fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  hours: { flexDirection: 'row', gap: space.sm },
  stepper: { flex: 1, padding: space.md, borderRadius: 16, backgroundColor: color.surface1, gap: 6 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.surface2, alignItems: 'center', justifyContent: 'center' },
  stepValue: { color: color.text, fontFamily: font.mono, fontSize: 17 },
  error: { color: color.ember, fontFamily: font.semibold, fontSize: 14 },
});
