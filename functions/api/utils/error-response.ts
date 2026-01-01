/**
 * Error Response Utilities
 *
 * Provides standardized error response creation for the API.
 */

import type { ApiErrorResponse, ErrorCode } from '@orin/shared/types';
import { ApiErrorResponseSchema } from '@orin/shared/validators';

/**
 * Chinese error messages for each error code
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: '未授权访问',
  FORBIDDEN: '禁止访问',
  INVALID_INPUT: '输入无效',
  RATE_LIMITED: '请求过于频繁，请稍后再试',
  NOT_FOUND: '资源未找到',
  INTERNAL_ERROR: '服务器内部错误',
};

/**
 * Get Chinese error message for an error code
 */
export function getChineseErrorMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code] || '未知错误';
}

/**
 * Generate a unique request ID for error tracking
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message?: string,
  requestId?: string
): ApiErrorResponse {
  const response: ApiErrorResponse = {
    ok: false,
    error: {
      code,
      message: message || getChineseErrorMessage(code),
      requestId: requestId || generateRequestId(),
    },
  };

  // Validate the response format matches our schema
  const validation = ApiErrorResponseSchema.safeParse(response);
  if (!validation.success) {
    console.error('Invalid error response format:', validation.error);
    // Fallback to a basic error response
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
        requestId: requestId || generateRequestId(),
      },
    };
  }

  return response;
}
