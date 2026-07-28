// src/server/plugin-router.ts
// REST API router — plugin management (install, uninstall, upgrade, toggle).
//
// A .vivim-plugin is a tar.gz archive containing manifest.json, components/,
// and optional icon.png. This router handles the full lifecycle:
// install → verify → register → seed components → activate.

import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { assertTrustedExpressionSource } from '../engines/safe-eval.js'
import { newId } from '../ids.js'
import { UiComponentInputSchema } from '../schema/conceptual-model.js'
import type { ServerContext } from './index.js'
import { errorResponse, json } from './response.js'

interface PluginInstallRequest {
  filePath: string
}

interface PluginUpgradeRequest {
  filePath: string
  migrationScript?: string
}

async function computeFileHash(filePath: string): Promise<string> {
  const content = await readFile(filePath)
  return createHash('sha256').update(content).digest('hex')
}

async function _computeDirectoryHash(dir: string): Promise<string> {
  const hash = createHash('sha256')
  const { readdir: _readdir, stat: _stat } = await import('node:fs/promises')
  const walk = async (d: string): Promise<void> => {
    const entries = await _readdir(d, { withFileTypes: true })
    const sorted = entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const e of sorted) {
      const full = join(d, e.name)
      if (e.isFile()) {
        const content = await readFile(full)
        hash.update(e.name)
        hash.update(content)
      } else if (e.isDirectory()) {
        hash.update(e.name)
        await walk(full)
      }
    }
  }
  await walk(dir)
  return hash.digest('hex')
}

async function extractTarGz(archivePath: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true })

  const { spawn } = await import('node:child_process')

  const tryNativeTar = async (): Promise<boolean> => {
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn('tar', ['-xzf', archivePath, '-C', destDir], {
          stdio: ['ignore', 'ignore', 'pipe'],
        })
        let stderr = ''
        child.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
        child.on('close', (code) => {
          if (code === 0) resolve()
          else reject(new Error(`tar extraction failed (code ${code}): ${stderr}`))
        })
        child.on('error', reject)
      })
      return true
    } catch {
      return false
    }
  }

  if (await tryNativeTar()) return

  throw new Error(
    `Failed to extract ${archivePath}: tar command not available. ` +
    'On Windows, install Git for Windows (provides tar.exe) or WSL.',
  )
}

async function _createTarGz(sourceDir: string, destFile: string): Promise<void> {
  const { spawn } = await import('node:child_process')
  return new Promise((resolve, reject) => {
    const child = spawn('tar', ['-czf', destFile, '-C', sourceDir, '.'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`tar creation failed (code ${code}): ${stderr}`))
      else resolve()
    })
    child.on('error', reject)
  })
}

