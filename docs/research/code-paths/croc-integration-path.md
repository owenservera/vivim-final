# Croc Integration — Code Path

**Date:** 2026-07-23  
**Status:** Design (not yet implemented)  

---

## 1. Integration Approach

### Primary: CLI Wrapper

```typescript
// src/engines/croc-transfer.ts (new engine)

import { spawn } from 'child_process';

interface SendResult {
  code: string;         // 9-char code for receiver
  filePath: string;
  fileSize: number;
  relayAddress?: string;
}

interface RecvResult {
  filePath: string;
  fileName: string;
  fileSize: number;
}

class CrocTransferEngine {
  private relayAddress?: string;
  private crocPath: string;

  constructor(options?: { relayAddress?: string; crocPath?: string }) {
    this.relayAddress = options?.relayAddress;
    this.crocPath = options?.crocPath ?? 'croc';
  }

  /**
   * Send file via croc CLI
   */
  async send(filePath: string, options?: { code?: string }): Promise<SendResult> {
    return new Promise((resolve, reject) => {
      const args = ['send'];
      
      if (this.relayAddress) {
        args.push('--relay', this.relayAddress);
      }
      if (options?.code) {
        args.push('--code', options.code);
      }
      
      args.push(filePath);

      const proc = spawn(this.crocPath, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        // Parse code from output: "Code is: XXX-XXX-XXX"
        const codeMatch = stdout.match(/Code is:\s*(\S+)/);
        if (codeMatch) {
          // Don't resolve yet - wait for transfer to complete
        }
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          const codeMatch = stdout.match(/Code is:\s*(\S+)/);
          const sizeMatch = stdout.match(/Sending file '.*?' \((\d+\.?\d*)\s*(KB|MB|GB)\)/);
          
          resolve({
            code: codeMatch?.[1] ?? '',
            filePath,
            fileSize: 0, // Parse from stdout
            relayAddress: this.relayAddress,
          });
        } else {
          reject(new Error(`croc send failed (code ${code}): ${stderr}`));
        }
      });
    });
  }

  /**
   * Receive file via croc CLI
   */
  async recv(code: string, outPath?: string): Promise<RecvResult> {
    return new Promise((resolve, reject) => {
      const args = ['recv'];
      
      if (this.relayAddress) {
        args.push('--relay', this.relayAddress);
      }
      if (outPath) {
        args.push('--out', outPath);
      }
      
      args.push(code);

      const proc = spawn(this.crocPath, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          const fileMatch = stdout.match(/File received to '(.+?)'/);
          const nameMatch = stdout.match(/Receiving file '(.+?)'/);
          
          resolve({
            filePath: fileMatch?.[1] ?? '',
            fileName: nameMatch?.[1] ?? '',
            fileSize: 0,
          });
        } else {
          reject(new Error(`croc recv failed (code ${code}): ${stderr}`));
        }
      });
    });
  }

  /**
   * Start self-hosted relay server
   */
  async startRelay(port?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['relay'];
      if (port) {
        args.push('--port', port.toString());
      }

      const proc = spawn(this.crocPath, args, { detached: true });
      
      proc.on('error', (err) => {
        reject(new Error(`Failed to start croc relay: ${err.message}`));
      });

      // Resolve after a short delay (relay starts asynchronously)
      setTimeout(() => resolve(), 1000);
    });
  }
}

export default CrocTransferEngine;
```

---

## 2. Capability Registration

```typescript
// src/engines/croc-caps.ts

import { makeCapability } from './capability-utils';
import { CrocTransferEngine } from './croc-transfer';

const crocEngine = new CrocTransferEngine();

export const sendFileCapability = makeCapability({
  id: 'cap:croc:send_file',
  slug: 'send_file',
  name: 'Send File',
  description: 'Send a file to another device using Croc',
  surfaces: ['cli', 'api'],
  parameters: {
    filePath: { type: 'string', required: true },
    code: { type: 'string', required: false },
  },
  execute: async (params) => {
    const result = await crocEngine.send(params.filePath, { code: params.code });
    return {
      success: true,
      data: {
        code: result.code,
        message: `File sent. Receiver can run: croc recv ${result.code}`,
      },
    };
  },
});

export const recvFileCapability = makeCapability({
  id: 'cap:croc:recv_file',
  slug: 'recv_file',
  name: 'Receive File',
  description: 'Receive a file from another device using Croc',
  surfaces: ['cli', 'api'],
  parameters: {
    code: { type: 'string', required: true },
    outPath: { type: 'string', required: false },
  },
  execute: async (params) => {
    const result = await crocEngine.recv(params.code, params.outPath);
    return {
      success: true,
      data: {
        filePath: result.filePath,
        fileName: result.fileName,
        message: `File received: ${result.fileName}`,
      },
    };
  },
});

export const startRelayCapability = makeCapability({
  id: 'cap:croc:start_relay',
  slug: 'start_relay',
  name: 'Start Croc Relay',
  description: 'Start a self-hosted Croc relay server',
  surfaces: ['cli', 'api'],
  parameters: {
    port: { type: 'number', required: false },
  },
  execute: async (params) => {
    await crocEngine.startRelay(params.port);
    return {
      success: true,
      data: {
        message: `Croc relay started on port ${params.port ?? 9009}`,
      },
    };
  },
});
```

