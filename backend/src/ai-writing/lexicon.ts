/**
 * Small embedded English word lists used by the stylometric heuristics.
 *
 * These lists are hand-assembled for this experimental module. They are NOT
 * derived from a licensed frequency corpus and carry no claim of coverage or
 * ranking accuracy; they only need to be stable so results are reproducible.
 */

const words = (s: string): string[] => s.trim().split(/\s+/);

/** Closed-class English words (articles, pronouns, prepositions, auxiliaries, conjunctions). */
export const FUNCTION_WORDS: ReadonlySet<string> = new Set(
  words(`
  a an the this that these those
  i me my mine myself we us our ours ourselves you your yours yourself yourselves
  he him his himself she her hers herself it its itself they them their theirs themselves
  who whom whose which what whatever whoever where when why how
  am is are was were be been being have has had having do does did doing done
  will would shall should can could may might must ought
  and but or nor so yet for if then than because although though while whereas unless until since
  as at by from in into of off on onto out over through to toward towards under up upon with within without
  about above across after against along among around before behind below beneath beside between beyond
  down during except inside near outside past per via
  not no nor only very too also just even still already again
  all any both each either every few many more most much neither none other others own same several some such
  there here now
  i'm i've i'd i'll you're you've you'd you'll he's she's it's we're we've we'd we'll they're they've they'd they'll
  isn't aren't wasn't weren't don't doesn't didn't won't wouldn't can't cannot couldn't shouldn't haven't hasn't hadn't
  that's there's what's let's
`),
);

/**
 * Common English content words. A content word that is absent from this list
 * (and from FUNCTION_WORDS) is counted as "less common" by the vocabulary
 * rarity feature.
 */
export const COMMON_WORDS: ReadonlySet<string> = new Set(
  words(`
  time year people way day man woman child children world life hand part place case week company system program
  question work government number night point home water room mother father area money story fact month lot right
  study book eye job word business issue side kind head house service friend power hour game line end member law car
  city community name president team minute idea kid body information back parent face level office door health person
  art war history party result change morning reason research girl boy guy moment air teacher force education foot
  feet age policy process music market sense nation plan college interest death experience effect use class control
  care field development role effort rate heart drug show leader light voice wife husband police mind price report
  decision son daughter view relationship town road arm difference value building action model season society tax
  director position player record paper space ground form event official matter center couple site project activity
  star table need court oil situation cost industry figure street image phone data picture practice piece land product
  doctor wall patient worker news test movie north south east west love support technology step baby computer type
  attention film tree source organization hair window evidence population site skill problem school state family group
  country student thing example sound food term rule language problem behavior answer energy goal approach
  say said says get got make made go went gone know knew known take took taken see saw seen come came think thought
  look looked want wanted give gave given find found tell told ask asked seem seemed feel felt try tried leave left
  call called keep kept let begin began help helped talk talked turn turned start started show showed hear heard play
  played run ran move moved like liked live lived believe believed hold held bring brought happen happened write wrote
  written provide provided sit sat stand stood lose lost pay paid meet met include included continue continued set
  learn learned change changed lead led understand understood watch watched follow followed stop stopped create created
  speak spoke read allow allowed add added spend spent grow grew open opened walk walked win won offer offered
  remember remembered consider considered appear appeared buy bought wait waited serve served die died send sent expect
  expected build built stay stayed fall fell cut reach reached kill killed remain remained suggest suggested raise
  raised pass passed sell sold require required decide decided return returned explain explained hope hoped develop
  developed carry carried break broke receive received agree agreed support supported hit produce produced eat ate
  cover covered catch caught draw drew choose chose cause caused point pointed need needed use used work worked mean
  meant become became put means using making going getting looking working trying thinking
  good new first last long great little old big high different small large next early young important few public bad
  same able best better sure free true whole real full late hard major possible clear recent certain personal open
  simple easy strong special difficult available likely local social national human political economic
  natural physical final main short low single common poor happy serious ready quick simple fine nice black white red
  blue green dark general common past present future short wrong whole private
  well really often always never sometimes usually maybe probably actually quite almost later today together however
  away perhaps rather soon yes ago enough around else far ever instead once especially finally least less likely
  thus therefore sure indeed
  one two three four five six seven eight nine ten hundred thousand million second third half
  something nothing anything everything someone everyone anyone nobody somebody everybody thing things
  way ways lot lots kind kinds part parts years days people times words questions problems ideas
  important example examples different number numbers group groups country countries student students teacher teachers
  school schools family families friend friends idea person place places home house city state
`),
);

/**
 * Transition, signposting and hedging phrases. Elevated density of these is a
 * commonly cited (but far from exclusive) trait of LLM-generated prose; it is
 * also common in formulaic academic writing and in writers taught to use
 * explicit signposting, which is a documented false-positive risk.
 */
export const TRANSITION_PHRASES: readonly string[][] = [
  'furthermore',
  'moreover',
  'additionally',
  'consequently',
  'nevertheless',
  'nonetheless',
  'notably',
  'ultimately',
  'overall',
  'in conclusion',
  'in summary',
  'to summarize',
  'in addition',
  'as a result',
  'on the other hand',
  'it is important to note',
  'it is worth noting',
  'it is essential to',
  'it is crucial to',
  'plays a crucial role',
  'plays a vital role',
  'plays a significant role',
  'a testament to',
  'in today\'s',
  'delve',
  'delves',
  'crucial',
  'pivotal',
  'multifaceted',
  'tapestry',
  'underscores',
  'highlights the importance',
  'navigate the complexities',
  'foster',
  'fosters',
  'landscape',
  'arguably',
  'potentially',
  'it can be argued',
  'generally speaking',
  'in essence',
].map((p) => p.split(' '));

/** Abbreviations that should not end a sentence when followed by a period. */
export const ABBREVIATIONS: ReadonlySet<string> = new Set(
  words('mr mrs ms dr prof sr jr st vs etc e.g i.e fig no vol al approx inc ltd co dept est cf ca'),
);
