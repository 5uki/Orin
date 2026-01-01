/**
 * Moderation Service
 *
 * Implements comment moderation with hard rules detection, AI scoring,
 * and decision matrix for automatic approval/rejection.
 */

import type { ModerationSource, TrustLevel } from '@orin/shared/types';

/**
 * Result of hard rule detection
 */
export interface RuleCheckResult {
  /** Total rule score (higher = more suspicious) */
  ruleScore: number;
  /** List of triggered rule flags */
  ruleFlags: string[];
  /** Whether any hard rule was triggered (auto-reject) */
  hardRuleTriggered: boolean;
}

/**
 * Result of AI moderation
 */
export interface AICheckResult {
  /** AI confidence score (0-1, higher = more likely spam/harmful) */
  aiScore: number;
  /** AI classification label */
  aiLabel: string;
  /** Whether AI check was successful */
  success: boolean;
  /** Error message if AI check failed */
  error?: string;
}

/**
 * Enhanced AI moderation result with category scores
 */
export interface EnhancedAICheckResult extends AICheckResult {
  /** Category-specific confidence scores */
  categories: {
    /** Spam score (0-1): ads, promotions, meaningless content */
    spam: number;
    /** Toxic score (0-1): insults, attacks, hate speech */
    toxic: number;
    /** Inappropriate score (0-1): adult content, violence, illegal content */
    inappropriate: number;
  };
}

/**
 * Final moderation decision
 */
export interface ModerationResult {
  /** Final status decision */
  status: 'approved' | 'rejected' | 'pending';
  /** Source of the decision */
  source: ModerationSource;
  /** AI score if available */
  aiScore?: number;
  /** AI label if available */
  aiLabel?: string;
  /** Rule score */
  ruleScore: number;
  /** Triggered rule flags */
  ruleFlags: string[];
}

/**
 * Known malicious URL patterns
 */
const MALICIOUS_URL_PATTERNS: RegExp[] = [
  // Phishing patterns
  /bit\.ly\/[a-z0-9]+/i,
  /tinyurl\.com\/[a-z0-9]+/i,
  /t\.co\/[a-z0-9]+/i,
  // Known spam domains (examples)
  /\b(viagra|cialis|casino|poker|lottery|prize|winner)\b.*\.(com|net|org)/i,
  // Suspicious redirect patterns
  /\bredirect\b.*\burl=/i,
  /\bclick\b.*\bhere\b.*https?:\/\//i,
];

/**
 * Profanity and abuse word patterns (simplified list)
 * In production, use a more comprehensive list or external service
 */
const PROFANITY_PATTERNS: RegExp[] = [
  // Common profanity (simplified, case-insensitive)
  /\b(fuck|shit|ass|damn|bitch|bastard|crap)\b/i,
  // Slurs and hate speech patterns
  /\b(idiot|moron|stupid|dumb|retard)\b/i,
  // Threats
  /\b(kill|die|death|murder|threat)\b.*\b(you|your)\b/i,
];

/**
 * Spam patterns for repetitive content detection
 */
const SPAM_PATTERNS: RegExp[] = [
  // Repeated characters (e.g., "aaaaaaa")
  /(.)\1{5,}/,
  // Repeated words (e.g., "buy buy buy buy")
  /\b(\w+)\b(?:\s+\1\b){3,}/i,
  // Excessive caps (more than 70% uppercase in long text)
  // Handled separately in checkExcessiveCaps
];

/**
 * Check for malicious links in content
 *
 * @param content - Comment content to check
 * @returns Array of triggered flags
 */
export function checkMaliciousLinks(content: string): string[] {
  const flags: string[] = [];

  for (const pattern of MALICIOUS_URL_PATTERNS) {
    if (pattern.test(content)) {
      flags.push('malicious_link');
      break; // One flag is enough
    }
  }

  // Check for excessive links (more than 3)
  const urlMatches = content.match(/https?:\/\/[^\s]+/g);
  if (urlMatches && urlMatches.length > 3) {
    flags.push('excessive_links');
  }

  return flags;
}

