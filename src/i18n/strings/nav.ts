import { defineStrings } from '../define';

/** The tab bar. Labels stay short (one word where the language allows): five share a 360 px phone. */
export default defineStrings(
  {
    home: 'Home',
    discover: 'Discover',
    play: 'Play',
    inbox: 'Inbox',
    me: 'Me',
    inboxUnread: { one: 'Inbox, {count} new', other: 'Inbox, {count} new' },
  },
  {
    tk: {
      home: 'Baş sahypa',
      discover: 'Gözle',
      play: 'Oýna',
      inbox: 'Habarlar',
      me: 'Men',
      inboxUnread: { one: 'Habarlar, {count} täze', other: 'Habarlar, {count} täze' },
    },
    tr: {
      home: 'Ana sayfa',
      discover: 'Keşfet',
      play: 'Oyna',
      inbox: 'Bildirimler',
      me: 'Ben',
      inboxUnread: { one: 'Bildirimler, {count} yeni', other: 'Bildirimler, {count} yeni' },
    },
    ru: {
      home: 'Главная',
      discover: 'Обзор',
      play: 'Игры',
      inbox: 'Входящие',
      me: 'Я',
      inboxUnread: { one: 'Входящие: {count} новое сообщение', few: 'Входящие: {count} новых сообщения', many: 'Входящие: {count} новых сообщений', other: 'Входящие: {count} нового сообщения' },
    },
  },
);
