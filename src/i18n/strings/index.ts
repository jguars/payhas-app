import ask from './ask';
import auth from './auth';
import catchGame from './catch';
import common from './common';
import count from './count';
import creator from './creator';
import discover from './discover';
import echo from './echo';
import feed from './feed';
import inbox from './inbox';
import maze from './maze';
import me from './me';
import moles from './moles';
import nav from './nav';
import odd from './odd';
import onboarding from './onboarding';
import parent from './parent';
import play from './play';
import plus from './plus';
import slide from './slide';
import three from './three';

/** Every namespace; keys are `<namespace>.<key>`, e.g. t('feed.like'). Each game past the first two has its own. */
export const STRINGS = { ask, auth, catch: catchGame, common, count, creator, discover, echo, feed, inbox, maze, me, moles, nav, odd, onboarding, parent, play, plus, slide, three };

type NS = typeof STRINGS;
export type TKey = { [N in keyof NS]: `${N & string}.${keyof NS[N]['en'] & string}` }[keyof NS];
