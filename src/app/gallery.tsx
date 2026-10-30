import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { LaneBadge } from '@/components/LaneBadge';
import { Segmented } from '@/components/Segmented';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { ListGroup, ListRow } from '@/components/ui/List';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { TextField } from '@/components/ui/TextField';
import { useInsets } from '@/lib/useInsets';
import { color, font, layout, pageFill, space, themedStyles, type } from '@/theme/tokens';

/**
 * The component gallery: every shared component in every variant and state,
 * in the current theme. Not linked from the app — open /gallery. Screenshot
 * it in all three themes after any change to `components/ui` or the tokens.
 * Copy here is English only on purpose (a design tool, not a user screen).
 */
export default function GalleryScreen() {
  const { top, bottom } = useInsets();
  const [seg, setSeg] = useState('Saved');
  const [chips, setChips] = useState(['Animals']);
  const [on, setOn] = useState(true);
  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: top + space.md, paddingBottom: bottom + space.xxxl }]}>
      <PageHeader back title="Components" subtitle={`Payhas UI · ${color.scheme === 'light' ? 'Light' : color.bg === '#0A0A0F' ? 'Dark' : 'Navy'}`} />

      <Section title="Buttons">
        <Button label="Start watching" />
        <Button label="Add a child" variant="secondary" icon="plus" />
        <Button label="Continue" disabled />
        <Button label="Saving" loading />
        <View style={styles.row}>
          <Button label="Pause" size="sm" variant="secondary" icon="pause" />
          <Button label="15 min" size="sm" variant="secondary" icon="plus" />
          <Button label="Play" size="sm" />
        </View>
        <View style={styles.row}>
          <Button label="Not now" size="sm" variant="quiet" />
          <Button label="Delete profile" size="sm" variant="destructive" />
          <IconButton icon="close" label="Close" />
          <IconButton icon="back" label="Back" plain />
        </View>
      </Section>

      <Section title="Cards">
        <Card>
          <Text style={styles.title}>Parent card (flat)</Text>
          <Text style={styles.body}>Calm areas: dashboard, Plus, settings.</Text>
        </Card>
        <Card tactile>
          <Text style={styles.title}>Child card (tactile)</Text>
          <Text style={styles.body}>Sits on a ledge: Play, Discover, Me.</Text>
        </Card>
        <Card hero tactile>
          <Text style={styles.title}>Hero card</Text>
          <Text style={styles.body}>Featured game, plan hero — large radius.</Text>
          <Button label="Play" size="sm" />
        </Card>
      </Section>

      <Section title="List">
        <ListGroup title="Account" footer="Group footer for a short note.">
          <ListRow first leading={<Avatar name="Aylar" avatar="bear" lane="kids" size={44} />} label="Aylar" sub="Kids · In the app now" value="15 of 60 min" onPress={() => {}} />
          <ListRow icon="sparkle" label="Payhas Plus" value="Free" onPress={() => {}} />
          <ListRow icon="send" label="Alerts on this phone" sub="Limits, flags and requests" toggle={on} onPress={() => setOn((v) => !v)} />
          <ListRow icon="lock" label="Lock dashboard" onPress={() => {}} />
          <ListRow icon="close" label="Sign out" danger onPress={() => {}} />
        </ListGroup>
      </Section>

      <Section title="Selection — one selected style">
        <View style={styles.wrap}>
          {['Animals', 'Science', 'Drawing', 'Space'].map((c) => (
            <Chip key={c} label={c} selected={chips.includes(c)} onPress={() => setChips((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))} />
          ))}
        </View>
        <Segmented words options={['Saved', 'Taste', 'History']} value={seg} onChange={setSeg} label={(v) => v} />
      </Section>

      <Section title="Badges">
        <View style={styles.wrap}>
          <Badge label="Free" />
          <Badge label="Plus" tone="plus" icon="sparkle" />
          <Badge label="On" tone="success" />
          <Badge label="Flagged" tone="danger" />
          <LaneBadge lane="little" />
          <LaneBadge lane="kids" />
          <LaneBadge lane="teen" />
          <LaneBadge lane="adult" label="Parent" />
        </View>
      </Section>

      <Section title="Inputs">
        <TextField label="Name" placeholder="Child’s name" />
        <TextField label="Activation code" code placeholder="PAYH-XXXX-XXXX-XXXX" hint="16 letters and numbers" />
        <TextField label="Email" value="not-an-email" error="That email doesn’t look right." />
      </Section>

      <Section title="Progress">
        <ProgressBar progress={0.25} />
        <ProgressBar progress={1} />
        <ProgressBar progress={0.6} thin />
      </Section>

      <Section title="Empty state">
        <Card>
          <EmptyState icon="save" title="Nothing saved yet" body="Tap the bookmark on a video to keep it here." action="Explore videos" />
        </Card>
      </Section>

      <SectionHeader title="Section header" subtitle="With a quiet action" action="See all" onAction={() => {}} />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, ...pageFill() },
  content: { paddingHorizontal: layout.gutter, gap: layout.section },
  section: { gap: space.md },
  sectionTitle: { color: color.text3, fontFamily: font.bold, ...type.caption, textTransform: 'uppercase' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  title: { color: color.text, fontFamily: font.title, ...type.lead },
  body: { color: color.text2, fontFamily: font.medium, ...type.small },
}));
