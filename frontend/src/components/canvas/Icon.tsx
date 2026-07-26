'use client';

/**
 * components/canvas/Icon.tsx
 * --------------------------------------------------------------------
 * SOTA icon system — clean SVG icons, no emojis.
 * 24x24 viewBox, stroke-based, 1.5px stroke width.
 * Renders any icon by name from the Icon registry.
 */

import { type SVGProps, useMemo } from 'react';

export type IconName =
  | 'search' | 'bell' | 'palette' | 'chevron-right' | 'chevron-down' | 'chevron-up'
  | 'chevron-left' | 'close' | 'plus' | 'minus' | 'check' | 'dots' | 'drag'
  | 'pin' | 'lock' | 'unlock' | 'expand' | 'collapse' | 'fullscreen'
  | 'duplicate' | 'external' | 'settings' | 'connections' | 'thread'
  | 'remux' | 'inspect' | 'history' | 'export' | 'trash' | 'play' | 'pause'
  | 'stop' | 'save' | 'undo' | 'redo' | 'bold' | 'italic' | 'underline'
  | 'code' | 'strike' | 'find' | 'split' | 'layers' | 'grid' | 'list'
  | 'kanban' | 'timeline' | 'mindmap' | 'cluster' | 'free' | 'chat'
  | 'document' | 'media' | 'bolt' | 'robot' | 'terminal' | 'chart'
  | 'shield' | 'template' | 'users' | 'sparkle' | 'arrow-right' | 'arrow-down'
  | 'arrow-up' | 'filter' | 'sort' | 'more' | 'command' | 'sidebar'
  | 'panel-right' | 'panel-left' | 'panel-bottom' | 'panel-top' | 'grip' | 'dot'
  | 'circle' | 'circle-filled' | 'circle-half' | 'circle-ring'
  | 'alert' | 'info' | 'success' | 'warning' | 'cube' | 'link'
  | 'unlink' | 'eye' | 'eye-off' | 'copy' | 'clipboard' | 'download'
  | 'upload' | 'refresh' | 'sync' | 'branch' | 'merge' | 'git'
  | 'database' | 'server' | 'cloud' | 'wifi' | 'wifi-off' | 'cpu'
  | 'memory' | 'clock' | 'calendar' | 'map' | 'compass' | 'flag'
  | 'bookmark' | 'star' | 'heart' | 'tag' | 'folder' | 'file'
  | 'image' | 'video' | 'audio' | 'table' | 'function' | 'variable'
  | 'brackets' | 'terminal-square' | 'activity' | 'pulse' | 'zap'
  | 'fire' | 'snowflake' | 'sun' | 'moon' | 'monitor' | 'contrast'
  | 'menu' | 'message-square' | 'move' | 'trash-2' | 'x';