/**
 * Check for profanity and abusive language
 *
 * @param content - Comment content to check
 * @returns Array of triggered flags
 */
export function checkProfanity(content: string): string[] {
  const flags: string[] = [];

  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(content)) {
      flags.push('profanity');
      break;
    }
  }

  return flags;
}

/**
 * Check for spam patterns (repetitive content)
 *
 * @param content - Comment content to check
 * @returns Array of triggered flags
 */
export function checkSpamPatterns(content: string): string[] {
  const flags: string[] = [];

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) {
      flags.push('spam_pattern');
      break;
    }
  }

  return flags;
}

/**
 * Check for excessive capitalization
 *
 * @param content - Comment content to check
 * @returns Array of triggered flags
 */
export function checkExcessiveCaps(content: string): string[] {
  const flags: string[] = [];

  // Only check if content is long enough
  if (content.length >= 20) {
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length >= 10) {
      const upperCount = (letters.match(/[A-Z]/g) || []).length;
      const upperRatio = upperCount / letters.length;
      if (upperRatio > 0.7) {
        flags.push('excessive_caps');
      }
    }
  }

  return flags;
}

/**
 * Check for duplicate/similar content (basic hash-based)
 *
 * @param content - Comment content to check
 * @param recentContents - Recent comment contents from same user
 * @returns Array of triggered flags
 */
export function checkDuplicateContent(content: string, recentContents: string[]): string[] {
  const flags: string[] = [];

  // Normalize content for comparison
  const normalized = normalizeContent(content);

  for (const recent of recentContents) {
    const recentNormalized = normalizeContent(recent);
    if (normalized === recentNormalized) {
      flags.push('duplicate_content');
      break;
    }

    // Check for high similarity (simple Jaccard similarity)
    const similarity = calculateSimilarity(normalized, recentNormalized);
    if (similarity > 0.8) {
      flags.push('similar_content');
      break;
    }
  }

  return flags;
}

/**
 * Normalize content for comparison
 */
function normalizeContent(content: string): string {
  return content
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Calculate simple word-based similarity (Jaccard index)
 */
function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(' ').filter((w) => w.length > 2));
  const wordsB = new Set(b.split(' ').filter((w) => w.length > 2));

  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

/**
 * Perform all hard rule checks on content
 *
 * @param content - Comment content to check
 * @param recentContents - Recent comment contents from same user (for duplicate detection)
 * @returns Rule check result
 */
export function checkHardRules(content: string, recentContents: string[] = []): RuleCheckResult {
  const allFlags: string[] = [];

  // Run all checks
  allFlags.push(...checkMaliciousLinks(content));
  allFlags.push(...checkProfanity(content));
  allFlags.push(...checkSpamPatterns(content));
  allFlags.push(...checkExcessiveCaps(content));
  allFlags.push(...checkDuplicateContent(content, recentContents));

  // Calculate rule score (each flag adds points)
  const flagScores: Record<string, number> = {
    malicious_link: 5, // Auto-reject
    profanity: 3,
    spam_pattern: 3,
    excessive_caps: 1,
    excessive_links: 2,
    duplicate_content: 4, // Auto-reject
    similar_content: 2,
  };

  let ruleScore = 0;
  for (const flag of allFlags) {
    ruleScore += flagScores[flag] || 1;
  }

  // Hard rules that trigger auto-reject
  const hardRuleFlags = ['malicious_link', 'duplicate_content'];
  const hardRuleTriggered = allFlags.some((flag) => hardRuleFlags.includes(flag));

  return {
    ruleScore,
    ruleFlags: [...new Set(allFlags)], // Deduplicate
    hardRuleTriggered,
  };
}

/**
 * AI moderation timeout in milliseconds
 */
const AI_TIMEOUT_MS = 5000;

