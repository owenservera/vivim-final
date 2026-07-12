# v4 Phase Dependencies

## Intra-Phase Chains

All v4 phases have linear internal chains (each unit depends on the previous).

### Phase 1: E2E Bootstrap & Login
```
1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7
```

### Phase 2: Single-Turn Conversation
```
2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7 → 2.8
```

### Phase 3: Multi-Turn Conversation
```
3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6
```

### Phase 4: Three-Provider Demo
```
4.1 → 4.2 → 4.3 → 4.4 → 4.5
```

### Phase 5: Frontend Performance
```
5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6
```

### Phase 6: Platform Foundation
```
6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.6
```

### Phase 7: Reliability & Persistence
```
7.1 → 7.2 → 7.3 → 7.4 → 7.5 → 7.6 → 7.7
```

### Phase 8: Resource Management
```
8.1 → 8.2 → 8.3
```

### Phase 9: Observability
```
9.1 → 9.2 → 9.3 → 9.4 → 9.5
```

### Phase 10: Frontend Resilience
```
10.1 → 10.2 → 10.3
```

### Phase 11: Stealth Core
```
11.1 → 11.2 → 11.3 → 11.4
```

### Phase 12: Fingerprint Spoofing
```
12.1 → 12.2 → 12.3 → 12.4
```

### Phase 13: Human Simulation
```
13.1 → 13.2 → 13.3
```

### Phase 14: Profile & Trace
```
14.1 → 14.2 → 14.3 → 14.4
```

## Inter-Phase Dependencies

```
Phase 1 → Phase 2 → Phase 3 → Phase 4
                                         ↓
Phase 5 → Phase 6 → Phase 7 → Phase 8
                                         ↓
Phase 9 → Phase 10 → Phase 11 → Phase 12 → Phase 13 → Phase 14
```

**Rationale:** Linear progression. Each phase builds on the previous.
