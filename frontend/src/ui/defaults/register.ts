import { registerDefault, registerCatalogEntry } from '../registry.js';
import * as Defaults from './index.js';

for (const [key, component] of Object.entries(Defaults)) {
  if (typeof component === 'function') {
    registerCatalogEntry(`default.${key}`, component as never);
  }
}

registerDefault('chat.entry', Defaults.DefaultChatEntry);
registerDefault('chat.sidebar', Defaults.DefaultChatSidebar);
registerDefault('chat.thread', Defaults.DefaultChatThread);
registerDefault('chat.bubble', Defaults.DefaultChatBubble);
registerDefault('chat.composer', Defaults.DefaultChatComposer);
registerDefault('chat.send', Defaults.DefaultChatSend);
registerDefault('chat.attach', Defaults.DefaultChatAttach);
registerDefault('chat.streaming', Defaults.DefaultChatStreaming);
registerDefault('chat.result', Defaults.DefaultChatResult);
registerDefault('chat.confirm', Defaults.DefaultChatConfirm);
registerDefault('chat.error', Defaults.DefaultChatError);
registerDefault('chat.header', Defaults.DefaultChatHeader);
registerDefault('chat.actionBar', Defaults.DefaultChatActionBar);
