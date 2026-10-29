import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import { GAMES, isGameId } from '@/features/games/catalog';
import { useProfilePlan } from '@/features/plan/usePlan';

/** Any game from the catalog, by id: /games/moles, /games/maze… */
export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { current } = useFamily();
  const [round, setRound] = useState(0);
  const { plan, gameOpen } = useProfilePlan();
  if (!current || !id || !isGameId(id)) return null;
  // A game the plan doesn't include (e.g. a stale deep link) goes back to Play.
  if (plan && !gameOpen(id)) return <Redirect href="/play" />;
  const { Component } = GAMES[id];
  return <Component key={round} lane={current.lane} onAgain={() => setRound((r) => r + 1)} />;
}
