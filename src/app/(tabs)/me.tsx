import { router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { LanguagePicker } from '@/components/LanguagePicker';
import { LaneBadge } from '@/components/LaneBadge';
import { ThemePicker } from '@/components/ThemePicker';
import { Enter } from '@/components/motion/Enter';
import { StatusScrim } from '@/components/StatusScrim';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { ListGroup, ListRow } from '@/components/ui/List';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useRoles } from '@/features/creator/useRoles';
import { REVIEW_ENABLED } from '@/features/creator/useReviewQueue';
import { useFamily } from '@/features/family/FamilyProvider';
import { useLibrary, useUsage } from '@/features/library/LibraryProvider';
import { useScreenTime } from '@/features/library/useScreenTime';
import { TasteCard } from '@/features/me/TasteCard';
import { useMe } from '@/features/me/useMe';
import { minutes } from '@/features/parent/useParent';
import { LANGS, roleKey, useT } from '@/i18n';
import { fx, getFeedbackSettings, setFeedbackSettings } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useInsets, useTabBarSpace } from '@/lib/useInsets';
import { useTheme } from '@/theme/ThemeProvider';
import { color, control, font, layout, pageFill, space, themedStyles, type } from '@/theme/tokens';

/** What each lane is told the parent can see (adult profiles aren't monitored and never show it). */
const PARENT_SEES = { little: 'me.parentSeesLittle', kids: 'me.parentSeesKids', teen: 'me.parentSeesTeen', adult: 'me.parentSeesTeen' } as const;

/**
 * Me (owner's mockup D, a list hub): face, name and lane; today's time; then
 * one list of the child's own things — Inbox (it moved here from the tab
 * bar), Saved, Following, My topics — and the settings groups below. Plain
 * rows from the system, one tap to everything.
 */
export default function MeScreen() {
  const insets = useInsets();
  const barSpace = useTabBarSpace();
  const focused = useIsFocused();
  const { current, leaveProfile, signOut, device } = useFamily();
  // A linked phone (a member's own or a shared one) has no parent dashboard; the parent manages it from theirs.
  const linked = !!device;
  const ownPhone = device?.kind === 'child';
  const { unread } = useLibrary();
  const { todaySeconds } = useUsage();
  const { limitMinutes } = useScreenTime();
  const { data, reload, resetTaste } = useMe();
  const roles = useRoles();
  const { t } = useT();
  const [waiting, setWaiting] = useState(0);
  const [topicsOpen, setTopicsOpen] = useState(false);

  // Moderators see how much is waiting each time they open Me.
  useEffect(() => {
    if (!focused || !roles.is_moderator || !REVIEW_ENABLED) return;
    Promise.all([supabase.rpc('get_review_queue'), supabase.rpc('get_report_queue')]).then(([u, r]) =>
      setWaiting((u.data?.length ?? 0) + (r.data?.length ?? 0)),
    );
  }, [focused, roles.is_moderator]);

  // Fresh numbers each time the tab comes into view.
  useEffect(() => {
    if (focused) reload();
  }, [focused, reload]);

  if (!current) return <View style={styles.root} />;

  const isAdult = current.lane === 'adult';
  const openParent = () => router.push({ pathname: '/parent', params: { child: isAdult ? undefined : current.id } });
  const used = minutes(t, todaySeconds);
  const limitText = limitMinutes ? t('parent.ofToday', { limit: minutes(t, limitMinutes * 60) }) : limitMinutes === 0 ? t('me.noTimeToday') : t('me.noLimit');

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg, paddingBottom: barSpace }]} showsVerticalScrollIndicator={false}>
        <Enter index={0} style={styles.head}>
          <Avatar name={current.display_name} avatar={current.avatar} lane={current.lane} size={AVATAR} />
          <View style={styles.headText}>
            <Text style={styles.name} numberOfLines={1} accessibilityRole="header">
              {current.display_name}
            </Text>
            <LaneBadge lane={current.lane} label={current.is_parent ? t(roleKey(current)) : undefined} />
          </View>
          {!linked && <IconButton icon="sliders" label={isAdult ? t('me.familyDashboard') : t('me.familyControls')} onPress={openParent} />}
        </Enter>

        {!isAdult && (
          <Enter index={1}>
            <Card>
              <View style={styles.todayRow}>
                <Text style={styles.todayLabel}>{t('me.stat.today')}</Text>
                <Text style={styles.todayValue}>
                  {used} {limitMinutes ? limitText : ''}
                </Text>
              </View>
              {!!limitMinutes && <ProgressBar progress={todaySeconds / (limitMinutes * 60)} label={`${used} ${limitText}`} />}
              {!limitMinutes && <Text style={styles.todaySub}>{limitText}</Text>}
            </Card>
          </Enter>
        )}

        <Enter index={2}>
          <ListGroup>
            <ListRow
              first
              icon="inbox"
              label={t('inbox.title')}
              value={unread > 0 ? <Badge label={t('me.newCount', { count: unread })} tone="danger" /> : undefined}
              onPress={() => router.push('/inbox')}
              accessibilityLabel={unread > 0 ? `${t('inbox.title')}, ${t('me.newCount', { count: unread })}` : t('inbox.title')}
            />
            <ListRow icon="save" label={t('me.stat.saved')} value={String(data?.saved ?? 0)} onPress={() => router.push('/saved')} />
            <ListRow icon="heart" label={t('me.stat.following')} value={String(data?.following ?? 0)} onPress={() => router.push('/following')} />
            <ListRow icon="star" label={t('me.myTopics')} onPress={() => setTopicsOpen(true)} />
          </ListGroup>
        </Enter>

        {!(linked && isAdult) && (
        <Enter index={3}>
          <ListGroup title={t('me.group.family')}>
            {!linked && <ListRow first icon="me" label={t('parent.editProfile')} onPress={() => router.push({ pathname: '/profile-edit', params: { id: current.id } })} />}
            {!isAdult && (
              <>
                {/* On a linked phone these only show the rules; the parent changes them from their own phone. */}
                <ListRow first={linked} icon="clock" label={t('me.dailyLimit')} value={limitMinutes != null ? minutes(t, limitMinutes * 60) : t('common.off')} chevron={!linked} onPress={linked ? undefined : openParent} />
                <ListRow icon="moon" label={t('me.quietHours')} value={current.quiet_hours ? t('common.on') : t('common.off')} chevron={!linked} onPress={linked ? undefined : openParent} />
              </>
            )}
            {isAdult && <ListRow icon="sliders" label={t('me.familyDashboard')} onPress={openParent} />}
            {isAdult && roles.is_creator && <ListRow icon="plus" label={t('me.creatorStudio')} onPress={() => router.push('/studio')} />}
            {isAdult && roles.is_moderator && REVIEW_ENABLED && (
              <ListRow icon="shield" label={t('me.review')} value={waiting > 0 ? <Badge label={String(waiting)} tone="danger" /> : undefined} onPress={() => router.push('/review')} />
            )}
          </ListGroup>
        </Enter>
        )}

        <Enter index={4}>
          <DeviceGroup />
        </Enter>

        {/* A child's own phone has nobody to switch to and nothing to sign out of: the parent removes it. */}
        {!(ownPhone && !isAdult) && (
          <Enter index={5}>
            <ListGroup title={t('me.group.account')}>
              {!ownPhone && <ListRow first icon="me" label={t('me.switchProfile')} onPress={leaveProfile} />}
              {/* Children reach Sign out through the parent PIN, so they can't sign the family out. */}
              {(isAdult || !linked) && <ListRow first={ownPhone} icon="logout" label={t('me.signOut')} onPress={isAdult ? signOut : openParent} />}
            </ListGroup>
          </Enter>
        )}

        {!isAdult && (
          <Enter index={6}>
            <Card>
              <Text style={styles.trustTitle}>{t('me.parentSees')}</Text>
              <Text style={styles.trustBody}>{t(PARENT_SEES[current.lane])}</Text>
            </Card>
          </Enter>
        )}
        <Text style={styles.footer}>{t('me.footer')}</Text>
      </ScrollView>

      <BottomSheet open={topicsOpen} onClose={() => setTopicsOpen(false)} title={t('me.myTopics')}>
        <View style={styles.sheet}>
          <TasteCard taste={data?.taste ?? []} onReset={resetTaste} delay={0} />
        </View>
      </BottomSheet>
      <StatusScrim />
    </View>
  );
}