/**
 * Labels that indicate harmful content
 */
const HARMFUL_LABELS = ['toxic', 'spam', 'hate', 'harassment', 'violence', 'sexual'];

/**
 * Structured moderation prompt for LLM-based content analysis
 */
const MODERATION_PROMPT = `你是一个内容审核助手。请分析以下评论内容，判断是否包含：
1. 垃圾信息 (spam): 广告、推销、无意义内容、重复内容
2. 有害内容 (toxic): 侮辱、攻击、仇恨言论、人身攻击
3. 不当内容 (inappropriate): 色情、暴力、违法内容

评论内容：
"""
{{CONTENT}}
"""

请严格按照以下JSON格式返回评分（0-1之间的小数，越高越可能违规）：
{"spam": 0.0, "toxic": 0.0, "inappropriate": 0.0, "overall": 0.0, "label": "safe"}

label的可选值：safe, spam, toxic, inappropriate
overall应该是三个分数中的最大值
只返回JSON，不要有其他文字。`;

/**
 * Parse AI response to extract moderation scores
 *
 * @param response - Raw AI response text
 * @returns Parsed moderation result or null if parsing fails
 */
function parseAIResponse(response: string): {
  spam: number;
  toxic: number;
  inappropriate: number;
  overall: number;
  label: string;
} | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (
      typeof parsed.spam !== 'number' ||
      typeof parsed.toxic !== 'number' ||
      typeof parsed.inappropriate !== 'number' ||
      typeof parsed.overall !== 'number' ||
      typeof parsed.label !== 'string'
    ) {
      return null;
    }

    // Clamp values to 0-1 range
    return {
      spam: Math.max(0, Math.min(1, parsed.spam)),
      toxic: Math.max(0, Math.min(1, parsed.toxic)),
      inappropriate: Math.max(0, Math.min(1, parsed.inappropriate)),
      overall: Math.max(0, Math.min(1, parsed.overall)),
      label: parsed.label,
    };
  } catch {
    return null;
  }
}

/**
 * Call Workers AI with enhanced LLM model for content moderation
 *
 * Uses @cf/meta/llama-3.2-1b-instruct for more accurate content analysis
 * with structured prompts and category-specific confidence scores.
 *
 * @param content - Comment content to classify
 * @param ai - Cloudflare AI binding
 * @returns Enhanced AI check result with category scores
 */
export async function checkWithEnhancedAI(
  content: string,
  ai: Ai | null
): Promise<EnhancedAICheckResult> {
  // If AI binding is not available, return failure
  if (!ai) {
    return {
      aiScore: 0,
      aiLabel: 'unknown',
      success: false,
      error: 'AI service not configured',
      categories: { spam: 0, toxic: 0, inappropriate: 0 },
    };
  }

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    // Build the prompt with content
    const prompt = MODERATION_PROMPT.replace('{{CONTENT}}', content);

    // Call Workers AI with Llama 3.2 1B Instruct model
    const response = await ai.run('@cf/meta/llama-3.2-1b-instruct', {
      prompt,
      max_tokens: 200,
      temperature: 0.1, // Low temperature for consistent results
    });

    clearTimeout(timeoutId);

    // Extract response text
    let responseText = '';
    if (typeof response === 'string') {
      responseText = response;
    } else if (response && typeof response === 'object' && 'response' in response) {
      responseText = (response as { response: string }).response;
    } else {
      return {
        aiScore: 0,
        aiLabel: 'unknown',
        success: false,
        error: 'Invalid AI response format',
        categories: { spam: 0, toxic: 0, inappropriate: 0 },
      };
    }

    // Parse the structured response
    const parsed = parseAIResponse(responseText);
    if (!parsed) {
      return {
        aiScore: 0,
        aiLabel: 'unknown',
        success: false,
        error: 'Failed to parse AI response',
        categories: { spam: 0, toxic: 0, inappropriate: 0 },
      };
    }

    return {
      aiScore: parsed.overall,
      aiLabel: parsed.label,
      success: true,
      categories: {
        spam: parsed.spam,
        toxic: parsed.toxic,
        inappropriate: parsed.inappropriate,
      },
    };
  } catch (error) {
    // Handle timeout and other errors
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = message.includes('abort') || message.includes('timeout');

    return {
      aiScore: 0,
      aiLabel: 'unknown',
      success: false,
      error: isTimeout ? 'AI service timeout' : `AI service error: ${message}`,
      categories: { spam: 0, toxic: 0, inappropriate: 0 },
    };
  }
}