const ICON_PATHS: Record<IconName, string> = {
  search: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z',
  bell: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
  palette: 'M12 2a10 10 0 100 20 10 10 0 000-20zM8 8a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM18 8a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15.5 13a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM8 18a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z',
  'chevron-right': 'M9 18l6-6-6-6',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-up': 'M18 15l-6-6-6 6',
  'chevron-left': 'M15 18l-6-6 6-6',
  close: 'M18 6L6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M20 6L9 17l-5-5',
  dots: 'M12 13a1 1 0 100-2 1 1 0 000 2zM19 13a1 1 0 100-2 1 1 0 000 2zM5 13a1 1 0 100-2 1 1 0 000 2z',
  drag: 'M9 5m-1 0a1 1 0 102 0 1 1 0 10-2 0zM9 12m-1 0a1 1 0 102 0 1 1 0 10-2 0zM9 19m-1 0a1 1 0 102 0 1 1 0 10-2 0zM15 5m-1 0a1 1 0 102 0 1 1 0 10-2 0zM15 12m-1 0a1 1 0 102 0 1 1 0 10-2 0zM15 19m-1 0a1 1 0 102 0 1 1 0 10-2 0z',
  pin: 'M12 17v5M9 10.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V16a1 1 0 001 1h12a1 1 0 001-1v-.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V7a1 1 0 011-1 2 2 0 002-2V3H6v1a2 2 0 002 2 1 1 0 011 1z',
  lock: 'M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2zM7 11V7a5 5 0 0110 0v4',
  unlock: 'M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2zM7 11V7a5 5 0 019.9-1',
  expand: 'M21 21l-6-6m6 6v-4.8m0 4.8h-4.8M3 16.2V21m0 0h4.8M3 21l6-6M21 7.8V3m0 0h-4.8M21 3l-6 6M3 7.8V3m0 0h4.8M3 3l6 6',
  collapse: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7',
  fullscreen: 'M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3',
  duplicate: 'M16 3h4a2 2 0 012 2v4M8 3H4a2 2 0 00-2 2v4m18 8v4a2 2 0 01-2 2h-4M3 16v4a2 2 0 002 2h4M8 8h8v8H8z',
  external: 'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  connections: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  thread: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  remux: 'M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16',
  inspect: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16zM11 7v4M11 15h.01',
  history: 'M3 3v5h5M3.05 13A9 9 0 1012 3a9 9 0 00-8.95 10zM12 7v5l3 3',
  export: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5-5 5 5M12 5v12',
  trash: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6',
  play: 'M5 3l14 9-14 9V3z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  stop: 'M6 6h12v12H6z',
  save: 'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8',
  undo: 'M3 7v6h6M21 17a9 9 0 00-9-9 9 9 0 00-6.7 3L3 13',
  redo: 'M21 7v6h-6M3 17a9 9 0 019-9 9 9 0 016.7 3L21 13',
  bold: 'M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6zM6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z',
  italic: 'M19 4h-9M14 20H5M15 4L9 20',
  underline: 'M6 3v7a6 6 0 0012 0V3M4 21h16',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  strike: 'M16 4H9a3 3 0 00-2.83 4M14 12a4 4 0 014 4M14 4v4M5 20h14M18 20a4 4 0 00-4-4h-4a4 4 0 01-4-4',
  find: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z',
  split: 'M16 3h5v5M4 20l17-17M21 3v5M8 3H3v5M4 16v5h5M20 4l-7 7',
  layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  kanban: 'M3 3h18v18H3zM7 7v10M12 7v6M17 7v8',
  timeline: 'M3 12h4l3-9 4 18 3-9h4',
  mindmap: 'M12 2a4 4 0 014 4 4 4 0 01-1 2.65A4 4 0 0118 12a4 4 0 01-1 2.65A4 4 0 0116 18a4 4 0 01-8 0 4 4 0 01-1-3.35A4 4 0 016 12a4 4 0 013-3.35A4 4 0 018 6a4 4 0 014-4zM12 8v8M8 12h8',
  cluster: 'M12 2a3 3 0 100 6 3 3 0 000-6zM5 16a3 3 0 100 6 3 3 0 000-6zM19 16a3 3 0 100 6 3 3 0 000-6z',
  free: 'M3 3l7 19 2-8 8-2L3 3z',
  chat: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z',
  document: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  media: 'M23 7l-7 5 7 5V7zM1 5h15v14H1a1 1 0 01-1-1V6a1 1 0 011-1z',
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  robot: 'M12 8V4H8M4 8h16v12H4zM2 14h2M20 14h2M9 14h.01M15 14h.01',
  terminal: 'M4 17l6-6-6-6M12 19h8',
  chart: 'M18 20V10M12 20V4M6 20v-6',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  template: 'M3 3h18v18H3zM3 9h18M9 21V9',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M13 7a4 4 0 11-8 0 4 4 0 018 0zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  sparkle: 'M12 3l1.9 5.8a2 2 0 001.3 1.3l5.8 1.9-5.8 1.9a2 2 0 00-1.3 1.3L12 21l-1.9-5.8a2 2 0 00-1.3-1.3L3 12l5.8-1.9a2 2 0 001.3-1.3L12 3z',
  'arrow-right': 'M5 12h14M12 5l7 7-7 7',
  'arrow-down': 'M12 5v14M5 12l7 7 7-7',
  'arrow-up': 'M12 19V5M5 12l7-7 7 7',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  sort: 'M3 6h18M6 12h12M10 18h4',
  more: 'M12 13a1 1 0 100-2 1 1 0 000 2zM19 13a1 1 0 100-2 1 1 0 000 2zM5 13a1 1 0 100-2 1 1 0 000 2z',
  command: 'M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3H6a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3V6a3 3 0 00-3-3 3 3 0 00-3 3 3 3 0 003 3h12a3 3 0 003-3 3 3 0 00-3-3z',
  sidebar: 'M3 3h18v18H3zM9 3v18',
  'panel-right': 'M3 3h18v18H3zM15 3v18',
  'panel-left': 'M3 3h18v18H3zM9 3v18',
  'panel-bottom': 'M3 3h18v18H3zM3 15h18',
  'panel-top': 'M3 3h18v18H3zM3 9h18',
  grip: 'M9 5m-1 0a1 1 0 102 0 1 1 0 10-2 0zM9 12m-1 0a1 1 0 102 0 1 1 0 10-2 0zM9 19m-1 0a1 1 0 102 0 1 1 0 10-2 0zM15 5m-1 0a1 1 0 102 0 1 1 0 10-2 0zM15 12m-1 0a1 1 0 102 0 1 1 0 10-2 0zM15 19m-1 0a1 1 0 102 0 1 1 0 10-2 0z',
  dot: 'M12 13a1 1 0 100-2 1 1 0 000 2z',
  circle: 'M12 12m-10 0a10 10 0 1020 0 10 10 0 10-20 0z',
  'circle-filled': 'M12 12m-10 0a10 10 0 1020 0 10 10 0 10-20 0z',
  'circle-half': 'M12 12m-10 0a10 10 0 1020 0 10 10 0 10-20 0zM12 2v20',
  'circle-ring': 'M12 7m-5 0a5 5 0 1010 0 5 5 0 10-10 0zM12 17m-5 0a5 5 0 1010 0 5 5 0 10-10 0z',
  alert: 'M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  info: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01',
  success: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',
  warning: 'M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  cube: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',
  link: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  unlink: 'M15 7h3a5 5 0 010 10h-3M9 17H6a5 5 0 010-10h3M8 12h8',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z',
  'eye-off': 'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22',
  copy: 'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M9 2h6a1 1 0 011 1v2a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1z',
  clipboard: 'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M9 2h6a1 1 0 011 1v2a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1z',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  sync: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  branch: 'M6 3v12M6 21a3 3 0 100-6 3 3 0 000 6zM18 9a3 3 0 100-6 3 3 0 000 6zM6 9a3 3 0 110-6M18 15a3 3 0 110 6M6 12a9 9 0 006-6M18 9a9 9 0 01-6 6',
  merge: 'M6 3v6a6 6 0 006 6 6 6 0 006-6V3M6 21a3 3 0 100-6 3 3 0 000 6zM18 21a3 3 0 100-6 3 3 0 000 6z',
  git: 'M16 4a3 3 0 11-6 0 3 3 0 016 0zM8 20a3 3 0 11-6 0 3 3 0 016 0zM20 12a3 3 0 11-6 0 3 3 0 016 0zM8 20h8a4 4 0 004-4M5.17 17.83l6.59-6.59',
  database: 'M12 8a8 8 0 100-4 8 8 0 000 4zM4 6v6c0 2 4 4 8 4s8-2 8-4V6M4 12v6c0 2 4 4 8 4s8-2 8-4v-6',
  server: 'M2 2h20v6H2zM2 16h20v6H2zM6 6h.01M6 18h.01',
  cloud: 'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z',
  wifi: 'M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01',
  'wifi-off': 'M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.58 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01',
  cpu: 'M4 4h16v16H4zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3',
  memory: 'M6 19v-3M10 19v-3M14 19v-3M18 19v-3M8 11V9M16 11V9M12 11V9M2 15h20M2 7a2 2 0 012-2h16a2 2 0 012 2v1.1a2 2 0 000 3.837V17a2 2 0 01-2 2H4a2 2 0 01-2-2v-5.063A2 2 0 002 8.1V7z',
  clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
  calendar: 'M3 4h18v18H3zM3 10h18M8 2v4M16 2v4',
  map: 'M1 6v15l7-3 8 3 7-3V3l-7 3-8-3-7 3zM8 3v15M16 6v15',
  compass: 'M12 22a10 10 0 100-20 10 10 0 000 20zM16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22V15',
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  heart: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  tag: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01',
  folder: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  file: 'M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9zM13 2v7h7',
  image: 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM8.5 11a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21',
  video: 'M23 7l-7 5 7 5V7zM1 5h15v14H1a1 1 0 01-1-1V6a1 1 0 011-1z',
  audio: 'M3 18v-6a9 9 0 0118 0v6M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z',
  table: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  function: 'M4 7h4v4a4 4 0 11-4 4M16 7v10M14 7h4M14 17h4',
  variable: 'M3 7l3 10 3-10M13 7l3 10 3-10M11 4v16',
  brackets: 'M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h3M16 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3',
  'terminal-square': 'M4 17l6-6-6-6M12 19h8',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  pulse: 'M22 12h-2l-3 9L9 3l-3 9H2',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  fire: 'M12 2s4 4 4 8a4 4 0 11-8 0c0-1 .5-2 1-2.5C9 9 12 6 12 2zM12 12a2 2 0 100 4 2 2 0 000-4z',
  snowflake: 'M12 2v20M4.93 4.93l14.14 14.14M2 12h20M4.93 19.07L19.07 4.93',
  sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  moon: 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z',
  monitor: 'M2 3h20v14H2zM8 21h8M12 17v4',
  contrast: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 2v20',
  menu: 'M3 12h18M3 6h18M3 18h18',
  'message-square': 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  move: 'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3-3-3-3M2 12h20M12 2v20',
  'trash-2': 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6',
  x: 'M18 6L6 18M6 6l12 12',
};

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, className, ...props }: IconProps) {
  const path = useMemo(() => ICON_PATHS[name] ?? ICON_PATHS.circle, [name]);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d={path} />
    </svg>
  );
}