/** Sounds, vibration, theme and language for this phone (every profile on it). */
function DeviceGroup() {
  const { t, lang } = useT();
  const [prefs, setPrefs] = useState(getFeedbackSettings);
  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const { theme } = useTheme();
  const flip = (key: 'sound' | 'haptics') => {
    const next = { ...prefs, [key]: !prefs[key] };
    setFeedbackSettings(next);
    setPrefs(next);
    fx.toggle(next[key]); // plays/buzzes only if the setting just turned on
  };
  return (
    <ListGroup title={t('me.group.device')}>
      <ListRow first icon="sound" label={t('me.sounds')} toggle={prefs.sound} onPress={() => flip('sound')} />
      <ListRow icon="vibrate" label={t('me.vibration')} toggle={prefs.haptics} onPress={() => flip('haptics')} />
      <ListRow icon="sparkle" label={t('me.theme')} value={t(theme === 'navy' ? 'me.themeNavy' : theme === 'light' ? 'me.themeLight' : 'me.themeDark')} onPress={() => setThemeOpen(true)} />
      <ListRow icon="discover" label={t('common.language')} value={LANGS.find((x) => x.code === lang)?.native} onPress={() => setLangOpen(true)} />
      <BottomSheet open={themeOpen} onClose={() => setThemeOpen(false)} title={t('me.theme')}>
        <View style={styles.sheet}>
          <ThemePicker />
          <Text style={styles.themeHint}>{t('me.themeHint')}</Text>
        </View>
      </BottomSheet>
      <BottomSheet open={langOpen} onClose={() => setLangOpen(false)} title={t('common.language')}>
        <View style={styles.sheet}>
          <LanguagePicker onPicked={() => setLangOpen(false)} />
        </View>
      </BottomSheet>
    </ListGroup>
  );
}

/** The face at the top of Me. */
const AVATAR = control.lg + space.lg;

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  content: { paddingHorizontal: layout.gutter, gap: layout.section },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  headText: { flex: 1, gap: space.sm, alignItems: 'flex-start' },
  name: { color: color.text, fontFamily: font.display, ...type.headline },
  todayRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md, marginBottom: space.sm },
  todayLabel: { color: color.text, fontFamily: font.bold, ...type.body },
  todayValue: { flexShrink: 1, color: color.text2, fontFamily: font.medium, ...type.small, textAlign: 'right' },
  todaySub: { color: color.text3, fontFamily: font.medium, ...type.small },
  trustTitle: { color: color.text, fontFamily: font.semibold, ...type.small },
  trustBody: { color: color.text2, fontFamily: font.medium, ...type.small, marginTop: space.xs },
  footer: { color: color.text3, fontFamily: font.medium, ...type.caption, textAlign: 'center' },
  sheet: { paddingHorizontal: space.xl, gap: space.md },
  themeHint: { color: color.text3, fontFamily: font.medium, ...type.small, textAlign: 'center' },
}));
