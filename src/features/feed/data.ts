import type { Lane } from '@/theme/tokens';

export type FeedVideo = {
  id: string;
  source: number; // require()'d local asset until the video backend exists
  thumb: number; // poster frame, same story
  creator: { name: string; verified: boolean };
  caption: string;
  lane: Lane; // youngest lane the video is rated for
  topics: string[];
  likes: number;
  comments: number;
};

/** Seed content: the three clips from the payhas folder. */
export const seedFeed: FeedVideo[] = [
  {
    id: 'eyes-rhyme',
    source: require('../../../assets/videos/eyes-rhyme.mp4'),
    thumb: require('../../../assets/thumbs/eyes-rhyme.jpg'),
    creator: { name: 'Children Rhymes', verified: true },
    caption: 'Where are your eyes? Point along and sing!',
    lane: 'little',
    topics: ['rhymes', 'learning'],
    likes: 24100,
    comments: 860,
  },
  {
    id: 'playground',
    source: require('../../../assets/videos/playground.mp4'),
    thumb: require('../../../assets/thumbs/playground.jpg'),
    creator: { name: 'Chubby Playhouse', verified: true },
    caption: "Water-balloon day — who's going to giggle first?",
    lane: 'little',
    topics: ['play', 'stories'],
    likes: 18700,
    comments: 412,
  },
  {
    id: 'bunny',
    source: require('../../../assets/videos/bunny.mp4'),
    thumb: require('../../../assets/thumbs/bunny.jpg'),
    creator: { name: 'Benny the Bunny', verified: false },
    caption: 'Benny says hi from the card shop!',
    lane: 'little',
    topics: ['animals', 'puppets'],
    likes: 9300,
    comments: 157,
  },
];

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}
