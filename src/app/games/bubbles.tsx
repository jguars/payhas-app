import { useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import { BubblePop } from '@/features/games/BubblePop';

export default function BubblesScreen() {
  const { current } = useFamily();
  const [round, setRound] = useState(0);
  if (!current) return null;
  return <BubblePop key={round} lane={current.lane} onAgain={() => setRound((r) => r + 1)} />;
}
