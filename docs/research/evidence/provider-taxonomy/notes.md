# Provider Taxonomy Research — Raw Notes

## Date: 2026-07-12

### Platform Data Models Observed

#### Facebook
- Graph API v25.0: Post, Comment, Reaction, Message
- Post types: status, photo, video, link, album
- Reactions: like, love, haha, wow, sad, angry
- Messenger: text, media, stickers, reactions, inline buttons
- Auth: Facebook Login → Page Access Token → App Review

#### Instagram
- Graph API: Media (photo, video, reel, carousel), Story, Comment, DM
- Media types: IMAGE, VIDEO, CAROUSEL_ALBUM, REELS
- Stories: 24-hour duration, supports polls, questions, sliders
- DMs: text, media, reactions, voice messages
- Auth: Instagram Business Account → Facebook Page Link → Graph API Token

#### LinkedIn
- API: Post, Comment, Reaction, Message, Article
- Post types: text, image, video, document, article, poll
- Reactions: like, celebrate, insightful, funny, love, curious
- Messages: text, media, voice, events, job posts
- Auth: LinkedIn OAuth 2.0 → Member Token → App Review

#### WhatsApp
- Business API: text, media, template, interactive, location, sticker, reaction
- Template messages: header (media), body, footer
- Interactive: List Messages, Reply Buttons
- Session window: 24 hours for free-form messaging
- Auth: WhatsApp Business Account → Phone Number → Meta Business Manager

#### Telegram
- Bot API: text, photo, video, audio, document, sticker, poll, location, contact
- Keyboards: ReplyKeyboardMarkup, InlineKeyboardMarkup
- Callback queries for inline keyboard interactions
- Webhook-based updates
- Auth: Bot Token (from BotFather)

#### X (Twitter)
- API v2: Tweet, DM, List, Poll
- Tweet types: text, image, video, poll, card, thread
- DMs: text, media, events, quick replies
- Reactions: like (currently only one type)
- Auth: OAuth 2.0 → App Only Token → User Context Token

### Key Patterns Observed

1. **Universal Message Abstraction**: Unipile, Vonage, Umnico all abstract platform differences behind common message schema
2. **Capability Registry**: Service registry pattern (microservices.io) provides model for provider discovery
3. **NLP Integration**: Snips/Rasa/Amazon use hierarchical intent classification (Domain → Platform → Action)
4. **Seed-Driven Discovery**: Pre-populate DOM selectors, capabilities, auth requirements to eliminate runtime probing
5. **Entity Resolution**: Each platform has unique entity types (phone_number, post_id, chat_id, etc.)

### Database Schema Patterns

From ByteByteGo:
- Message table: message_id (PK), message_from, message_to, content, created_at
- Group message table: channel_id (PK), message_id (PK), user_id, content, created_at
- Key-value stores for chat history (Facebook uses HBase, Discord uses Cassandra)

From GeeksforGeeks:
- Message: MessageID (PK), SenderID, RecipientID, Content, Timestamp, ConversationID
- Conversation: ConversationID (PK), Participants, Subject
- User: UserID (PK), Username, Email
- Contact: ContactID (PK), UserID, ContactUserID
- Notification: NotificationID (PK), UserID, Content, Timestamp

### NLP Taxonomy Patterns

From Snips NLU:
- Two-phase pipeline: Deterministic Parser (regex) → Probabilistic Parser (CRF)
- Entity resolution: datetime → ISO format, numbers → normalized values
- Training data format for intent/entity definitions

From Rasa DIET:
- Shared transformer for intent + entity extraction
- CRF tagging layer for entity sequence prediction
- Co-existence Router: NLU vs LLM per-turn decision

From Amazon REIC:
- Hierarchical intent ontology (coarse → fine)
- RAG retrieval for intent classification
- 8x cost reduction vs LLMs

### Seed File Structure

Current seeds:
- seeds/adapters/ — Platform adapters (chat_app, coding_ide, search_engine, custom)
- seeds/parsers/ — Message parsers (chatgpt, claude, gemini, generic, system)
- seeds/harness/ — Browser automation (stealth, selector, navigation, login, composer, capture)

Proposed additions:
- seeds/taxonomy/ — Platform classifications, message types, capabilities, NLP patterns
- seeds/adapters/social_feed.adapter.ts — Feed platform adapter
- seeds/adapters/social_messaging.adapter.ts — Messaging platform adapter

### Integration Points

1. **ProviderCapabilityTaxonomy table** — Links ProviderDefinition to platform metadata
2. **NLCL entity resolution** — Reads nlpEntityTypesJson and nlpIntentPatternsJson
3. **CapabilityResolutionEngine** — Uses taxonomy for intent → capability matching
4. **SelectorStrategy** — Uses discoveryHintsJson for DOM selectors
5. **ProviderParser** — Uses messageTypesJson for message type classification
