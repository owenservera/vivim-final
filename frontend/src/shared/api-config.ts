/**
 * shared/api-config.ts — API URL configuration
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9420';

export function getApiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
