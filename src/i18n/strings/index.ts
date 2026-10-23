import auth from './auth';
import common from './common';
import creator from './creator';
import discover from './discover';
import feed from './feed';
import inbox from './inbox';
import me from './me';
import nav from './nav';
import onboarding from './onboarding';
import parent from './parent';
import play from './play';

/** Every namespace; keys are `<namespace>.<key>`, e.g. t('feed.like'). */
export const STRINGS = { auth, common, creator, discover, feed, inbox, me, nav, onboarding, parent, play };

type NS = typeof STRINGS;
export type TKey = { [N in keyof NS]: `${N & string}.${keyof NS[N]['en'] & string}` }[keyof NS];
