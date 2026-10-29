-- Payhas: eight more games in the Play tab. Their time counts toward screen
-- time exactly like Bubble Pop and Memory Match.
alter table public.watch_events drop constraint watch_events_game_check;
alter table public.watch_events
  add constraint watch_events_game_check check (game in (
    'bubbles', 'memory', 'moles', 'echo', 'catch', 'odd', 'count', 'slide', 'maze', 'three'
  ));
