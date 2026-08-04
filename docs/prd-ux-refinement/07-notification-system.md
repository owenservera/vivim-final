# PRD #7: Notification System

## Problem Statement

The notification system has solid foundations but lacks key interactions:

- **NotificationsCenter exists** — bell icon + dropdown with filtering (All/Mentions/Errors/Completions/HITL), badge with unread count, mark all read, SSE real-time polling
- **DrawerSystem has NotificationsPanel** — simple list in a drawer, separate from the bell dropdown
- **Notification types exist** — full type system in `shared/notification.ts` with `NotificationKind`, `NotificationPriority`, `Notification`, `NotificationStats`
- **Backend API exists** — `/api/notification/list`, `/api/notification/stats`, `/api/notification/mark_all_read`
- **No individual mark read** — only "Mark all read", no per-notification interaction
- **No dismiss/snooze** — notifications accumulate, no way to remove or defer
- **No notification grouping** — capability results not batched by conversation
- **No notification preferences** — no mute, sound, or per-type settings
- **No real-time toast** — new notifications appear in the dropdown but no push toast

## Goals

1. **Individual notification actions** — mark read, dismiss, snooze per notification
2. **Notification grouping** — batch multiple capability results into single notification
3. **Notification preferences** — per-type mute, sound toggle (localStorage)
4. **Real-time toast** — push toast for new high-priority notifications
5. **Notification history** — persisted, show last 50, archived section

## Scope

| Area | Files | Action |
|------|-------|--------|
| Notification actions | `components/canvas/NotificationsCenter.tsx` (edit) | Add mark-read, dismiss, snooze per notification |
| Notification store | `hooks/useNotificationStore.ts` (new) | Zustand store: `{ notifications, unread, markRead, dismiss, snooze }` |
| Notification toast | `components/notifications/NotificationToast.tsx` (new) | Real-time toast for new high-priority notifications |
| Notification prefs | `components/notifications/NotificationPrefs.tsx` (new) | Settings panel for mute, sound, per-type |
| Notification grouping | `lib/groupNotifications.ts` (new) | Batch capability results by conversation |
| CSS | `globals.css` | Badge pulse animation, toast slide-in |

## Non-Goals

- Desktop notifications (Electron-only feature)
- Push notifications (mobile)
- Notification API webhooks

## Existing Code Assessment

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| NotificationsCenter | `components/canvas/NotificationsCenter.tsx` | ✅ Exists | Bell icon + dropdown, SSE real-time, smart filtering, mark all read, badge with unread count. Fetches from `/api/notification/list` and `/api/notification/stats` |
| DrawerSystem NotificationsPanel | `components/canvas/DrawerSystem.tsx:378` | ✅ Exists | Simple notification list in drawer, separate from bell dropdown. Fetches from `/api/notification/list?limit=10` |
| UpdateNotification | `components/canvas/UpdateNotification.tsx` | ✅ Exists | Handles app updates only, not general notifications |
| Notification types | `shared/notification.ts` | ✅ Exists | Full type system: `NotificationKind` (mention/error/completion/hitl/system/info), `NotificationPriority` (low/normal/high/urgent), `Notification`, `NotificationFilter`, `NotificationStats` |
| Backend API | `/api/notification/*` | ✅ Exists | `/api/notification/list`, `/api/notification/stats`, `/api/notification/mark_all_read` |
| Individual mark read | — | ❌ Missing | Only "Mark all read", no per-notification interaction |
| Dismiss/snooze | — | ❌ Missing | No way to remove or defer notifications |
| Notification grouping | — | ❌ Missing | Capability results not batched by conversation |
| Notification preferences | — | ❌ Missing | No mute, sound, or per-type settings |
| Real-time toast | — | ❌ Missing | New notifications appear in dropdown but no push toast |

## Implementation Steps

### Step 1: Individual notification actions
- Edit `components/canvas/NotificationsCenter.tsx`:
  - Add per-notification "Mark read" button (calls `/api/notification/mark_read`)
  - Add per-notification "Dismiss" button (calls `/api/notification/dismiss`)
  - Add per-notification "Snooze" dropdown (5min/1hr/tomorrow)
  - Add click-through to source entity (navigate to conversation/automation)

### Step 2: Notification store
- Create `hooks/useNotificationStore.ts` — Zustand store:
  - State: `notifications`, `unreadCount`, `loading`
  - Actions: `markRead(id)`, `dismiss(id)`, `snooze(id, duration)`, `markAllRead()`
  - Persist to localStorage for offline access

### Step 3: Notification grouping
- Create `lib/groupNotifications.ts`:
  - Group capability results by `sourceEntityId` (conversation)
  - Merge: "3 capabilities completed in Conversation X" instead of 3 separate notifications
  - Keep non-capability notifications ungrouped

### Step 4: Notification preferences
- Create `components/notifications/NotificationPrefs.tsx`:
  - Per-kind mute toggle (mention, error, completion, hitl, system, info)
  - Sound toggle (play sound on new notification)
  - Persist to `localStorage` under `vivim:notification-prefs`

### Step 5: Real-time toast
- Create `components/notifications/NotificationToast.tsx`:
  - Listen to SSE events for new notifications
  - Show toast for high-priority/urgent notifications
  - Toast includes: title, body, "View" button (opens NotificationsCenter), "Dismiss" button
  - Auto-dismiss after 5s

### Step 6: CSS animations
- Add to `globals.css`:
  - `@keyframes badge-pulse` — badge pulse animation for unread count
  - `@keyframes toast-slide-in` — toast slide-in from top-right

## Acceptance Criteria

- [ ] Individual mark read, dismiss, snooze per notification
- [ ] Notifications grouped by conversation
- [ ] Notification preferences saved to localStorage
- [ ] Toast appears for new high-priority notifications
- [ ] Notification history persists across page reloads
- [ ] Badge pulse animation on unread count
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

## Priority

**P2** — Enhances user awareness but not blocking core functionality.

## Estimated Effort

~3–4 hours. Store + panel actions + toast + grouping + preferences + CSS.
