/**
 * Debug utility for development logging
 * Only logs when NODE_ENV is 'development'
 */

type DebugCategory = 'chart' | 'data' | 'state' | 'api' | 'general'

interface DebugConfig {
  enabled: boolean
  categories: Set<DebugCategory>
}

const config: DebugConfig = {
  enabled: process.env.NODE_ENV === 'development',
  categories: new Set(['chart', 'data', 'state', 'api', 'general']),
}

/**
 * Configure debug settings
 */
export const configureDebug = (options: Partial<DebugConfig>) => {
  if (options.enabled !== undefined) config.enabled = options.enabled
  if (options.categories) config.categories = new Set(options.categories)
}

/**
 * Debug logger with category support
 */
export const debug = {
  /**
   * Chart-related debug logs
   */
  chart: (title: string, message: string, data?: any) => {
    if (!config.enabled || !config.categories.has('chart')) return

    if (data !== undefined) {
      console.log(`📊 [Chart:${title}] ${message}`, data)
    } else {
      console.log(`📊 [Chart:${title}] ${message}`)
    }
  },

  /**
   * Data transformation debug logs
   */
  data: (message: string, data?: any) => {
    if (!config.enabled || !config.categories.has('data')) return

    if (data !== undefined) {
      console.log(`📦 [Data] ${message}`, data)
    } else {
      console.log(`📦 [Data] ${message}`)
    }
  },

  /**
   * State change debug logs
   */
  state: (component: string, message: string, data?: any) => {
    if (!config.enabled || !config.categories.has('state')) return

    if (data !== undefined) {
      console.log(`🔄 [State:${component}] ${message}`, data)
    } else {
      console.log(`🔄 [State:${component}] ${message}`)
    }
  },

  /**
   * API/Query debug logs
   */
  api: (message: string, data?: any) => {
    if (!config.enabled || !config.categories.has('api')) return

    if (data !== undefined) {
      console.log(`🌐 [API] ${message}`, data)
    } else {
      console.log(`🌐 [API] ${message}`)
    }
  },

  /**
   * General debug logs
   */
  log: (message: string, data?: any) => {
    if (!config.enabled || !config.categories.has('general')) return

    if (data !== undefined) {
      console.log(`💡 [Debug] ${message}`, data)
    } else {
      console.log(`💡 [Debug] ${message}`)
    }
  },

  /**
   * Warning logs (always shown in development)
   */
  warn: (message: string, data?: any) => {
    if (!config.enabled) return

    if (data !== undefined) {
      console.warn(`⚠️ [Warning] ${message}`, data)
    } else {
      console.warn(`⚠️ [Warning] ${message}`)
    }
  },

  /**
   * Error logs (always shown)
   */
  error: (message: string, error?: any) => {
    if (error !== undefined) {
      console.error(`❌ [Error] ${message}`, error)
    } else {
      console.error(`❌ [Error] ${message}`)
    }
  },
}
