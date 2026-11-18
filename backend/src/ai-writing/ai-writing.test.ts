import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import {
  MODEL_VERSION,
  RELEASE_GATES,
  assessAiWriting,
  computeAuroc,
  evaluate,
  resolveReleaseGate,
  type LabeledSample,
} from './index';

const smoke: LabeledSample[] = fs
  .readFileSync(path.resolve(__dirname, '../../eval-data/ai-writing/smoke.jsonl'), 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

const joinLabel = (label: string) =>
  smoke
    .filter((s) => s.label === label)
    .map((s) => s.text)
    .join('\n\n');

const HUMAN_LONG = joinLabel('human');
const HUMAN_SHORTER = smoke
  .filter((s) => s.label === 'human')
  .slice(0, 2)
  .map((s) => s.text)
  .join('\n\n');
const AI_LONG = joinLabel('ai');

const SPANISH = Array.from(
  { length: 6 },
  () =>
    'La educación es un derecho fundamental para todas las personas del mundo. Los estudiantes aprenden mejor cuando ' +
    'tienen profesores motivados y recursos suficientes en sus escuelas. Muchas familias trabajan mucho para que sus ' +
    'hijos puedan estudiar en la universidad. Sin embargo, todavía existen grandes diferencias entre las ciudades y ' +
    'los pueblos pequeños. El gobierno debería invertir más dinero en bibliotecas, tecnología y formación docente. ' +
    'También es importante que los jóvenes lean libros fuera de clase y participen en actividades culturales.',
).join('\n\n');

describe('assessAiWriting', () => {
  it('returns INSUFFICIENT_TEXT with null score for short text', () => {
    const r = assessAiWriting('This is a short paragraph that is far below the minimum length for any assessment.');
    expect(r.status).toBe('INSUFFICIENT_TEXT');
    expect(r.score).toBeNull();
    expect(r.interval).toBeNull();
    expect(r.features).toEqual([]);
    expect(r.segments).toEqual([]);
  });

  it('respects minWords option', () => {
    expect(assessAiWriting(HUMAN_SHORTER, { minWords: 5000 }).status).toBe('INSUFFICIENT_TEXT');
    expect(assessAiWriting(HUMAN_SHORTER, { minWords: 100 }).score).not.toBeNull();
  });

  it('returns UNSUPPORTED_LANGUAGE for non-English text', () => {
    const r = assessAiWriting(SPANISH);
    expect(r.wordCount).toBeGreaterThanOrEqual(300);
    expect(r.language).toBe('unknown');
    expect(r.status).toBe('UNSUPPORTED_LANGUAGE');
    expect(r.score).toBeNull();
  });

  it('is deterministic for the same input', () => {
    expect(assessAiWriting(HUMAN_LONG)).toEqual(assessAiWriting(HUMAN_LONG));
    expect(assessAiWriting(AI_LONG)).toEqual(assessAiWriting(AI_LONG));
  });

  it('interval contains the score and narrows as text grows', () => {
    const short = assessAiWriting(HUMAN_SHORTER);
    const long = assessAiWriting(HUMAN_LONG);
    for (const r of [short, long, assessAiWriting(AI_LONG)]) {
      expect(r.score).not.toBeNull();
      expect(r.interval).not.toBeNull();
      expect(r.interval!.low).toBeLessThanOrEqual(r.score!);
      expect(r.interval!.high).toBeGreaterThanOrEqual(r.score!);
      expect(r.score!).toBeGreaterThanOrEqual(0);
      expect(r.score!).toBeLessThanOrEqual(1);
    }
    const width = (r: typeof short) => r.interval!.high - r.interval!.low;
    expect(width(long)).toBeLessThan(width(short));
  });

  it('interval contains the score for every smoke sample', () => {
    for (const s of smoke) {
      const r = assessAiWriting(s.text, { minWords: 100 });
      expect(r.interval!.low).toBeLessThanOrEqual(r.score!);
      expect(r.interval!.high).toBeGreaterThanOrEqual(r.score!);
      if (r.status === 'SIGNALS_FOR_REVIEW') expect(r.interval!.low).toBeGreaterThanOrEqual(0.55);
    }
  });

  it('keeps very short assessed texts wide and inconclusive', () => {
    const r = assessAiWriting(smoke[0].text.split('\n\n')[0], { minWords: 20 });
    expect(r.interval!.high - r.interval!.low).toBeGreaterThan(0.35);
    expect(r.status).toBe('INCONCLUSIVE');
  });

  it('reports EXPERIMENTAL, unvalidated release gate by default', () => {
    for (const t of ['short', HUMAN_LONG, SPANISH]) {
      const r = assessAiWriting(t);
      expect(r.releaseGate).toMatchObject({ stage: 'EXPERIMENTAL', validated: false, evaluationId: null });
      expect(r.modelVersion).toBe(MODEL_VERSION);
    }
  });

  it('always includes safeguards', () => {
    for (const t of ['', 'short', HUMAN_LONG, AI_LONG, SPANISH]) {
      const r = assessAiWriting(t);
      expect(r.safeguards.length).toBeGreaterThan(0);
      expect(r.safeguards.join(' ')).toMatch(/Not evidence of misconduct/);
      expect(r.safeguards.join(' ')).toMatch(/human review/i);
      expect(r.safeguards.join(' ')).toMatch(/non-native English/);
    }
  });

  it('returns valid segment offsets', () => {
    const r = assessAiWriting(AI_LONG);
    expect(r.status).toBe('SIGNALS_FOR_REVIEW');
    expect(r.segments.length).toBeGreaterThan(0);
    let prevEnd = 0;
    for (const s of r.segments) {
      expect(Number.isInteger(s.start) && Number.isInteger(s.end)).toBe(true);
      expect(s.start).toBeGreaterThanOrEqual(prevEnd);
      expect(s.end).toBeGreaterThan(s.start);
      expect(s.end).toBeLessThanOrEqual(AI_LONG.length);
      expect(AI_LONG.slice(s.start, s.end).trim()).toBe(AI_LONG.slice(s.start, s.end));
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
      prevEnd = s.end;
    }
  });

  it('returns no segments when there are no notable signals', () => {
    const r = assessAiWriting(HUMAN_LONG);
    expect(r.status).toBe('NO_NOTABLE_SIGNALS');
    expect(r.segments).toEqual([]);
  });

  it('features carry baselines, direction and explanation', () => {
    const r = assessAiWriting(AI_LONG);
    expect(r.features.length).toBeGreaterThan(5);
    for (const f of r.features) {
      expect(f.baseline.low).toBeLessThan(f.baseline.high);
      expect(['typical', 'atypical']).toContain(f.direction);
      expect(f.explanation.length).toBeGreaterThan(0);
    }
  });
});

describe('paraphrase signal', () => {
  it('is null with explanation when no similarity context is supplied', () => {
    const r = assessAiWriting(HUMAN_LONG);
    expect(r.paraphraseSignal.score).toBeNull();
    expect(r.paraphraseSignal.basis).toMatch(/No similarity context/);
  });

  it('reports a signal when near matches dominate exact matches', () => {
    const r = assessAiWriting(HUMAN_LONG, {
      similarityContext: { nearMatchWords: 240, exactMatchWords: 20, totalWords: 600 },
    });
    expect(r.paraphraseSignal.score).not.toBeNull();
    expect(r.paraphraseSignal.score!).toBeGreaterThan(0.5);
    expect(r.paraphraseSignal.score!).toBeLessThanOrEqual(1);
    expect(r.paraphraseSignal.basis).toMatch(/240 of 600/);
  });

  it('is null when matches are mostly exact or too few', () => {
    const exact = assessAiWriting('short', { similarityContext: { nearMatchWords: 30, exactMatchWords: 300, totalWords: 600 } });
    expect(exact.paraphraseSignal.score).toBeNull();
    expect(exact.paraphraseSignal.basis).toMatch(/Insufficient evidence/);
    const few = assessAiWriting('short', { similarityContext: { nearMatchWords: 10, exactMatchWords: 2, totalWords: 600 } });
    expect(few.paraphraseSignal.score).toBeNull();
    const invalid = assessAiWriting('short', { similarityContext: { nearMatchWords: -1, exactMatchWords: 2, totalWords: 0 } });
    expect(invalid.paraphraseSignal.score).toBeNull();
    expect(invalid.paraphraseSignal.basis).toMatch(/invalid/);
  });

  it('increases with near-match coverage', () => {
    const at = (near: number) =>
      assessAiWriting('x', { similarityContext: { nearMatchWords: near, exactMatchWords: 10, totalWords: 1000 } }).paraphraseSignal
        .score!;
    expect(at(300)).toBeGreaterThan(at(150));
  });
});

describe('release gate record', () => {
  const tmp = (contents: unknown) => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'aiw-')), 'validated-evaluation.json');
    fs.writeFileSync(file, typeof contents === 'string' ? contents : JSON.stringify(contents));
    return file;
  };

  it('stays EXPERIMENTAL for missing, malformed, failing or mismatched records', () => {
    expect(resolveReleaseGate('/nonexistent/validated-evaluation.json').validated).toBe(false);
    expect(resolveReleaseGate(tmp('{not json')).validated).toBe(false);
    expect(resolveReleaseGate(tmp({ gatesPassed: false, evaluationId: 'e1', modelVersion: MODEL_VERSION })).validated).toBe(false);
    expect(resolveReleaseGate(tmp({ gatesPassed: true, evaluationId: 'e1', modelVersion: 'other' })).validated).toBe(false);
    expect(resolveReleaseGate(tmp({ gatesPassed: true, modelVersion: MODEL_VERSION })).validated).toBe(false);
  });

  it('becomes VALIDATED only with gatesPassed true for this model version', () => {
    const r = resolveReleaseGate(tmp({ gatesPassed: true, evaluationId: 'eval-123', modelVersion: MODEL_VERSION }));
    expect(r).toMatchObject({ stage: 'VALIDATED', validated: true, evaluationId: 'eval-123' });
  });
});

