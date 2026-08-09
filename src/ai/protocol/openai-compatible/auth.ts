/**
 * VIVIM AI Gateway — OpenAI-Compatible Auth
 * @module ai/protocol/openai-compatible/auth
 */

import type { AuthMethod } from './manifest.js'

export function resolveAuthHeaders(auth: AuthMethod): Record<string, string> {
  switch (auth.kind) {
    case 'none':
      return {}
    case 'bearer': {
      const token = process.env[auth.tokenEnvVar]
      if (!token) {
        throw new Error(`Bearer token env var ${auth.tokenEnvVar} is not set`)
      }
      return { Authorization: `Bearer ${token}` }
    }
    case 'custom-header': {
      const value = process.env[auth.valueEnvVar]
      if (!value) {
        throw new Error(`Custom header env var ${auth.valueEnvVar} is not set`)
      }
      return { [auth.headerName]: value }
    }
    case 'basic': {
      const username = process.env[auth.usernameEnvVar] ?? ''
      const password = process.env[auth.passwordEnvVar] ?? ''
      if (!username || !password) {
        throw new Error(`Basic auth env vars ${auth.usernameEnvVar}/${auth.passwordEnvVar} not set`)
      }
      const encoded = btoa(`${username}:${password}`)
      return { Authorization: `Basic ${encoded}` }
    }
  }
}
