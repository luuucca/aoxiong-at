// What is actually being sold. The court's categories describe the legal form:
// "Wohnungseigentumsobjekt" covers flats, shops, offices and parking alike, so
// the unit description decides those. Building descriptions mention words like
// "Zinshaus" for a flat inside one, so only the start of the text is read.
//
// A type set by hand after reading the report is kept by the daily fetch.

const HEAD_CHARS = 140;

export function classifyPropertyType({ categoryRaw = '', text = '' }) {
  const head = text.replace(/\s+/g, ' ').slice(0, HEAD_CHARS);

  if (/bebaubare Liegenschaft|unbebaut|Grundstück|Baurecht/i.test(categoryRaw)) return '地皮';
  if (/Mietshaus|Mietwohnhaus|Mehrfamilienhaus|gemischt genutzt/i.test(categoryRaw)) return '出租楼';
  if (/Einfamilienhaus|Zweifamilienhaus|Reihenhaus|Villa/i.test(categoryRaw)) return '独栋住宅';
  if (/Geschäftslokal/i.test(categoryRaw)) return '店铺';
  if (/gewerbliche Liegenschaft|Büro/i.test(categoryRaw)) return '办公商业';

  if (/Kfz|Stellplatz|Abstellplatz|Garagenplatz/i.test(head)) return '车位';
  if (/Rohdachboden/i.test(head)) return '阁楼毛坯';
  if (/Geschäftslokal|Geschäft\s*(Top\s*)?\d|Lokal\s*(Top\s*)?\d|Verkaufslokal/i.test(head)) return '店铺';
  if (/Büro|Ordination|Werkstätte|Werkstatt|Tankstelle/i.test(head)) return '办公商业';

  if (/Eigentumswohnung|Dachgeschoßwohnung|Wohnungseigentumsobjekt/i.test(categoryRaw)) return '公寓';
  return '其他';
}
