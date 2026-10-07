import { useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import { MemoryMatch } from '@/features/games/MemoryMatch';

export default function MemoryScreen() {
  const { current } = useFamily();
  const [round, setRound] = useState(0);
  if (!current) return null;
  return <MemoryMatch key={round} lane={current.lane} onAgain={() => setRound((r) => r + 1)} />;
}
