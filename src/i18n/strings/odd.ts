import { defineStrings } from '../define';

/** Odd One Out: every tile is the same except one. */
export default defineStrings(
  {
    name: 'Odd One Out',
    'sub.little': 'Find the animal that’s different',
    'sub.kids': 'Find the different one · {s} sec',
    'sub.hard': 'Spot the tiny difference · {s} sec',
    'readout.found': 'Found',
    finds: { one: '{count} found', other: '{count} found' },
    sharpEyes: 'Sharp eyes!',
  },
  {
    tk: {
      name: 'Başgaçasyny tap',
      'sub.little': 'Başgaça haýwany tap',
      'sub.kids': 'Başgaçasyny tap · {s} sek',
      'sub.hard': 'Kiçijik tapawudy gör · {s} sek',
      'readout.found': 'Tapylan',
      finds: { one: 'Tapylan: {count}', other: 'Tapylan: {count}' },
      sharpEyes: 'Gözüň ýiti eken!',
    },
    tr: {
      name: 'Farklı Olanı Bul',
      'sub.little': 'Farklı olan hayvanı bul',
      'sub.kids': 'Farklı olanı bul · {s} sn',
      'sub.hard': 'Küçücük farkı yakala · {s} sn',
      'readout.found': 'Bulunan',
      finds: { one: '{count} buldun', other: '{count} buldun' },
      sharpEyes: 'Keskin gözler!',
    },
    ru: {
      name: 'Кто лишний?',
      'sub.little': 'Найди зверька, который не такой',
      'sub.kids': 'Найди лишнее · {s} с',
      'sub.hard': 'Найди крошечное отличие · {s} с',
      'readout.found': 'Найдено',
      finds: { one: 'Найдено: {count}', few: 'Найдено: {count}', many: 'Найдено: {count}', other: 'Найдено: {count}' },
      sharpEyes: 'Зоркий глаз!',
    },
  },
);