describe('evaluate', () => {
  it('computes AUROC matching hand-computed values', () => {
    // pairs (pos > neg): 0.35>0.1, 0.8>0.1, 0.8>0.4 => 3 of 4
    expect(computeAuroc([0.1, 0.4], [0.35, 0.8])).toBeCloseTo(0.75, 10);
    // ties count 0.5: (0.5,0.5)=0.5 twice, 0.9 beats both => 3/4
    expect(computeAuroc([0.5, 0.5], [0.5, 0.9])).toBeCloseTo(0.75, 10);
    expect(computeAuroc([0.1, 0.2], [0.8, 0.9])).toBe(1);
    expect(computeAuroc([0.8, 0.9], [0.1, 0.2])).toBe(0);
    expect(computeAuroc([], [0.5])).toBeNull();
  });

  it('computes metrics through evaluate() on a toy dataset with a known scorer', () => {
    const toy: LabeledSample[] = [
      { id: 'h1', text: '0.1', label: 'human', group: 'a' },
      { id: 'h2', text: '0.4', label: 'human', group: 'b' },
      { id: 'h3', text: '0.6', label: 'human', group: 'b' },
      { id: 'a1', text: '0.35', label: 'ai' },
      { id: 'a2', text: '0.8', label: 'ai' },
      { id: 'a3', text: '0.9', label: 'ai' },
    ];
    const report = evaluate(toy, { scoreFn: Number, operatingThreshold: 0.5 });
    // 9 pairs; ai wins: 0.35>{0.1}, 0.8>{0.1,0.4,0.6}, 0.9>{0.1,0.4,0.6} => 7/9
    expect(report.auroc.humanVsAi).toBeCloseTo(7 / 9, 4);
    expect(report.humanFpr).toMatchObject({ falsePositives: 1, n: 3 });
    expect(report.humanFpr.rate).toBeCloseTo(1 / 3, 4);
    expect(report.detectionRateAtThreshold.ai).toBeCloseTo(2 / 3, 4);
    expect(report.groupFpr.map((g) => [g.group, g.n, g.falsePositives])).toEqual([
      ['a', 1, 0],
      ['b', 2, 1],
    ]);
    expect(report.counts.byLabel).toEqual({ human: 3, ai: 3, ai_paraphrased: 0, hybrid: 0 });
    expect(report.calibration.bins).toHaveLength(10);
    expect(report.calibration.bins.reduce((a, b) => a + b.count, 0)).toBe(6);
    expect(report.gatesPassed).toBe(false);
  });

  it('fails gates for tiny datasets and reports every gate', () => {
    const report = evaluate(smoke, { minWords: 100 });
    expect(report.counts.total).toBe(smoke.length);
    expect(report.gates.map((g) => g.id)).toEqual(RELEASE_GATES.map((g) => g.id));
    expect(report.gates.find((g) => g.id === 'G1_DATASET_SIZE')!.passed).toBe(false);
    for (const id of ['G2_AUROC', 'G3_HUMAN_FPR', 'G5_CALIBRATION']) {
      const gate = report.gates.find((g) => g.id === id)!;
      expect(gate.passed).toBe(false);
      expect(gate.observed).toMatch(/not passable/);
    }
    expect(report.gates.find((g) => g.id === 'G4_SUBGROUP_DISPARITY')!.passed).toBe(false);
    expect(report.gates.find((g) => g.id === 'G6_INDEPENDENT_SIGN_OFF')!.passed).toBe(false);
    expect(report.gatesPassed).toBe(false);
    expect(report.caveats.join(' ')).toMatch(/no evidentiary value/);
  });

  it('gates are passable in principle with a large, well-separated dataset and sign-off', () => {
    const data: LabeledSample[] = [];
    for (let i = 0; i < 1200; i++) data.push({ id: `h${i}`, text: '0.05', label: 'human', group: i < 300 ? 'non_native_en' : 'native_en' });
    for (let i = 0; i < 1000; i++) data.push({ id: `a${i}`, text: '0.95', label: 'ai' });
    const signOff = { reviewer: 'R', organization: 'O', date: '2026-01-01', reference: 'ref' };
    const report = evaluate(data, { scoreFn: Number, independentReviewerSignOff: signOff });
    expect(report.gates.filter((g) => !g.passed)).toEqual([]);
    expect(report.gatesPassed).toBe(true);
    expect(evaluate(data, { scoreFn: Number }).gatesPassed).toBe(false);
  });

  it('excludes unscored samples and is deterministic', () => {
    const report = evaluate(smoke);
    expect(report.counts.notScored.insufficientText).toBe(smoke.length);
    expect(report.auroc.humanVsAi).toBeNull();
    expect(report.gatesPassed).toBe(false);
    expect(evaluate(smoke, { minWords: 100 })).toEqual(evaluate(smoke, { minWords: 100 }));
  });

  it('rejects unknown labels', () => {
    expect(() => evaluate([{ id: 'x', text: 't', label: 'robot' as never }])).toThrow(/Unknown label/);
  });
});
