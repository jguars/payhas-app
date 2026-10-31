import { router } from 'expo-router';

import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { ListGroup, ListRow } from '@/components/ui/List';
import { LinkedPhone } from '@/features/parent/devices';
import { confirmDestructive } from '@/features/parent/parts';
import { ago } from '@/features/parent/useParent';
import { useT } from '@/i18n';
import { fx } from '@/lib/feedback';

/**
 * A child's own phone, on that child's page: the one place it's linked and
 * removed — the phone and when it was last used, with Remove, or "Not linked
 * yet" with Link.
 */
export function ChildPhone({ child, phones, onRemove }: { child: { id: string; display_name: string }; phones: LinkedPhone[] | null; onRemove: (id: string) => Promise<boolean> }) {
  const { t } = useT();
  const toast = useToast();
  if (!phones) return null;
  const mine = phones.filter((p) => p.profile_id === child.id);
  const name = child.display_name;
  const remove = (p: LinkedPhone) =>
    confirmDestructive(t('parent.removePhoneTitle', { name: p.name }), t('parent.removePhoneBody'), t('parent.removePhone'), t('common.cancel'), async () => {
      if (!(await onRemove(p.id))) {
        fx.error();
        return toast({ text: t('parent.networkError'), icon: 'close' });
      }
      fx.success();
      toast({ text: t('parent.removedToast', { name: p.name }), icon: 'check' });
    });
  return (
    <ListGroup title={t('parent.phoneOf', { name })}>
      {mine.length === 0 ? (
        <ListRow
          first
          icon="link"
          label={t('parent.phoneNotLinked')}
          value={<Button size="sm" variant="secondary" label={t('parent.phoneLink')} onPress={() => router.push({ pathname: '/link-phone', params: { profile: child.id, name } })} />}
          chevron={false}
        />
      ) : (
        mine.map((p, i) => (
          <ListRow
            key={p.id}
            first={i === 0}
            icon="link"
            label={p.name}
            sub={p.status === 'pending' ? t('parent.phoneWaiting') : p.last_seen_at ? ago(t, Math.round((Date.now() - new Date(p.last_seen_at).getTime()) / 60_000)) : undefined}
            value={<Button size="sm" variant="secondary" label={t('parent.removePhone')} onPress={() => remove(p)} />}
            chevron={false}
          />
        ))
      )}
    </ListGroup>
  );
}