export function createPluginRouter(ctx: ServerContext) {
  const { db, eventBus } = ctx

  const pluginsDir = join(import.meta.dir, '../../plugins')
  const stagingDir = join(tmpdir(), 'vivim-plugin-staging')

  return async (req: Request, url: URL): Promise<Response> => {
    const { pathname } = url
    const method = req.method

    try {
      // POST /api/plugins/install
      if (pathname === '/api/plugins/install' && method === 'POST') {
        const body = (await req.json()) as PluginInstallRequest
        if (!body.filePath) {
          return errorResponse('filePath is required', 'MissingParam', 400)
        }

        const archivePath = body.filePath
        let _archiveStat: Awaited<ReturnType<typeof stat>>
        try {
          _archiveStat = await stat(archivePath)
        } catch {
          return errorResponse(`Plugin archive not found: ${archivePath}`, 'NotFound', 404)
        }

        const integrityHash = await computeFileHash(archivePath)
        const extractDir = join(stagingDir, `install-${newId()}`)
        await extractTarGz(archivePath, extractDir)

        const manifestPath = join(extractDir, 'manifest.json')
        let manifestRaw: string
        try {
          manifestRaw = await readFile(manifestPath, 'utf-8')
        } catch {
          await rm(extractDir, { recursive: true, force: true })
          return errorResponse('manifest.json not found in plugin archive', 'InvalidPlugin', 400)
        }

        let manifest: Record<string, unknown>
        try {
          manifest = JSON.parse(manifestRaw)
        } catch {
          await rm(extractDir, { recursive: true, force: true })
          return errorResponse('manifest.json is not valid JSON', 'InvalidPlugin', 400)
        }

        const pluginName = (manifest.provider as Record<string, unknown>)?.slug as string
        const pluginVersion = (manifest.version as string) ?? '0.1.0'
        const pluginDescription = (manifest.description as string) ?? null

        if (!pluginName) {
          await rm(extractDir, { recursive: true, force: true })
          return errorResponse('manifest.provider.slug is required', 'InvalidPlugin', 400)
        }

        const dependsOn = (manifest.depends_on as string[]) ?? []

        const conflictResult = await db.prisma.$queryRawUnsafe<
          Array<{ globalCapabilityId: string }>
        >(
          `SELECT pc.global_capability_id AS globalCapabilityId FROM provider_capability pc
             WHERE pc.provider_id != ? AND pc.global_capability_id IN (
               SELECT value FROM json_each(?)
             )`,
          pluginName,
          JSON.stringify(
            ((manifest.capabilities_config as Array<Record<string, unknown>>) ?? []).map(
              (c) => c.global_capability_id,
            ),
          ),
        )
        if (conflictResult.length > 0) {
          await rm(extractDir, { recursive: true, force: true })
          return json(
            {
              error: 'Capability conflict detected',
              code: 'CapabilityConflict',
              conflicting_plugins: conflictResult.map((r) => r.globalCapabilityId),
            },
            409,
          )
        }

        for (const depPluginId of dependsOn) {
          const dep = await db.prisma.pluginRegistry.findUnique({
            where: { name: depPluginId },
          })
          if (!dep || dep.isActive !== 1) {
            await rm(extractDir, { recursive: true, force: true })
            return errorResponse(`Missing dependency: ${depPluginId}`, 'MissingDependency', 400)
          }
        }

        const pluginDir = join(pluginsDir, pluginName)
        await mkdir(pluginDir, { recursive: true })

        const componentsDir = join(extractDir, 'components')
        const hasComponents = await stat(componentsDir)
          .then((s) => s.isDirectory())
          .catch(() => false)

        if (hasComponents) {
          const destComponents = join(pluginDir, 'components')
          await rm(destComponents, { recursive: true, force: true })
          const { cp } = await import('node:fs/promises')
          await cp(componentsDir, destComponents, { recursive: true })
        }

        const destManifest = join(pluginDir, 'manifest.json')
        await writeFile(destManifest, manifestRaw, 'utf-8')

        const existing = await db.prisma.pluginRegistry.findUnique({
          where: { name: pluginName },
        })

        if (existing) {
          await db.prisma.pluginRegistry.update({
            where: { id: existing.id },
            data: {
              version: pluginVersion,
              filePath: archivePath,
              capabilities: JSON.stringify(
                (manifest.capabilities_config as Array<Record<string, unknown>>) ?? [],
              ),
              description: pluginDescription,
              manifestJson: manifestRaw,
              dependsOnJson: JSON.stringify(dependsOn),
              integrityHash,
              updatedAt: Date.now(),
            },
          })
        } else {
          await db.prisma.pluginRegistry.create({
            data: {
              id: newId(),
              name: pluginName,
              version: pluginVersion,
              filePath: archivePath,
              capabilities: JSON.stringify(
                (manifest.capabilities_config as Array<Record<string, unknown>>) ?? [],
              ),
              description: pluginDescription,
              manifestJson: manifestRaw,
              dependsOnJson: JSON.stringify(dependsOn),
              integrityHash,
              isActive: 1,
              loadedAt: Date.now(),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          })
        }

        const { ProviderRegistrar } = await import('../engines/provider-registrar.js')
        const { ProviderManifestSchema } = await import('../schema/provider-manifest.js')
        const { ProviderStoreImpl } = await import('../storage/impl/provider-store-impl.js')
        const { PrimitiveStoreImpl } = await import('../storage/impl/primitive-store-impl.js')
        const { UiComponentStoreImpl } = await import('../storage/impl/ui-component-store-impl.js')

        const providerStore = new ProviderStoreImpl(db)
        const registrar = new ProviderRegistrar(providerStore, undefined, eventBus)
        const parsedManifest = ProviderManifestSchema.parse(manifest)
        const regResult = await registrar.register(parsedManifest)

        // Link plugin ↔ provider via explicit FK. The registrar uses the
        // provider slug as both definition.id and definition.slug, so we
        // update the just-written row to point at the PluginRegistry parent.
        const pluginRow = await db.prisma.pluginRegistry.findUnique({
          where: { name: pluginName },
        })
        if (pluginRow) {
          await db.prisma.providerDefinition.update({
            where: { slug: pluginName },
            data: { pluginId: pluginRow.id },
          })
        }

        if (hasComponents) {
          const componentsList: Array<{
            file: string
            name: string
          }> = []
          const { readdir: _readdir, readFile: _readFile } = await import('node:fs/promises')
          const walkComponents = async (dir: string) => {
            const entries = await _readdir(dir, { withFileTypes: true })
            for (const e of entries) {
              const full = join(dir, e.name)
              if (e.isDirectory()) {
                await walkComponents(full)
              } else if (e.name === 'index.html') {
                const relDir = basename(dir)
                componentsList.push({ file: full, name: relDir })
              }
            }
          }
          await walkComponents(componentsDir)

          const _primitiveStore = new PrimitiveStoreImpl(db)
          const componentStore = new UiComponentStoreImpl(db)

          for (const comp of componentsList) {
            const html = await _readFile(comp.file, 'utf-8')
            const cssPath = join(componentsDir, comp.name, 'style.css')
            const jsPath = join(componentsDir, comp.name, 'script.js')
            let css = ''
            let scriptUrl: string | null = null
            try {
              css = await _readFile(cssPath, 'utf-8')
            } catch {
              /* optional */
            }
            try {
              await _readFile(jsPath, 'utf-8')
              scriptUrl = `/plugins/${pluginName}/components/${comp.name}/script.js`
            } catch {
              /* optional */
            }

            const primitiveId = `prim:cross:${comp.name}`
            const validated = UiComponentInputSchema.parse({
              id: `uc:provider:${pluginName}:${primitiveId}`,
              primitiveId,
              scope: 'provider',
              ownerId: pluginName,
              variant: null,
              componentKey: `${pluginName}.${comp.name}`,
              displayName: `${pluginName} ${comp.name}`,
              html,
              css,
              scriptUrl,
              status: 'published',
              author: 'plugin',
            })
            await componentStore.create(
              validated as unknown as Parameters<typeof componentStore.create>[0],
            )
          }
        }

        eventBus.emit({
          type: 'plugin:installed',
          data: {
            pluginId: pluginName,
            version: pluginVersion,
            capabilities: regResult.rowsAdded,
          },
        })

        await rm(extractDir, { recursive: true, force: true })

        return json({
          id: pluginName,
          name: pluginName,
          version: pluginVersion,
          status: existing ? 'updated' : 'installed',
          tablesAffected: regResult.tablesAffected,
          rowsAdded: regResult.rowsAdded,
          integrityHash,
        })
      }

      // DELETE /api/plugins/:id
      if (pathname.startsWith('/api/plugins/') && method === 'DELETE') {
        const pluginId = pathname.slice('/api/plugins/'.length).split('/')[0] ?? ''
        const plugin = await db.prisma.pluginRegistry.findUnique({
          where: { name: pluginId },
        })
        if (!plugin) {
          return errorResponse(`Plugin not found: ${pluginId}`, 'NotFound', 404)
        }

        const deps = await db.prisma.pluginRegistry.findMany({
          where: { dependsOnJson: { contains: pluginId } },
        })
        if (deps.length > 0) {
          return json(
            {
              error: `Plugin is a dependency of: ${deps.map((d) => d.name).join(', ')}`,
              code: 'DependencyConstraint',
              dependentPlugins: deps.map((d) => d.name),
            },
            409,
          )
        }

        const providerDef = await db.prisma.providerDefinition.findUnique({
          where: { slug: pluginId },
        })

        if (providerDef) {
          await db.prisma.providerCapability.deleteMany({
            where: { providerId: pluginId },
          })
          await db.prisma.providerConfig.deleteMany({
            where: { providerId: pluginId },
          })
          await db.prisma.providerModel.deleteMany({
            where: { providerId: pluginId },
          })
          await db.prisma.providerParser.deleteMany({
            where: { providerId: pluginId },
          })
          await db.prisma.providerEndpoint.deleteMany({
            where: { providerId: pluginId },
          })
          await db.prisma.providerAccount.deleteMany({
            where: { providerId: pluginId },
          })
          await db.prisma.providerDefinition.delete({
            where: { id: pluginId },
          })
        }

        await db.prisma.uiComponent.deleteMany({
          where: { scope: 'provider', ownerId: pluginId },
        })

        await db.prisma.pluginRegistry.delete({ where: { id: plugin.id } })

        const pluginDir = join(pluginsDir, pluginId)
        await rm(pluginDir, { recursive: true, force: true })

        eventBus.emit({
          type: 'plugin:uninstalled',
          data: { pluginId },
        })

        return json({ message: `Plugin ${pluginId} uninstalled` })
      }

      // POST /api/plugins/:id/upgrade
      if (
        pathname.startsWith('/api/plugins/') &&
        pathname.endsWith('/upgrade') &&
        method === 'POST'
      ) {
        const pluginId = pathname.slice('/api/plugins/'.length).split('/')[0] ?? ''
        const plugin = await db.prisma.pluginRegistry.findUnique({
          where: { name: pluginId },
        })
        if (!plugin) {
          return errorResponse(`Plugin not found: ${pluginId}`, 'NotFound', 404)
        }

        const body = (await req.json()) as PluginUpgradeRequest
        if (!body.filePath) {
          return errorResponse('filePath is required', 'MissingParam', 400)
        }

        const archivePath = body.filePath
        const newIntegrityHash = await computeFileHash(archivePath)
        const extractDir = join(stagingDir, `upgrade-${pluginId}-${newId()}`)
        await extractTarGz(archivePath, extractDir)

        const manifestPath = join(extractDir, 'manifest.json')
        let manifestRaw: string
        try {
          manifestRaw = await readFile(manifestPath, 'utf-8')
        } catch {
          await rm(extractDir, { recursive: true, force: true })
          return errorResponse('manifest.json not found', 'InvalidPlugin', 400)
        }

        const manifest = JSON.parse(manifestRaw)
        const newVersion = (manifest.version as string) ?? '0.1.0'

        if (body.migrationScript) {
          try {
            assertTrustedExpressionSource(body.migrationScript, 'plugin migration')
            const fn = new Function('db', 'oldVersion', 'newVersion', body.migrationScript)
            await fn(db, plugin.version, newVersion)
          } catch (err) {
            await rm(extractDir, { recursive: true, force: true })
            return errorResponse(
              `Migration script failed: ${err instanceof Error ? err.message : String(err)}`,
              'MigrationFailed',
              500,
            )
          }
        }

        const pluginDir = join(pluginsDir, pluginId)
        await mkdir(pluginDir, { recursive: true })

        const componentsDir = join(extractDir, 'components')
        const hasComponents = await stat(componentsDir)
          .then((s) => s.isDirectory())
          .catch(() => false)

        if (hasComponents) {
          const destComponents = join(pluginDir, 'components')
          await rm(destComponents, { recursive: true, force: true })
          const { cp } = await import('node:fs/promises')
          await cp(componentsDir, destComponents, { recursive: true })
        }

        const destManifest = join(pluginDir, 'manifest.json')
        await writeFile(destManifest, manifestRaw, 'utf-8')

        const { ProviderRegistrar } = await import('../engines/provider-registrar.js')
        const { ProviderManifestSchema } = await import('../schema/provider-manifest.js')
        const { ProviderStoreImpl } = await import('../storage/impl/provider-store-impl.js')

        const providerStore = new ProviderStoreImpl(db)
        const registrar = new ProviderRegistrar(providerStore, undefined, eventBus)
        const parsedManifest = ProviderManifestSchema.parse(manifest)
        await registrar.register(parsedManifest)

        await db.prisma.pluginRegistry.update({
          where: { id: plugin.id },
          data: {
            version: newVersion,
            filePath: archivePath,
            capabilities: JSON.stringify(
              (manifest.capabilities_config as Array<Record<string, unknown>>) ?? [],
            ),
            manifestJson: manifestRaw,
            integrityHash: newIntegrityHash,
            loadedAt: Date.now(),
            updatedAt: Date.now(),
          },
        })

        await rm(extractDir, { recursive: true, force: true })

        eventBus.emit({
          type: 'plugin:upgraded',
          data: { pluginId, fromVersion: plugin.version, toVersion: newVersion },
        })

        return json({
          id: pluginId,
          status: 'upgraded',
          fromVersion: plugin.version,
          toVersion: newVersion,
        })
      }

      // POST /api/plugins/:id/toggle
      if (
        pathname.startsWith('/api/plugins/') &&
        pathname.endsWith('/toggle') &&
        method === 'POST'
      ) {
        const pluginId = pathname.slice('/api/plugins/'.length).split('/')[0] ?? ''
        const plugin = await db.prisma.pluginRegistry.findUnique({
          where: { name: pluginId },
        })
        if (!plugin) {
          return errorResponse(`Plugin not found: ${pluginId}`, 'NotFound', 404)
        }

        const newActive = plugin.isActive === 1 ? 0 : 1
        await db.prisma.pluginRegistry.update({
          where: { id: plugin.id },
          data: { isActive: newActive, updatedAt: Date.now() },
        })

        await db.prisma.providerDefinition.updateMany({
          where: { slug: pluginId },
          data: { isActive: newActive },
        })

        if (newActive === 0) {
          await db.prisma.uiComponent.updateMany({
            where: { scope: 'provider', ownerId: pluginId, status: 'published' },
            data: { status: 'deprecated' },
          })
        } else {
          await db.prisma.uiComponent.updateMany({
            where: { scope: 'provider', ownerId: pluginId, status: 'deprecated' },
            data: { status: 'published' },
          })
        }

        eventBus.emit({
          type: newActive === 1 ? 'plugin:enabled' : 'plugin:disabled',
          data: { pluginId },
        })

        return json({ id: pluginId, isActive: newActive === 1 })
      }

      // GET /api/plugins — list all plugins
      if (pathname === '/api/plugins' && method === 'GET') {
        const plugins = await db.prisma.pluginRegistry.findMany({
          orderBy: { name: 'asc' },
        })
        return json(
          plugins.map((p) => ({
            id: p.id,
            name: p.name,
            version: p.version,
            description: p.description,
            isActive: p.isActive === 1,
            loadedAt: p.loadedAt ? Number(p.loadedAt) : null,
            createdAt: Number(p.createdAt),
            updatedAt: Number(p.updatedAt),
          })),
        )
      }

      // GET /api/plugins/:id — get single plugin
      if (pathname.startsWith('/api/plugins/') && method === 'GET') {
        const pluginId = pathname.slice('/api/plugins/'.length).split('/')[0] ?? ''
        const plugin = await db.prisma.pluginRegistry.findUnique({
          where: { name: pluginId },
        })
        if (!plugin) {
          return errorResponse(`Plugin not found: ${pluginId}`, 'NotFound', 404)
        }

        let currentHash: string | null = null
        try {
          currentHash = await computeFileHash(plugin.filePath)
        } catch {
          /* file may not exist */
        }

        return json({
          id: plugin.id,
          name: plugin.name,
          version: plugin.version,
          description: plugin.description,
          filePath: plugin.filePath,
          isActive: plugin.isActive === 1,
          dependsOn: JSON.parse(plugin.dependsOnJson),
          integrityValid:
            plugin.integrityHash && currentHash ? plugin.integrityHash === currentHash : null,
          loadedAt: plugin.loadedAt ? Number(plugin.loadedAt) : null,
          createdAt: Number(plugin.createdAt),
          updatedAt: Number(plugin.updatedAt),
        })
      }

      return errorResponse('Not found', 'NotFound', 404)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return errorResponse(msg, 'InternalError', 500)
    }
  }
}