/**
 * Call Workers AI for text classification (legacy method)
 *
 * @param content - Comment content to classify
 * @param ai - Cloudflare AI binding
 * @returns AI check result
 * @deprecated Use checkWithEnhancedAI for better accuracy
 */
export async function checkWithAI(content: string, ai: Ai | null): Promise<AICheckResult> {
  // Use enhanced AI check and convert to basic result
  const enhanced = await checkWithEnhancedAI(content, ai);
  return {
    aiScore: enhanced.aiScore,
    aiLabel: enhanced.aiLabel,
    success: enhanced.success,
    error: enhanced.error,
  };
}

/**
 * Simplified AI check for when full AI is not available
 * Uses basic heuristics as a fallback
 *
 * @param content - Comment content to check
 * @returns Heuristic-based score
 */
export function checkWithHeuristics(content: string): AICheckResult {
  let score = 0;

  // Check for suspicious patterns
  const suspiciousPatterns = [
    { pattern: /\b(buy|sell|discount|offer|free|click)\b/gi, weight: 0.1 },
    { pattern: /\b(http|www)\b/gi, weight: 0.05 },
    { pattern: /[!?]{3,}/g, weight: 0.1 },
    { pattern: /\$\d+/g, weight: 0.15 },
    { pattern: /\b(urgent|limited|act now|don't miss)\b/gi, weight: 0.2 },
  ];

  for (const { pattern, weight } of suspiciousPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      score += Math.min(matches.length * weight, 0.3);
    }
  }

  // Cap at 1.0
  score = Math.min(score, 1.0);

  return {
    aiScore: score,
    aiLabel: score > 0.5 ? 'suspicious' : 'likely_safe',
    success: true,
  };
}

/**
 * Moderation decision thresholds
 *
 * Updated thresholds based on enhanced AI model capabilities:
 * - Lower auto-approve threshold for trusted users (0.15)
 * - Lower auto-reject threshold (0.85) for more aggressive filtering
 * - Adjusted combined rejection thresholds (0.65)
 */
const THRESHOLDS = {
  /** AI score threshold for auto-approval (trusted users) */
  AUTO_APPROVE_AI_MAX: 0.15,
  /** AI score threshold for auto-rejection */
  AUTO_REJECT_AI_MIN: 0.85,
  /** AI score threshold for combined rule+AI rejection */
  COMBINED_REJECT_AI_MIN: 0.65,
  /** Rule score threshold for combined rejection */
  COMBINED_REJECT_RULE_MIN: 3,
  /** Minimum trust level for auto-approval */
  AUTO_APPROVE_TRUST_MIN: 2,
};

/**
 * Make moderation decision based on rules, AI, and trust level
 *
 * Decision Matrix (Requirements 6.2, 6.3, 6.4, 6.5):
 * 1. IF hard rules triggered → REJECT (source: rules)
 * 2. IF trust_level >= 2 AND rule_score = 0 AND ai_score <= 0.20 → APPROVE (source: ai)
 * 3. IF ai_score >= 0.90 OR (rule_score >= 3 AND ai_score >= 0.70) → REJECT (source: ai)
 * 4. IF AI unavailable → PENDING (source: fallback)
 * 5. OTHERWISE → PENDING (source: ai)
 *
 * @param ruleResult - Result from hard rule checks
 * @param aiResult - Result from AI classification
 * @param trustLevel - User's trust level (0-3)
 * @returns Final moderation decision
 */
export function makeDecision(
  ruleResult: RuleCheckResult,
  aiResult: AICheckResult,
  trustLevel: TrustLevel
): ModerationResult {
  const baseResult = {
    aiScore: aiResult.success ? aiResult.aiScore : undefined,
    aiLabel: aiResult.success ? aiResult.aiLabel : undefined,
    ruleScore: ruleResult.ruleScore,
    ruleFlags: ruleResult.ruleFlags,
  };

  // Step 1: Hard rules auto-reject
  if (ruleResult.hardRuleTriggered) {
    return {
      ...baseResult,
      status: 'rejected',
      source: 'rules',
    };
  }

  // Step 2: AI fallback guarantee
  // If AI unavailable, go to pending (never auto-approve)
  if (!aiResult.success) {
    return {
      ...baseResult,
      status: 'pending',
      source: 'fallback',
    };
  }

  // Step 3: Trusted user auto-approval
  // trust_level >= 2 AND rule_score = 0 AND ai_score <= 0.20
  if (
    trustLevel >= THRESHOLDS.AUTO_APPROVE_TRUST_MIN &&
    ruleResult.ruleScore === 0 &&
    aiResult.aiScore <= THRESHOLDS.AUTO_APPROVE_AI_MAX
  ) {
    return {
      ...baseResult,
      status: 'approved',
      source: 'ai',
    };
  }

  // Step 4: High AI score auto-reject
  // Requirements: 6.4 - ai_score >= 0.90
  if (aiResult.aiScore >= THRESHOLDS.AUTO_REJECT_AI_MIN) {
    return {
      ...baseResult,
      status: 'rejected',
      source: 'ai',
    };
  }

  // Step 5: Combined rule + AI auto-reject
  // rule_score >= 3 AND ai_score >= 0.70
  if (
    ruleResult.ruleScore >= THRESHOLDS.COMBINED_REJECT_RULE_MIN &&
    aiResult.aiScore >= THRESHOLDS.COMBINED_REJECT_AI_MIN
  ) {
    return {
      ...baseResult,
      status: 'rejected',
      source: 'ai',
    };
  }

  // Step 6: Default to pending for manual review
  return {
    ...baseResult,
    status: 'pending',
    source: 'ai',
  };
}

/**
 * Full moderation pipeline
 *
 * Runs all checks and makes final decision.
 * Uses enhanced AI model (@cf/meta/llama-3.2-1b-instruct) for more accurate
 * spam, toxic, and inappropriate content detection.
 *
 * @param content - Comment content to moderate
 * @param trustLevel - User's trust level
 * @param recentContents - Recent comments from same user (for duplicate detection)
 * @param ai - Cloudflare AI binding (optional)
 * @returns Final moderation result
 */
export async function moderate(
  content: string,
  trustLevel: TrustLevel,
  recentContents: string[] = [],
  ai: Ai | null = null
): Promise<ModerationResult> {
  // Step 1: Run hard rule checks
  const ruleResult = checkHardRules(content, recentContents);

  // Step 2: Run enhanced AI check (or heuristics if AI unavailable)
  let aiResult: AICheckResult;
  if (ai) {
    // Use enhanced AI with Llama 3.2 1B Instruct model
    aiResult = await checkWithEnhancedAI(content, ai);
  } else {
    // Use heuristics as fallback when AI is not configured
    aiResult = checkWithHeuristics(content);
  }

  // Step 3: Make decision
  return makeDecision(ruleResult, aiResult, trustLevel);
}

/**
 * Export thresholds for testing
 */
export { THRESHOLDS };

/**
 * Export HARMFUL_LABELS for reference
 */
export { HARMFUL_LABELS };

/**
 * Export parseAIResponse for testing
 */
export { parseAIResponse };
