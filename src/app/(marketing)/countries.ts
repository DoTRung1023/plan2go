/**
 * Every country a trip can be in, as ISO 3166-1 alpha-2.
 *
 * Written out because there is no way to ask a browser or a runtime for the
 * list. The names are not written out: those come from the platform, which
 * already knows them and spells them the way the reader's own tools do.
 */
const CODES =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW";

export interface Country {
  /** ISO 3166-1 alpha-2, which is what the place search is narrowed by. */
  readonly code: string;
  readonly name: string;
}

/**
 * The countries with the names this runtime knows them by, in alphabetical
 * order. Read on the server, so the browser is not asked to build it.
 */
export function countries(): readonly Country[] {
  const names = new Intl.DisplayNames(["en"], { type: "region" });

  return CODES.split(" ")
    .map((code) => ({ code, name: names.of(code) ?? code }))
    // A runtime that does not know a code answers with the code itself, and a
    // list with "BQ" in it among the names is worse than a list without it.
    .filter((country) => country.name !== country.code)
    .sort((one, other) => one.name.localeCompare(other.name));
}
