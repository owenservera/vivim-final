// storage/__tests__/storage-provider.parity.test.ts
import { beforeEach, describe, expect, it } from 'bun:test'
import { __resetEngineBagForTests, getEngineBag } from '../../lib/canvas-engine-bootstrap'
import { __resetStorageProviderForTests, getStorageProvider } from '../provider'

describe('StorageProvider parity', () => {
  beforeEach(() => {
    __resetEngineBagForTests()
    __resetStorageProviderForTests()
  })

  describe('singleton invariant', () => {
    it('returns the same instance on repeated calls', () => {
      const a = getStorageProvider()
      const b = getStorageProvider()
      expect(a).toBe(b)
    })

    it('returns a fresh instance after __resetStorageProviderForTests', () => {
      const a = getStorageProvider()
      __resetStorageProviderForTests()
      const b = getStorageProvider()
      expect(a).not.toBe(b)
    })
  })

  describe('bag.XStore is the same object as bag.storage.XStore (identity)', () => {
    const STORE_NAMES = [
      'uiComponentStore',
      'providerTypeStore',
      'primitiveStore',
      'providerStore',
      'accountStore',
      'capabilityTierStore',
      'userLayoutStore',
      'canvasDefinitionStore',
      'workspaceStore',
      'documentStore',
      'mediaStore',
      'automationStore',
      'agentStore',
      'hitlGateStore',
      'policyRuleStore',
      'annotationStore',
      'shellCommandStore',
      'notificationStore',
      'auditStore',
      'rbacStore',
      'templateStore',
      'presenceStore',
      'searchIndex',
      'onboardingStore',
      'documentEditStore',
      'zLayerStore',
      'drawerStore',
    ] as const

    for (const name of STORE_NAMES) {
      it(`bag.${name} === bag.storage.${name}`, () => {
        const bag = getEngineBag()
        const bagStore = (bag as unknown as Record<string, unknown>)[name]
        const storageStore = (bag.storage as unknown as Record<string, unknown>)[name]
        expect(bagStore).toBe(storageStore)
      })
    }
  })

  describe('bag.storage === getStorageProvider() (singleton)', () => {
    it('bag.storage is the process-singleton provider', () => {
      const bag = getEngineBag()
      expect(bag.storage).toBe(getStorageProvider())
    })
  })

  describe('provider name reflects env var', () => {
    it('defaults to memory', () => {
      process.env.VIVIM_STORAGE_PROVIDER = undefined
      __resetStorageProviderForTests()
      expect(getStorageProvider().name).toBe('memory')
    })

    it('selects memory when VIVIM_STORAGE_PROVIDER=memory', () => {
      process.env.VIVIM_STORAGE_PROVIDER = 'memory'
      __resetStorageProviderForTests()
      expect(getStorageProvider().name).toBe('memory')
    })

    it('selects prisma when VIVIM_STORAGE_PROVIDER=prisma', () => {
      process.env.VIVIM_STORAGE_PROVIDER = 'prisma'
      __resetStorageProviderForTests()
      expect(getStorageProvider().name).toBe('prisma')
    })

    it('throws for unknown values', () => {
      process.env.VIVIM_STORAGE_PROVIDER = 'bogus'
      __resetStorageProviderForTests()
      expect(() => getStorageProvider()).toThrow(/Unknown VIVIM_STORAGE_PROVIDER/)
    })
  })
})
