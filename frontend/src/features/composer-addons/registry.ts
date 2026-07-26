import type { ComposerAddOn } from '@/types/api';

import { ModelSelectorPill } from '@/components/chat/addons/ModelSelectorPill';
import { CapabilityChips } from '@/components/chat/addons/CapabilityChips';
import { StreamingStatusBar } from '@/components/chat/addons/StreamingStatusBar';
import { FooterHints } from '@/components/chat/addons/FooterHints';
import { QuoteBar } from '@/components/chat/addons/QuoteBar';
import { AttachmentPreview } from '@/components/chat/addons/AttachmentPreview';

export const BUILTIN_ADDONS: ComposerAddOn[] = [
  {
    key: 'modelSelector',
    position: 'top',
    Component: ModelSelectorPill,
    label: 'Model Selector',
    icon: '🧠',
  },
  {
    key: 'capabilityChips',
    position: 'top',
    Component: CapabilityChips,
    label: 'Capability Toggles',
    icon: '⚡',
  },
  {
    key: 'streamingStatus',
    position: 'bottom',
    Component: StreamingStatusBar,
    label: 'Streaming Status',
  },
  {
    key: 'footerHints',
    position: 'bottom',
    Component: FooterHints,
    label: 'Footer Hints',
  },
  {
    key: 'quoteBar',
    position: 'top',
    Component: QuoteBar,
    label: 'Quote Bar',
  },
  {
    key: 'attachmentPreview',
    position: 'bottom',
    Component: AttachmentPreview,
    label: 'Attachment Preview',
  },
];
