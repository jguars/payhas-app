import { router, usePathname } from 'expo-router';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { PinPad } from '@/components/PinPad';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ListGroup, ListRow } from '@/components/ui/List';
import { useFamily } from '@/features/family/FamilyProvider';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { color, font, space, themedStyles, type } from '@/theme/tokens';

/**
 * A child's phone asking to join (supabase/functions/ask-family), seen from
 * the parent's phone. Requests are checked every few seconds while the app is
 * open; the sheet comes up wherever the parent is — but only in the parent's
 * own profile or on the parent screens, never while a child is watching on
 * this phone (Who's watching? shows a dot on the parent instead).
 */
export type JoinRequest = { id: string; device_name: string; match: string; created_at: string; expires_at: string };

const POLL_MS = 8000;
/** Parent screens: the sheet may come up here whoever's profile is open underneath. */
const PARENT_SCREENS = ['/parent', '/parent-child', '/parent-settings', '/link-phone', '/plus', '/profile-edit'];

type Ctx = { requests: JoinRequest[]; snoozed: boolean; reopen: () => void };
const JoinCtx = createContext<Ctx>({ requests: [], snoozed: false, reopen: () => {} });
export const useJoinRequests = () => useContext(JoinCtx);

export function JoinRequestsProvider({ children }: { children: ReactNode }) {
  const { session, device, family, current } = useFamily();
  const pathname = usePathname();
  const [loaded, setRequests] = useState<JoinRequest[]>([]);
  // "Later": that request stays quiet until the dashboard row reopens it.
  const [snoozedIds, setSnoozedIds] = useState<string[]>([]);
  // Only a parent's phone: the owner (no device row) or a co-parent.
  const isParentPhone = !!session && !!family?.onboarded_at && (!device || device.kind === 'coparent');

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('pending_join_requests');
    if (!error) setRequests(data ?? []);
  }, []);

  useEffect(() => {
    if (!isParentPhone) return;
    const first = setTimeout(load, 0);
    let id = setInterval(load, POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      clearInterval(id);
      if (state === 'active') {
        load();
        id = setInterval(load, POLL_MS);
      }
    });
    return () => {
      clearTimeout(first);
      clearInterval(id);
      sub.remove();
    };
  }, [isParentPhone, load]);

  // Signed out, or not a parent's phone: nothing, whatever was loaded before.
  const requests = useMemo(() => (isParentPhone ? loaded : []), [isParentPhone, loaded]);
  const top = requests.find((r) => !snoozedIds.includes(r.id)) ?? null;
  const parentHere = !!current?.is_parent || PARENT_SCREENS.includes(pathname);
  const value = useMemo(
    () => ({ requests, snoozed: requests.length > 0 && !top, reopen: () => setSnoozedIds([]) }),
    [requests, top],
  );

  return (
    <JoinCtx.Provider value={value}>
      {children}
      {top && (
        <RequestSheet
          // A new request starts fresh: nothing picked, no PIN pad.
          key={top.id}
          request={top}
          open={parentHere}
          onDone={(id) => {
            setRequests((rs) => rs.filter((r) => r.id !== id));
            load();
          }}
          onLater={(id) => setSnoozedIds((ids) => [...ids, id])}
        />
      )}
    </JoinCtx.Provider>
  );
}

/** The request: the phone and its match number, which child it's for, then the PIN. */
function RequestSheet({ request, open, onDone, onLater }: { request: JoinRequest; open: boolean; onDone: (id: string) => void; onLater: (id: string) => void }) {
  const { t } = useT();
  const { profiles } = useFamily();
  const toast = useToast();
  const [picked, setPicked] = useState<string | null>(null);
  const [step, setStep] = useState<'pick' | 'pin'>('pick');
  const [busy, setBusy] = useState(false);
  const kids = profiles.filter((p) => !p.is_parent);
  const child = kids.find((p) => p.id === picked);

  const gone = () => {
    fx.error();
    toast({ text: t('ask.gone'), icon: 'close' });
    onDone(request.id);
  };

  const decline = async () => {
    if (busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('answer_join_request', { p_request: request.id, p_allow: false });
    setBusy(false);
    if (error) return toast({ text: t('parent.networkError'), icon: 'close' });
    if (data === 'gone') return gone();
    fx.success();
    toast({ text: t('ask.declinedToast'), icon: 'check' });
    onDone(request.id);
  };

  return (
    <BottomSheet open={open} onClose={() => onLater(request.id)} title={step === 'pin' ? undefined : t('ask.sheetTitle')}>
      {step === 'pin' ? (
        <View style={styles.pin}>
          <PinPad
            title={t('ask.pinTitle')}
            onCancel={() => setStep('pick')}
            onComplete={async (pin) => {
              const { data, error } = await supabase.rpc('answer_join_request', { p_request: request.id, p_allow: true, p_profile: picked, p_pin: pin });
              if (error) return error.message;
              if (data === 'bad_pin') return false;
              if (data !== 'ok') {
                gone();
                return true;
              }
              toast({ text: t('ask.allowedToast', { name: child?.display_name ?? '' }), icon: 'check' });
              onDone(request.id);
              return true;
            }}
          />
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.matchBox}>
            <Text style={styles.match} accessibilityLabel={request.match.split('').join(' ')}>
              {request.match}
            </Text>
            <Text style={styles.device}>{request.device_name}</Text>
            <Text style={styles.hint}>{t('ask.matchHint')}</Text>
          </View>
          <Text style={styles.label}>{t('ask.whoFor')}</Text>
          {kids.length === 0 && <Text style={styles.hint}>{t('ask.noChildren')}</Text>}
          <View style={styles.chips}>
            {kids.map((k) => (
              <Chip key={k.id} label={k.display_name} selected={picked === k.id} accessibilityRole="radio" onPress={() => setPicked(k.id)} />
            ))}
            <Chip
              label={t('ask.newChild')}
              icon="plus"
              accessibilityRole="button"
              onPress={() => {
                onLater(request.id);
                router.push('/add-child');
              }}
            />
          </View>
          <Button label={t('ask.allow')} disabled={!picked || busy} onPress={() => setStep('pin')} />
          <View style={styles.row}>
            <View style={styles.grow}>
              <Button variant="secondary" label={t('ask.decline')} loading={busy} onPress={decline} />
            </View>
            <View style={styles.grow}>
              <Button variant="quiet" label={t('ask.later')} onPress={() => onLater(request.id)} />
            </View>
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

/** On the dashboard: a request put off with "Later", one tap from the sheet again. */
export function JoinRequestRow() {
  const { t } = useT();
  const { snoozed, reopen } = useJoinRequests();
  if (!snoozed) return null;
  return (
    <ListGroup>
      <ListRow first icon="link" label={t('ask.rowTitle')} sub={t('ask.rowSub')} onPress={reopen} />
    </ListGroup>
  );
}

const styles = themedStyles(() => ({
  body: { gap: space.md },
  pin: { alignItems: 'center', paddingVertical: space.md },
  matchBox: { alignItems: 'center', gap: space.xs, paddingVertical: space.sm },
  match: { color: color.text, fontFamily: font.display, ...type.hero, letterSpacing: space.sm },
  device: { color: color.text, fontFamily: font.semibold, ...type.body },
  hint: { color: color.text3, fontFamily: font.medium, ...type.small, textAlign: 'center' },
  label: { color: color.text, fontFamily: font.semibold, ...type.small },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  grow: { flex: 1 },
}));
