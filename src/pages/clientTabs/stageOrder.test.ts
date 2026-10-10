import { describe, it, expect } from 'vitest';
import {
  STAGE_ORDER,
  TAB_SLUGS,
  SLUG_TO_STAGE,
  STAGE_TO_SLUG,
  coalesceStage,
  maxStage,
  nextStage,
  stageIndex,
} from './stageOrder';

/**
 * FEAT-004: the tabbed workspace advances a Client's stage forward-only. These
 * pure assertions pin maxStage (never lowers) and coalesceStage (null -> the
 * first stage) so the shell's advanceStage can rely on them.
 */
describe('stageOrder maps (FEAT-004)', () => {
  it('has 8 stages and 8 slugs, index-aligned', () => {
    expect(STAGE_ORDER.length).toBe(8);
    expect(TAB_SLUGS.length).toBe(8);
    STAGE_ORDER.forEach((stage, i) => {
      expect(SLUG_TO_STAGE[TAB_SLUGS[i]]).toBe(stage);
      expect(STAGE_TO_SLUG[stage]).toBe(TAB_SLUGS[i]);
    });
  });
});

describe('coalesceStage (FEAT-004)', () => {
  it('maps null to quote_requested', () => {
    expect(coalesceStage(null)).toBe('quote_requested');
  });
  it('maps undefined to quote_requested', () => {
    expect(coalesceStage(undefined)).toBe('quote_requested');
  });
  it('maps an unknown value to quote_requested', () => {
    expect(coalesceStage('not_a_stage')).toBe('quote_requested');
  });
  it('passes a valid stage through unchanged', () => {
    expect(coalesceStage('agreement')).toBe('agreement');
    expect(coalesceStage('monthly_service')).toBe('monthly_service');
  });
});

describe('maxStage never lowers (FEAT-004 forward-only)', () => {
  it('returns the later stage when advancing', () => {
    expect(maxStage('quote_requested', 'agreement')).toBe('agreement');
  });
  it('never lowers when next is earlier than current', () => {
    expect(maxStage('agreement', 'quote_requested')).toBe('agreement');
    expect(maxStage('monthly_service', 'project')).toBe('monthly_service');
  });
  it('is a no-op when next equals current', () => {
    expect(maxStage('demo_build', 'demo_build')).toBe('demo_build');
  });
  it('treats null current as quote_requested and still advances', () => {
    expect(maxStage(null, 'demo_details')).toBe('demo_details');
  });
  it('never lowers below quote_requested when both are null/unknown', () => {
    expect(maxStage(null, null)).toBe('quote_requested');
  });

  it('never lowers across every ordered pair', () => {
    for (let i = 0; i < STAGE_ORDER.length; i++) {
      for (let j = 0; j < STAGE_ORDER.length; j++) {
        const result = maxStage(STAGE_ORDER[i], STAGE_ORDER[j]);
        expect(stageIndex(result)).toBe(Math.max(i, j));
      }
    }
  });
});

describe('nextStage (FEAT-004)', () => {
  it('returns the following stage', () => {
    expect(nextStage('quote_requested')).toBe('demo_details');
  });
  it('returns null at the terminal stage', () => {
    expect(nextStage('monthly_service')).toBeNull();
  });
  it('is null-safe (null -> demo_details)', () => {
    expect(nextStage(null)).toBe('demo_details');
  });
});
