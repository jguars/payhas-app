import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import { GAMES, isGameId } from '@/features/games/catalog';

/** Any game from the catalog, by id: /games/moles, /games/maze… */
export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { current } = useFamily();
  const [round, setRound] = useState(0);
  if (!current || !id || !isGameId(id)) return null;
  const { Component } = GAMES[id];
  return <Component key={round} lane={current.lane} onAgain={() => setRound((r) => r + 1)} />;
}
