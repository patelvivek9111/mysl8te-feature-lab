export type AiOutcome = 'INCONCLUSIVE' | 'AI_WRITING_SIGNAL' | 'HUMAN_WRITING_SIGNAL';

export interface WritingFeatures {
  wordCount: number;
  sentenceCount: number;
  meanSentenceLength: number;
  sentenceLengthStdev: number;
  burstiness: number;
  typeTokenRatio: number;
  repeatedTrigramRate: number;
}

export interface AiResult {
  outcome: AiOutcome;
  consequentialUseEnabled: false;
  humanReviewRequired: true;
  uncertainty: 'high';
  reasons: string[];
  features: WritingFeatures;
  limitations: string;
}

export interface FixtureEvaluation {
  fixtureCount: number;
  labeledCases: number;
  correct: number;
  falsePositives: number;
  falsePositiveRate: number;
  accuracy: number;
  consequentialUseEnabled: false;
  note: string;
}

interface Fixture {
  id: string;
  label: 'human' | 'ai' | 'short' | 'mixed';
  text: string;
}

const LIMITATIONS = [
  'This is an experimental writing-signal heuristic, not an authorship classifier.',
  'It is not Turnitin, does not use Turnitin model weights, and is not evidence of misconduct.',
  'Consequential use is disabled. A teacher must review the writing itself.',
  'The bundled evaluation uses a tiny synthetic fixture set, not real student work.',
  'Short, mixed, paraphrased, and non-English writing is expected to be inconclusive.',
].join(' ');

export const FIXTURES: Fixture[] = [
  {
    id: 'human-varied',
    label: 'human',
    text: `I kept stalling on the opening. The assignment says "analyze," but the chapter mostly just follows Elizabeth while she is annoyed at Darcy, and I am still not sure the narrator wants us to trust her. Sometimes a sentence runs long because she is working something out. Then it stops. My seminar notes from Tuesday are messier than this paragraph, honestly. I do think the first line is doing more social work than plot work, though I would not bet a grade on that yet.`,
  },
  {
    id: 'human-anecdote',
    label: 'human',
    text: `Short line. When I reread the Gettysburg Address out loud, the brief sentences landed harder than the long one, and I tried explaining that to my roommate until the conversation wandered into a high-school debate that had nothing to do with Lincoln, the cemetery, or the assignment prompt at all. Not the point. The repetition of "we" feels deliberate. I am leaving the battlefield image alone because I cannot tell whether he is consoling the living or recruiting them.`,
  },
  {
    id: 'ai-uniform',
    label: 'ai',
    text: `It is important to note that the opening sentence establishes a social thesis. Furthermore, the narrative introduces eligible characters in a structured sequence. Moreover, the prose maintains a consistent explanatory tone throughout the paragraph. In addition, each claim is followed by a clarifying restatement of the same idea. Furthermore, the passage emphasizes general significance rather than a specific personal observation. Moreover, the sentences remain similar in length and function. In addition, the conclusion repeats the thesis using slightly different wording. It is important to note that this pattern continues across the entire response.`,
  },
  {
    id: 'ai-paraphrase-uniform',
    label: 'ai',
    text: `The text presents a widely accepted social observation about marriage and wealth. Furthermore, the community treats that observation as a fixed truth. Moreover, the paragraph explains how families interpret a new arrival. In addition, the writing restates the same relationship between fortune and marriage. Furthermore, the explanation remains abstract and evenly paced. Moreover, each sentence adds a formal qualifier instead of a concrete anecdote. In addition, the final sentence summarizes the previous sentences. It is important to note that the response avoids uncertainty and personal hesitation.`,
  },
  {
    id: 'short',
    label: 'short',
    text: 'The first sentence is ironic. I need more time to explain why.',
  },
  {
    id: 'mixed',
    label: 'mixed',
    text: `I think the irony is obvious, but I also want to be careful. Furthermore, the narrative introduces the theme of marriage in a structured way. My own margin note just says "who is laughing?" Moreover, the passage maintains a consistent explanatory tone. I still do not know if Austen expects sympathy for Mrs. Bennet. In addition, the paragraph concludes by restating its central observation.`,
  },
];

