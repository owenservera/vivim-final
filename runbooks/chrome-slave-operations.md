# Chrome Slave Architecture — Runbook

## Overview
This runbook covers operational procedures for the Chrome Slave fleet architecture (Phases 0-10).

---

## 1. Chrome Crash Recovery

### Symptoms
- Slave state transitions to `crashed`
- Event bus emits `SlaveCrashed`
- Recovery orchestrator applies class-specific strategy

### Diagnosis
```bash
# Check recent crashes
bun run devops fleet status --provider=chatgpt

# Check recovery attempts
bun run devops fleet recovery --slave-id=<id>

# Check metrics
curl http://localhost:9420/metrics | grep chrome_recovery
```

### Resolution
1. **RendererCrash**: Automatic recovery via `renavigate_only`
2. **BrowserCrash**: Automatic recovery via `ensure_running`
3. **OOM**: Automatic recovery via `kill_disable_gpu`
4. **AuthFailure**: Manual login required — `bun run devops setup --provider=<slug>`

---

## 2. Fleet Worker Failure

### Symptoms
- Worker node status: `degraded` or `disconnected`
- No Chrome instances spawning on affected worker

### Diagnosis
```bash
# Check worker health
bun run devops fleet health

# Check worker stats
bun run devops fleet stats --worker-id=<id>
```

### Resolution
1. Restart the worker process
2. If persistent, unregister and re-register the worker
3. Check network connectivity between fleet manager and worker

---

## 3. Memory Pressure

### Symptoms
- System pressure gauge > 0.8
- Adaptive limiter blocking new spawns
- `MEMORY_EXCESS` events in event bus

### Diagnosis
```bash
# Check system pressure
curl http://localhost:9420/metrics | grep system_pressure

# Check Chrome RSS usage
bun run devops fleet rss

# Check GPU memory
bun run devops fleet gpu
```

### Resolution
1. Reduce `warmPoolSize` in config
2. Increase `rssThresholdMb` if legitimate workloads exceed threshold
3. Scale out to additional workers

---

## 4. Auth Failure

### Symptoms
- Slave navigates to login URL instead of provider
- Event bus emits `AuthFailure`

### Diagnosis
```bash
# Check cookie files
ls -la chrome-profiles/<provider>/<accountId>/Default/Cookies

# Check if profile is authenticated
bun run devops status --provider=<slug>
```

### Resolution
1. Run interactive login: `bun run devops setup --provider=<slug> --relogin`
2. Verify cookie files exist and are recent
3. If profile corruption: `bun run devops profile allocate --provider=<slug> --force`

---

## 5. Event Bus Backpressure

### Symptoms
- Event history growing unbounded
- DB subscriber lag increasing
- Memory usage climbing

### Diagnosis
```bash
# Check event bus stats
bun run devops fleet eventbus stats

# Check DB subscriber lag
bun run devops fleet eventbus lag
```

### Resolution
1. Increase event history TTL (default 1000 events)
2. Scale DB subscriber workers
3. Reduce event verbosity for high-frequency events

---

## 6. Scheduler Starvation

### Symptoms
- Low-priority tasks never execute
- High-priority queue growing
- Resource class weights uneven

### Diagnosis
```bash
# Check scheduler queue lengths
bun run devops fleet scheduler stats

# Check resource class utilization
bun run devops fleet scheduler utilization
```

### Resolution
1. Adjust resource class weights in scheduler config
2. Increase max priority to prevent starvation
3. Enable aging policy to boost old requests

---

## 7. Provider Plugin Issues

### Symptoms
- Provider-specific operations failing
- Plugin not registered
- Selector mismatch errors

### Diagnosis
```bash
# Check registered plugins
bun run devops fleet providers list

# Check plugin health
bun run devops fleet providers health --provider=<slug>
```

### Resolution
1. Verify plugin is registered in `src/engines/providers/plugins/`
2. Check provider manifest in `seeds/providers/<slug>.json`
3. Run provider-specific tests: `bun run devops test --provider=<slug>`

---

## Emergency Procedures

### Kill All Chrome Instances
```bash
bun run devops fleet kill-all
```

### Force Fleet Reset
```bash
bun run devops fleet reset --confirm
```

### Disable Auto-Recovery
```bash
export CHROME_RECOVERY_ENABLED=false
bun run dev
```

### Enable Debug Logging
```bash
export LOG_LEVEL=debug
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
bun run dev
```
