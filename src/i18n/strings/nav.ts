import { defineStrings } from '../define';

/** The floating tab bar. */
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
      inbox: 'Gelen hatlar',
      me: 'Men',
      inboxUnread: { one: 'Gelen hatlar, {count} täze', other: 'Gelen hatlar, {count} täze' },
    },
    tr: {
      home: 'Ana sayfa',
      discover: 'Keşfet',
      play: 'Oyna',
      inbox: 'Gelen kutusu',
      me: 'Ben',
      inboxUnread: { one: 'Gelen kutusu, {count} yeni', other: 'Gelen kutusu, {count} yeni' },
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