function sentences(text: string): string[] {
  return text.split(/[.!?]+/).map((part) => part.trim()).filter((part) => part.split(/\s+/).length > 1);
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z']+/g) ?? [];
}

export function featuresOf(text: string): WritingFeatures {
  const sentenceList = sentences(text);
  const wordList = words(text);
  const lengths = sentenceList.map((sentence) => words(sentence).length);
  const mean = lengths.length ? lengths.reduce((sum, value) => sum + value, 0) / lengths.length : 0;
  const variance = lengths.length ? lengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / lengths.length : 0;
  const stdev = Math.sqrt(variance);
  const unique = new Set(wordList);
  const trigrams: string[] = [];
  for (let i = 0; i < wordList.length - 2; i += 1) trigrams.push(wordList.slice(i, i + 3).join(' '));
  const counts = new Map<string, number>();
  for (const trigram of trigrams) counts.set(trigram, (counts.get(trigram) ?? 0) + 1);
  const repeated = [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
  return {
    wordCount: wordList.length,
    sentenceCount: sentenceList.length,
    meanSentenceLength: round(mean),
    sentenceLengthStdev: round(stdev),
    burstiness: mean === 0 ? 0 : round(stdev / mean),
    typeTokenRatio: wordList.length === 0 ? 0 : round(unique.size / wordList.length),
    repeatedTrigramRate: trigrams.length === 0 ? 0 : round(repeated / trigrams.length),
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function assessText(text: string): AiResult {
  const features = featuresOf(text);
  const reasons: string[] = [];
  let outcome: AiOutcome = 'INCONCLUSIVE';
  const formulaic = (text.toLowerCase().match(/\b(furthermore|moreover|in addition|it is important to note)\b/g) ?? []).length;
  if (features.wordCount < 80) {
    reasons.push('The text is shorter than 80 words, so the heuristic declines to score it.');
  } else if (formulaic >= 4 && features.burstiness < 0.3) {
    outcome = 'AI_WRITING_SIGNAL';
    reasons.push('The text repeats formulaic connectors such as "furthermore" and "moreover".');
    reasons.push('Sentence lengths are unusually uniform.');
  } else if (formulaic === 0 && features.burstiness > 0.45 && features.typeTokenRatio > 0.6) {
    outcome = 'HUMAN_WRITING_SIGNAL';
    reasons.push('Sentence lengths vary, and the formulaic connectors used in the synthetic AI fixtures are absent.');
  } else {
    reasons.push('The feature mix does not match either the synthetic human pattern or the synthetic AI pattern.');
    reasons.push(`Formulaic connector count: ${formulaic}. Burstiness: ${features.burstiness}.`);
  }
  reasons.push('This signal is not a probability of AI authorship.');
  return {
    outcome,
    consequentialUseEnabled: false,
    humanReviewRequired: true,
    uncertainty: 'high',
    reasons,
    features,
    limitations: LIMITATIONS,
  };
}

export function evaluateFixtures(fixtures: Fixture[] = FIXTURES): FixtureEvaluation {
  let labeledCases = 0;
  let correct = 0;
  let falsePositives = 0;
  let humanCases = 0;
  for (const fixture of fixtures) {
    const result = assessText(fixture.text);
    if (fixture.label === 'short' || fixture.label === 'mixed') {
      if (result.outcome !== 'INCONCLUSIVE') {
        labeledCases += 1;
      } else {
        labeledCases += 1;
        correct += 1;
      }
      continue;
    }
    labeledCases += 1;
    if (fixture.label === 'human') {
      humanCases += 1;
      if (result.outcome === 'AI_WRITING_SIGNAL') falsePositives += 1;
      if (result.outcome === 'HUMAN_WRITING_SIGNAL') correct += 1;
    }
    if (fixture.label === 'ai' && result.outcome === 'AI_WRITING_SIGNAL') correct += 1;
  }
  return {
    fixtureCount: fixtures.length,
    labeledCases,
    correct,
    falsePositives,
    falsePositiveRate: humanCases === 0 ? 0 : round(falsePositives / humanCases),
    accuracy: labeledCases === 0 ? 0 : round(correct / labeledCases),
    consequentialUseEnabled: false,
    note: 'Synthetic fixtures only. A passing fixture score does not validate use on student work, and consequential use stays disabled.',
  };
}
