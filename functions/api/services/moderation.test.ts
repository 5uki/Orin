/**
 * Property-based tests for Moderation Service
 *
 * **Property 7: Moderation Decision Matrix**
 * **Property 8: AI Fallback Guarantee**
 * **Validates: Requirements 6.2, 6.3, 6.4, 6.5**
 *
 * Feature: cloudflare-blog, Property 7: Moderation Decision Matrix
 * Feature: cloudflare-blog, Property 8: AI Fallback Guarantee
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { TrustLevel } from '@orin/shared/types';
import {
  makeDecision,
  checkHardRules,
  THRESHOLDS,
  type RuleCheckResult,
  type AICheckResult,
} from './moderation';

/**
 * Arbitrary generator for TrustLevel
 */
const trustLevelArb: fc.Arbitrary<TrustLevel> = fc.constantFrom(
  0,
  1,
  2,
  3
) as fc.Arbitrary<TrustLevel>;

/**
 * Arbitrary generator for successful AICheckResult
 */
function successfulAIResult(scoreMin: number, scoreMax: number): fc.Arbitrary<AICheckResult> {
  return fc.record({
    aiScore: fc.double({ min: scoreMin, max: scoreMax, noNaN: true }),
    aiLabel: fc.constantFrom('safe', 'negative', 'toxic', 'spam'),
    success: fc.constant(true as const),
    error: fc.constant(undefined),
  });
}

/**
 * Arbitrary generator for failed AICheckResult
 */
const failedAIResultArb: fc.Arbitrary<AICheckResult> = fc.record({
  aiScore: fc.constant(0),
  aiLabel: fc.constant('unknown'),
  success: fc.constant(false as const),
  error: fc.constantFrom('AI service timeout', 'AI service not configured', 'AI service error'),
});