---

## 3. API Route

```typescript
// src/server/routes/croc.ts

import { Router } from 'express';
import CrocTransferEngine from '../../engines/croc-transfer';

const router = Router();
const engine = new CrocTransferEngine();

router.post('/send', async (req, res) => {
  try {
    const { filePath, code } = req.body;
    const result = await engine.send(filePath, { code });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/recv', async (req, res) => {
  try {
    const { code, outPath } = req.body;
    const result = await engine.recv(code, outPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/relay', async (req, res) => {
  try {
    const { port } = req.body;
    await engine.startRelay(port);
    res.json({ success: true, port: port ?? 9009 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

---

## 4. Chrome Profile Sync Feature

```typescript
// src/engines/profile-sync.ts

import { CrocTransferEngine } from './croc-transfer';
import { ProfileAllocator } from '../executor/profile-allocator';
import { mkdir, tar } from 'fs/promises';

export class ProfileSyncEngine {
  private croc: CrocTransferEngine;
  private profileAllocator: ProfileAllocator;

  constructor(croc: CrocTransferEngine, profileAllocator: ProfileAllocator) {
    this.croc = croc;
    this.profileAllocator = profileAllocator;
  }

  /**
   * Export and send a chrome profile to another device
   */
  async exportAndSend(providerSlug: string, accountId: string): Promise<string> {
    // Get profile path
    const profileDir = this.profileAllocator.getProfileDir(providerSlug, accountId);
    
    // Create tar archive
    const archivePath = `/tmp/${providerSlug}-${accountId}-profile.tar.gz`;
    await this.createTarGz(profileDir, archivePath);
    
    // Send via croc
    const result = await this.croc.send(archivePath);
    
    // Return code for receiver
    return result.code;
  }

  /**
   * Receive and import a chrome profile from another device
   */
  async receiveAndImport(
    code: string,
    providerSlug: string,
    accountId: string
  ): Promise<void> {
    // Receive archive
    const result = await this.croc.recv(code, '/tmp');
    
    // Extract to profile directory
    const profileDir = this.profileAllocator.getProfileDir(providerSlug, accountId);
    await this.extractTarGz(result.filePath, profileDir);
    
    // Clean up archive
    await Bun.file(result.filePath).unlink();
  }

  private async createTarGz(source: string, dest: string): Promise<void> {
    // Use Bun's built-in tar or spawn tar command
    const proc = Bun.spawn(['tar', '-czf', dest, '-C', source, '.']);
    await proc.exited;
  }

  private async extractTarGz(archive: string, dest: string): Promise<void> {
    const proc = Bun.spawn(['tar', '-xzf', archive, '-C', dest]);
    await proc.exited;
  }
}
```

---

## 5. Docker Compose for Self-Hosted Relay

```yaml
# docker-compose.croc.yml

version: '3.8'

services:
  croc-relay:
    image: schollz/croc
    container_name: vivim-croc-relay
    command: relay
    ports:
      - "9009:9009"
      - "9010:9010"
      - "9011:9011"
      - "9012:9012"
      - "9013:9013"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "nc", "-z", "localhost", "9009"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 6. Test Plan

```typescript
// tests/unit/engines/croc-transfer.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import CrocTransferEngine from '../../../src/engines/croc-transfer';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { join } from 'path';

describe('CrocTransferEngine', () => {
  let engine: CrocTransferEngine;
  let tempDir: string;

  beforeAll(async () => {
    engine = new CrocTransferEngine({ relayAddress: 'localhost:9009' });
    tempDir = await mkdtemp('/tmp/croc-test-');
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('should send and receive a file', async () => {
    // Create test file
    const testFile = join(tempDir, 'test.txt');
    await writeFile(testFile, 'Hello, Croc!');

    // Send
    const sendResult = await engine.send(testFile);
    expect(sendResult.code).toMatch(/\S+-\S+-\S+/);

    // Receive
    const recvResult = await engine.recv(sendResult.code, tempDir);
    expect(recvResult.fileName).toBe('test.txt');
  });

  it('should reject on invalid code', async () => {
    await expect(engine.recv('invalid-code')).rejects.toThrow();
  });
});
```

---

## 7. File Structure

```
src/
  engines/
    croc-transfer.ts       # CLI wrapper engine
    croc-caps.ts           # Capability registration
    profile-sync.ts        # Chrome profile sync feature
  server/
    routes/
      croc.ts              # API routes

tests/
  unit/
    engines/
      croc-transfer.test.ts

docker-compose.croc.yml    # Self-hosted relay
```
