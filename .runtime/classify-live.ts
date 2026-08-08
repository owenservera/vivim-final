// Live proof: the registry classifier against real running processes.
import { OpenCodeInstanceRegistry } from '../src/engines/opencode/opencode-instance-registry.js'

const r = new OpenCodeInstanceRegistry()
// Record what the OLD supervisor would have spawned (our known serve: pid 3628 -> re-exec 3332 on 23863)
const id = r.recordSpawn({ pid: 3628, port: 23863, parentPid: 10476, binary: 'opencode', cwd: process.cwd() })
r.recordReady(id, 3628, 23863)

console.log('=== classifyLive() ===')
for (const p of r.classifyLive()) {
  console.log(`${p.managed ? 'MANAGED  ' : 'EXTERNAL '} pid=${p.pid} kind=${p.kind} port=${p.port ?? '-'} inst=${p.instanceId ?? '-'}`)
  if (p.managed) console.log('   cmd:', p.commandLine.slice(0, 90))
}
console.log('\n=== managedServe() ===')
console.log(JSON.stringify(r.managedServe(), null, 2))
