// Reads an auction's tenancy from the court's Kurzgutachten / detail page HTML.
//
// Most reports have a "Bestandsverhältnisse" row. Others only mention tenancy
// in a free-text row such as "Sonstige Hinweise", so those rows are scanned too.
// A report that says nothing stays 'unknown': never guess, since the filter
// tells buyers whether a tenant comes with the flat.

// Boilerplate rows that talk about tenants in general, not about this property.
const IGNORED_ROWS = /^(sonstiges|wegen|dienststelle|aktenzeichen|versteigerungsort|grundbuch|lasten|erstellt von|alle edikte)/i;
// No bare "Mieter": viewing notices say "allfällige Mieter haben die Besichtigung zu dulden" on every page.
const TENANCY_WORDS = /\b(vermietet|verpachtet|Mietvertrag\w*|mietvertraglich\w*|Mietverhältnis\w*|leerstehend|unbewohnt|bestands?frei\w*|eigengenutzt|Eigengebrauch|Eigennutzung)\b/i;

function decode(html) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRows(html) {
  const rows = [];
  const re = /<span class="col-sm-3[^"]*">([\s\S]*?)<\/span>\s*<p class="col-sm-9">([\s\S]*?)<\/p>/gi;
  for (const m of html.matchAll(re)) rows.push({ label: decode(m[1]).replace(/:$/, ''), value: decode(m[2]) });
  return rows;
}

/** Returns the report's wording on tenancy, or '' if it has none. */
export function extractTenancyText(html) {
  const rows = parseRows(html);
  const field = rows.find((r) => /^Bestandsverh/i.test(r.label));
  if (field?.value) return field.value;

  // Split on a full stop after a letter, so dates like 01.02.2020 stay whole.
  return rows
    .filter((r) => !IGNORED_ROWS.test(r.label))
    .flatMap((r) => r.value.split(/(?<=\p{L}\.)\s+/u))
    // "Es wird vom Exekutionsgericht ... nicht beurteilt, ob dieser Mietvertrag wirksam ist" is a standard notice.
    .filter((sentence) => TENANCY_WORDS.test(sentence) && !/Exekutionsgericht/i.test(sentence))
    .join(' ')
    .slice(0, 600);
}

/**
 * 'unlimited' unbefristet vermietet
 * 'limited'   befristet vermietet
 * 'vacant'    no tenant: leerstehend, bestandfrei, owner-occupied
 * 'rented'    rented, term not stated (could still be unbefristet)
 * 'unknown'   the report doesn't say
 *
 * Order matters: "seit 2005 vermietet, seit 2007 unbefristet vermietet" must be
 * unlimited, and "nicht vermietet" must not count as rented.
 */
export function classifyTenancy(text) {
  if (!text) return 'unknown';

  // "keine Auskunft, ob das Mietverhältnis befristet ...": rented, but the report says the term is unclear.
  if (/\bob\b[^.]{0,60}befristet/i.test(text)) return 'rented';

  const unlimited = /\bunbefristet\w*\s+(vermietet|Miet\w*)|auf unbestimmte Zeit|Mietvertrag\w*\s+unbefristet/i;
  if (unlimited.test(text)) return 'unlimited';

  // "überwiegend (hauptsächlich befristet) vermietet": a mix, so some leases may be unbefristet.
  if (/(überwiegend|hauptsächlich|teilweise)\s+befristet/i.test(text)) return 'rented';

  // "allfällige Befristungen" (plural) is generic wording about missing documents.
  const limited = /\bbefristet(e[nrms]?)?\b|Befristungsend/i;
  if (limited.test(text)) return 'limited';

  // A valuation assumption is not a finding about who lives there.
  if (/Bestandsfreiheit vorausgesetzt/i.test(text)) return 'unknown';

  // Someone still lives there on a sublease, even if "keine Bestandrechte" follows.
  if (/\bUntermiet/i.test(text)) return 'rented';

  const vacant = /^(augenscheinlich\s+)?keine?s?\b|bestands?frei|leerstehend|steht .*\bleer\b|unbewohnt|eigengenutzt|Eigengebrauch|Eigennutzung|nicht vermietet|kein aufrechter Mietvertrag|keine (Miet|Bestand)/i;
  if (vacant.test(text)) return 'vacant';

  if (/\b(vermietet|verpachtet)\b|\bMieterin\b|\bMieter\b|\bMietvertrag|\bAnmietung\b/i.test(text)) return 'rented';

  return 'unknown';
}

/**
 * The wording to show on the public site. Reports can name tenants and owners,
 * so anything long or naming a person stays on the court's page, which the
 * dashboard links to.
 */
export function publicTenancyQuote(text) {
  if (!text || text.length > 160 || /\b(Frau|Herrn?|Dr\.|Mag\.|Ing\.)(\s|$)/.test(text)) return '';
  return text;
}
