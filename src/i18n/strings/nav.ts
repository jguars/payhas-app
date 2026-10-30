import { defineStrings } from '../define';

/** The tab bar. Labels stay one short word: five share a 360 px phone. */
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
      discover: 'Açyşlar',
      play: 'Oýna',
      inbox: 'Hatlar',
      me: 'Men',
      inboxUnread: { one: 'Hatlar, {count} täze', other: 'Hatlar, {count} täze' },
    },
    tr: {
      home: 'Ana sayfa',
      discover: 'Keşfet',
      play: 'Oyna',
      inbox: 'Mesajlar',
      me: 'Ben',
      inboxUnread: { one: 'Mesajlar, {count} yeni', other: 'Mesajlar, {count} yeni' },
    },
    ru: {
      home: 'Главная',
      discover: 'Обзор',
      play: 'Играть',
      inbox: 'Входящие',
      me: 'Я',
      inboxUnread: { one: 'Входящие: {count} новое', few: 'Входящие: {count} новых', many: 'Входящие: {count} новых', other: 'Входящие: {count} новых' },
    },
  },
);