/** Map surface slugs to icon names. */
export const SURFACE_ICONS: Record<string, IconName> = {
  chat: 'chat',
  docs: 'document',
  editor: 'document',
  media: 'video',
  automation: 'bolt',
  agents: 'robot',
  shell: 'terminal',
  audit: 'chart',
  rbac: 'shield',
  templates: 'template',
  zlayers: 'layers',
};

/** Map vCard action ids to icon names. */
export const ACTION_ICONS: Record<string, IconName> = {
  collapse: 'collapse',
  expand: 'expand',
  pin: 'pin',
  fullscreen: 'fullscreen',
  duplicate: 'duplicate',
  detach: 'external',
  settings: 'settings',
  connections: 'connections',
  thread: 'thread',
  remux: 'remux',
  inspect: 'inspect',
  history: 'history',
  lock: 'lock',
  export: 'export',
  remove: 'trash',
  new_thread: 'plus',
  branch: 'branch',
  merge: 'merge',
  clear_context: 'trash',
  export_transcript: 'export',
  model_select: 'robot',
  system_prompt: 'document',
  temperature: 'settings',
  configure: 'settings',
  test_run: 'play',
  view_schema: 'brackets',
  enable_disable: 'dot',
  permissions: 'shield',
  recall: 'search',
  forget: 'trash',
  consolidate: 'merge',
  memory_export: 'export',
  memory_import: 'upload',
  file_open: 'document',
  download: 'download',
  upload: 'upload',
  version_history: 'history',
  diff: 'git',
  health: 'activity',
  rate_limits: 'clock',
  switch_model: 'refresh',
  test_connection: 'link',
  usage: 'chart',
};

/** Map layout intents to icon names. */
export const LAYOUT_ICONS: Record<string, IconName> = {
  cluster: 'cluster',
  timeline: 'timeline',
  mindmap: 'mindmap',
  kanban: 'kanban',
  grid: 'grid',
  free: 'free',
};

/** Map stream states to icon names. */
export const STREAM_ICONS: Record<string, IconName> = {
  idle: 'circle',
  connecting: 'circle-half',
  streaming: 'circle-filled',
  thinking: 'circle-ring',
  paused: 'circle-half',
  complete: 'check',
  error: 'alert',
};
