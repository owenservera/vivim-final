/**
 * storage/provider/not-implemented-proxy.ts
 * --------------------------------------------------------------------
 * Proxy that throws NotImplementedError on first method access.
 * Used by PrismaStorageProvider for unimplemented stores.
 */

export class NotImplementedErrorProxy<_T extends object> {
  readonly __notImplemented = true as const
  readonly __message: string

  constructor(
    readonly storeName: string,
    readonly implClassName: string,
  ) {
    this.__message = `${implClassName} is not implemented yet. Store "${storeName}" cannot be used with VIVIM_STORAGE_PROVIDER=prisma. See ROADMAP.md for migration status.`
  }

  private throw_(): never {
    throw new NotImplementedError(this.__message)
  }

  static create<T extends object>(storeName: string, implClassName: string): T {
    const proxy = new NotImplementedErrorProxy<T>(storeName, implClassName)
    return new Proxy(proxy, {
      get(target, prop, receiver) {
        if (
          prop === '__notImplemented' ||
          prop === '__message' ||
          prop === 'storeName' ||
          prop === 'implClassName'
        ) {
          return Reflect.get(target, prop, receiver)
        }
        return (..._args: unknown[]) => {
          target.throw_()
        }
      },
    }) as unknown as T
  }
}

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotImplementedError'
  }
}