describe('Moderation Service Properties', () => {
  /**
   * Property 7: Moderation Decision Matrix
   */
  describe('Property 7: Moderation Decision Matrix', () => {
    /**
     * Requirements 6.2: Hard rules trigger auto-reject
     */
    it('should reject when hard rules are triggered', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 }),
          successfulAIResult(0, 1),
          trustLevelArb,
          (ruleScore, ruleFlags, aiResult, trustLevel) => {
            const ruleResult: RuleCheckResult = {
              ruleScore,
              ruleFlags,
              hardRuleTriggered: true,
            };
            const decision = makeDecision(ruleResult, aiResult, trustLevel);
            expect(decision.status).toBe('rejected');
            expect(decision.source).toBe('rules');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Requirements 6.3: Trusted users with clean content get auto-approved
     */
    it('should approve trusted users with clean content and low AI score', () => {
      fc.assert(
        fc.property(
          successfulAIResult(0, THRESHOLDS.AUTO_APPROVE_AI_MAX),
          fc.constantFrom(2, 3) as fc.Arbitrary<TrustLevel>,
          (aiResult, trustLevel) => {
            const ruleResult: RuleCheckResult = {
              ruleScore: 0,
              ruleFlags: [],
              hardRuleTriggered: false,
            };
            const decision = makeDecision(ruleResult, aiResult, trustLevel);
            expect(decision.status).toBe('approved');
            expect(decision.source).toBe('ai');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Requirements 6.4: High AI score triggers auto-reject
     */
    it('should reject when AI score is >= 0.90', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2 }),
          successfulAIResult(THRESHOLDS.AUTO_REJECT_AI_MIN, 1),
          trustLevelArb,
          (ruleScore, aiResult, trustLevel) => {
            const ruleResult: RuleCheckResult = {
              ruleScore,
              ruleFlags: [],
              hardRuleTriggered: false,
            };
            const decision = makeDecision(ruleResult, aiResult, trustLevel);
            expect(decision.status).toBe('rejected');
            expect(decision.source).toBe('ai');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Requirements 6.4: Combined rule + AI score triggers auto-reject
     */
    it('should reject when rule_score >= 3 AND ai_score >= 0.70', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: THRESHOLDS.COMBINED_REJECT_RULE_MIN, max: 10 }),
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 3 }),
          successfulAIResult(
            THRESHOLDS.COMBINED_REJECT_AI_MIN,
            THRESHOLDS.AUTO_REJECT_AI_MIN - 0.01
          ),
          trustLevelArb,
          (ruleScore, ruleFlags, aiResult, trustLevel) => {
            const ruleResult: RuleCheckResult = {
              ruleScore,
              ruleFlags,
              hardRuleTriggered: false,
            };
            const decision = makeDecision(ruleResult, aiResult, trustLevel);
            expect(decision.status).toBe('rejected');
            expect(decision.source).toBe('ai');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Default case: pending for manual review
     */
    it('should return pending for ambiguous cases', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2 }),
          // Score range between auto-approve max and combined reject min
          successfulAIResult(
            THRESHOLDS.AUTO_APPROVE_AI_MAX + 0.01,
            THRESHOLDS.COMBINED_REJECT_AI_MIN - 0.01
          ),
          fc.constantFrom(0, 1) as fc.Arbitrary<TrustLevel>,
          (ruleScore, aiResult, trustLevel) => {
            const ruleResult: RuleCheckResult = {
              ruleScore,
              ruleFlags: [],
              hardRuleTriggered: false,
            };
            const decision = makeDecision(ruleResult, aiResult, trustLevel);
            expect(decision.status).toBe('pending');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Untrusted users don't get auto-approved even with clean content
     */
    it('should not auto-approve untrusted users even with clean content', () => {
      fc.assert(
        fc.property(
          successfulAIResult(0, THRESHOLDS.AUTO_APPROVE_AI_MAX),
          fc.constantFrom(0, 1) as fc.Arbitrary<TrustLevel>,
          (aiResult, trustLevel) => {
            const ruleResult: RuleCheckResult = {
              ruleScore: 0,
              ruleFlags: [],
              hardRuleTriggered: false,
            };
            const decision = makeDecision(ruleResult, aiResult, trustLevel);
            expect(decision.status).toBe('pending');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 8: AI Fallback Guarantee
   */
  describe('Property 8: AI Fallback Guarantee', () => {
    /**
     * Requirements 6.5: AI failure results in pending status
     */
    it('should return pending when AI fails (never auto-approve)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2 }),
          failedAIResultArb,
          trustLevelArb,
          (ruleScore, aiResult, trustLevel) => {
            const ruleResult: RuleCheckResult = {
              ruleScore,
              ruleFlags: [],
              hardRuleTriggered: false,
            };
            const decision = makeDecision(ruleResult, aiResult, trustLevel);
            expect(decision.status).not.toBe('approved');
            expect(decision.status).toBe('pending');
            expect(decision.source).toBe('fallback');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Hard rules still work even when AI fails
     */
    it('should still reject hard rule violations when AI fails', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 20 }),
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 3 }),
          failedAIResultArb,
          trustLevelArb,
          (ruleScore, ruleFlags, aiResult, trustLevel) => {
            const ruleResult: RuleCheckResult = {
              ruleScore,
              ruleFlags,
              hardRuleTriggered: true,
            };
            const decision = makeDecision(ruleResult, aiResult, trustLevel);
            expect(decision.status).toBe('rejected');
            expect(decision.source).toBe('rules');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * AI failure should set source to 'fallback'
     */
    it('should set source to fallback when AI fails', () => {
      fc.assert(
        fc.property(failedAIResultArb, trustLevelArb, (aiResult, trustLevel) => {
          const ruleResult: RuleCheckResult = {
            ruleScore: 0,
            ruleFlags: [],
            hardRuleTriggered: false,
          };
          const decision = makeDecision(ruleResult, aiResult, trustLevel);
          expect(decision.source).toBe('fallback');
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property tests for hard rule detection
   */
  describe('Hard Rule Detection', () => {
    it('should detect malicious links', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Check out bit.ly/abc123',
            'Visit tinyurl.com/xyz789',
            'Click here https://casino-winner.com'
          ),
          (content) => {
            const result = checkHardRules(content);
            expect(result.ruleFlags).toContain('malicious_link');
            expect(result.hardRuleTriggered).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect duplicate content', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 10, maxLength: 100 }), (content) => {
          const result = checkHardRules(content, [content]);
          expect(result.ruleFlags).toContain('duplicate_content');
          expect(result.hardRuleTriggered).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should not trigger hard rules for clean content', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'This is a great article!',
            'Thanks for sharing this information.',
            'I learned something new today.',
            'Very helpful, appreciate the detailed explanation.'
          ),
          (content) => {
            const result = checkHardRules(content);
            expect(result.hardRuleTriggered).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
