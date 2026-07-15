// src/engines/cdp-discovery.ts
// CDP protocol discovery — enumerate domains/commands from a protocol descriptor.
//
// CDP has no runtime "list all methods" command, so discovery parses a protocol
// descriptor (the canonical protocol.json shape) or falls back to a curated, always
// available static catalog. Per capability-driven-chat, each enumerated command
// becomes a capability (see cdp-capability-registrar.ts, Unit U2).
//
// Governor Canon holds: this module never opens a CDP socket. It only describes
// the protocol so an injected executor (ChromeGovernor) can drive the commands.

import { EngineError } from '../errors.js'

export interface CdpParameter {
  name: string
  type: string
  optional: boolean
  description: string
}

export interface CdpMethodDescriptor {
  domain: string
  method: string
  /** Fully qualified name: `${domain}.${method}`. */
  fullName: string
  description: string
  parameters: CdpParameter[]
  returns: CdpParameter[]
  deprecated: boolean
  redirect?: string
}

/** The canonical CDP protocol.json shape (subset the parser relies on). */
export interface CdpProtocolJson {
  domains?: Array<{
    name: string
    description?: string
    commands?: Array<{
      name: string
      description?: string
      deprecated?: boolean | string
      redirect?: string
      parameters?: Array<{ name: string; type?: string; optional?: boolean; description?: string }>
      returns?: Array<{ name: string; type?: string; optional?: boolean; description?: string }>
    }>
  }>
}

function toParam(p: {
  name: string
  type?: string
  optional?: boolean
  description?: string
}): CdpParameter {
  return {
    name: p.name,
    type: p.type ?? 'any',
    optional: p.optional ?? false,
    description: p.description ?? '',
  }
}

/** Parse a CDP protocol.json descriptor into flat method descriptors. */
export function parseCdpProtocolJson(protocol: unknown): CdpMethodDescriptor[] {
  if (!protocol || typeof protocol !== 'object') {
    throw new EngineError('parseCdpProtocolJson: protocol must be an object')
  }
  const domains = (protocol as CdpProtocolJson).domains ?? []
  const out: CdpMethodDescriptor[] = []
  for (const d of domains) {
    const domain = d.name
    for (const cmd of d.commands ?? []) {
      out.push({
        domain,
        method: cmd.name,
        fullName: `${domain}.${cmd.name}`,
        description: cmd.description ?? `${domain}.${cmd.name}`,
        parameters: (cmd.parameters ?? []).map(toParam),
        returns: (cmd.returns ?? []).map(toParam),
        deprecated: cmd.deprecated != null,
        redirect: cmd.redirect,
      })
    }
  }
  return out
}

/**
 * Curated, always-available fallback catalog (no browser required). Mirrors the
 * shape of a real protocol.json so discovery works offline and in CI.
 */
export const CDP_PROTOCOL_CATALOG: CdpMethodDescriptor[] = [
  // Runtime
  {
    domain: 'Runtime',
    method: 'enable',
    fullName: 'Runtime.enable',
    description: 'Enables reporting of execution contexts creation.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Runtime',
    method: 'disable',
    fullName: 'Runtime.disable',
    description: 'Disables reporting of execution contexts creation.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Runtime',
    method: 'evaluate',
    fullName: 'Runtime.evaluate',
    description: 'Evaluates expression on global object.',
    parameters: [
      {
        name: 'expression',
        type: 'string',
        optional: false,
        description: 'Expression to evaluate.',
      },
      {
        name: 'returnByValue',
        type: 'boolean',
        optional: true,
        description: 'Whether the result is expected to be a JSON object.',
      },
      {
        name: 'awaitPromise',
        type: 'boolean',
        optional: true,
        description: 'Whether execution should await for resulting promise.',
      },
    ],
    returns: [
      { name: 'result', type: 'RemoteObject', optional: false, description: 'Evaluation result.' },
    ],
    deprecated: false,
  },
  {
    domain: 'Runtime',
    method: 'callFunctionOn',
    fullName: 'Runtime.callFunctionOn',
    description: 'Calls function with given declaration on given object.',
    parameters: [
      {
        name: 'objectId',
        type: 'string',
        optional: false,
        description: 'Identifier of the object to call function on.',
      },
      {
        name: 'functionDeclaration',
        type: 'string',
        optional: false,
        description: 'Declaration of the function to call.',
      },
    ],
    returns: [
      { name: 'result', type: 'RemoteObject', optional: false, description: 'Call result.' },
    ],
    deprecated: false,
  },
  {
    domain: 'Runtime',
    method: 'getProperties',
    fullName: 'Runtime.getProperties',
    description: 'Returns properties of a given object.',
    parameters: [
      {
        name: 'objectId',
        type: 'string',
        optional: false,
        description: 'Id of the object to return properties for.',
      },
    ],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Runtime',
    method: 'awaitPromise',
    fullName: 'Runtime.awaitPromise',
    description: 'Awaits promise to be resolved.',
    parameters: [
      {
        name: 'promiseObjectId',
        type: 'string',
        optional: false,
        description: 'Id of the promise.',
      },
    ],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Runtime',
    method: 'globalLexicalScopeNames',
    fullName: 'Runtime.globalLexicalScopeNames',
    description: 'Returns names of all registered global lexical scopes.',
    parameters: [],
    returns: [],
    deprecated: false,
  },

  // Page
  {
    domain: 'Page',
    method: 'enable',
    fullName: 'Page.enable',
    description: 'Enables page domain notifications.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Page',
    method: 'disable',
    fullName: 'Page.disable',
    description: 'Disables page domain notifications.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Page',
    method: 'navigate',
    fullName: 'Page.navigate',
    description: 'Navigates current page to given URL.',
    parameters: [
      { name: 'url', type: 'string', optional: false, description: 'URL to navigate to.' },
    ],
    returns: [
      {
        name: 'frameId',
        type: 'string',
        optional: false,
        description: 'Id of the frame that was navigated.',
      },
    ],
    deprecated: false,
  },
  {
    domain: 'Page',
    method: 'reload',
    fullName: 'Page.reload',
    description: 'Reloads the page.',
    parameters: [
      {
        name: 'ignoreCache',
        type: 'boolean',
        optional: true,
        description: 'If true, the cache is ignored.',
      },
    ],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Page',
    method: 'close',
    fullName: 'Page.close',
    description: 'Closes the page.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Page',
    method: 'captureScreenshot',
    fullName: 'Page.captureScreenshot',
    description: 'Captures a screenshot of the page.',
    parameters: [
      {
        name: 'format',
        type: 'string',
        optional: true,
        description: 'Image compression format (png, jpeg).',
      },
    ],
    returns: [
      { name: 'data', type: 'string', optional: false, description: 'Base64-encoded image data.' },
    ],
    deprecated: false,
  },
  {
    domain: 'Page',
    method: 'handleJavaScriptDialog',
    fullName: 'Page.handleJavaScriptDialog',
    description: 'Accepts or dismisses a JS dialog.',
    parameters: [
      {
        name: 'accept',
        type: 'boolean',
        optional: false,
        description: 'Whether to accept the dialog.',
      },
    ],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Page',
    method: 'crash',
    fullName: 'Page.crash',
    description: 'Crashes the renderer.',
    parameters: [],
    returns: [],
    deprecated: false,
  },

  // DOM
  {
    domain: 'DOM',
    method: 'enable',
    fullName: 'DOM.enable',
    description: 'Enables DOM agent for the given page.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'DOM',
    method: 'disable',
    fullName: 'DOM.disable',
    description: 'Disables DOM agent for the given page.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'DOM',
    method: 'getDocument',
    fullName: 'DOM.getDocument',
    description: 'Returns the root DOM node.',
    parameters: [
      { name: 'depth', type: 'number', optional: true, description: 'Maximum depth to traverse.' },
    ],
    returns: [{ name: 'root', type: 'Node', optional: false, description: 'Root node.' }],
    deprecated: false,
  },
  {
    domain: 'DOM',
    method: 'querySelector',
    fullName: 'DOM.querySelector',
    description: 'Returns node id for a given selector.',
    parameters: [
      { name: 'nodeId', type: 'number', optional: false, description: 'Id of the node to query.' },
      { name: 'selector', type: 'string', optional: false, description: 'CSS selector.' },
    ],
    returns: [{ name: 'nodeId', type: 'number', optional: false, description: 'Matched node id.' }],
    deprecated: false,
  },
  {
    domain: 'DOM',
    method: 'getBoxModel',
    fullName: 'DOM.getBoxModel',
    description: 'Returns box model for a node.',
    parameters: [{ name: 'nodeId', type: 'number', optional: true, description: 'Node id.' }],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'DOM',
    method: 'setAttributeValue',
    fullName: 'DOM.setAttributeValue',
    description: 'Sets attribute for an element.',
    parameters: [
      { name: 'nodeId', type: 'number', optional: false, description: 'Node id.' },
      { name: 'name', type: 'string', optional: false, description: 'Attribute name.' },
      { name: 'value', type: 'string', optional: false, description: 'Attribute value.' },
    ],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'DOM',
    method: 'removeNode',
    fullName: 'DOM.removeNode',
    description: 'Removes a node.',
    parameters: [{ name: 'nodeId', type: 'number', optional: false, description: 'Node id.' }],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'DOM',
    method: 'getOuterHTML',
    fullName: 'DOM.getOuterHTML',
    description: 'Returns the outer HTML of a node.',
    parameters: [{ name: 'nodeId', type: 'number', optional: false, description: 'Node id.' }],
    returns: [{ name: 'outerHTML', type: 'string', optional: false, description: 'Outer HTML.' }],
    deprecated: false,
  },

  // Network
  {
    domain: 'Network',
    method: 'enable',
    fullName: 'Network.enable',
    description: 'Enables network tracking.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Network',
    method: 'disable',
    fullName: 'Network.disable',
    description: 'Disables network tracking.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Network',
    method: 'setBlockedURLs',
    fullName: 'Network.setBlockedURLs',
    description: 'Blocks URLs from loading.',
    parameters: [
      { name: 'urls', type: 'array', optional: false, description: 'URL patterns to block.' },
    ],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Network',
    method: 'getCookies',
    fullName: 'Network.getCookies',
    description: 'Returns cookies for the page.',
    parameters: [],
    returns: [{ name: 'cookies', type: 'array', optional: false, description: 'Cookie array.' }],
    deprecated: false,
  },
  {
    domain: 'Network',
    method: 'getResponseBody',
    fullName: 'Network.getResponseBody',
    description: 'Returns response body for a request.',
    parameters: [
      { name: 'requestId', type: 'string', optional: false, description: 'Request id.' },
    ],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Network',
    method: 'setUserAgentOverride',
    fullName: 'Network.setUserAgentOverride',
    description: 'Overrides user agent.',
    parameters: [
      { name: 'userAgent', type: 'string', optional: false, description: 'User agent string.' },
    ],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Network',
    method: 'clearBrowserCache',
    fullName: 'Network.clearBrowserCache',
    description: 'Clears browser cache.',
    parameters: [],
    returns: [],
    deprecated: false,
  },

  // Target
  {
    domain: 'Target',
    method: 'createTarget',
    fullName: 'Target.createTarget',
    description: 'Creates a new target.',
    parameters: [{ name: 'url', type: 'string', optional: false, description: 'Initial URL.' }],
    returns: [{ name: 'targetId', type: 'string', optional: false, description: 'Target id.' }],
    deprecated: false,
  },
  {
    domain: 'Target',
    method: 'closeTarget',
    fullName: 'Target.closeTarget',
    description: 'Closes target by id.',
    parameters: [{ name: 'targetId', type: 'string', optional: false, description: 'Target id.' }],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Target',
    method: 'getTargets',
    fullName: 'Target.getTargets',
    description: 'Retrieves targets available.',
    parameters: [],
    returns: [
      { name: 'targetInfos', type: 'array', optional: false, description: 'Target infos.' },
    ],
    deprecated: false,
  },
  {
    domain: 'Target',
    method: 'attachToTarget',
    fullName: 'Target.attachToTarget',
    description: 'Attaches to a target.',
    parameters: [{ name: 'targetId', type: 'string', optional: false, description: 'Target id.' }],
    returns: [],
    deprecated: false,
  },

  // Input
  {
    domain: 'Input',
    method: 'dispatchKeyEvent',
    fullName: 'Input.dispatchKeyEvent',
    description: 'Dispatches key event.',
    parameters: [
      { name: 'type', type: 'string', optional: false, description: 'Event type.' },
      { name: 'key', type: 'string', optional: true, description: 'Key name.' },
    ],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Input',
    method: 'dispatchMouseEvent',
    fullName: 'Input.dispatchMouseEvent',
    description: 'Dispatches mouse event.',
    parameters: [
      { name: 'type', type: 'string', optional: false, description: 'Event type.' },
      { name: 'x', type: 'number', optional: true, description: 'X coordinate.' },
      { name: 'y', type: 'number', optional: true, description: 'Y coordinate.' },
    ],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Input',
    method: 'insertText',
    fullName: 'Input.insertText',
    description: 'Inserts text.',
    parameters: [{ name: 'text', type: 'string', optional: false, description: 'Text to insert.' }],
    returns: [],
    deprecated: false,
  },

  // Fetch
  {
    domain: 'Fetch',
    method: 'enable',
    fullName: 'Fetch.enable',
    description: 'Enables interception of network requests.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Fetch',
    method: 'disable',
    fullName: 'Fetch.disable',
    description: 'Disables interception of network requests.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Fetch',
    method: 'fulfillRequest',
    fullName: 'Fetch.fulfillRequest',
    description: 'Fulfills a request with given body.',
    parameters: [
      { name: 'requestId', type: 'string', optional: false, description: 'Request id.' },
      { name: 'body', type: 'string', optional: false, description: 'Response body.' },
    ],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Fetch',
    method: 'failRequest',
    fullName: 'Fetch.failRequest',
    description: 'Causes the request to fail.',
    parameters: [
      { name: 'requestId', type: 'string', optional: false, description: 'Request id.' },
    ],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Fetch',
    method: 'continueRequest',
    fullName: 'Fetch.continueRequest',
    description: 'Continues the request.',
    parameters: [
      { name: 'requestId', type: 'string', optional: false, description: 'Request id.' },
    ],
    returns: [],
    deprecated: false,
  },

  // Emulation
  {
    domain: 'Emulation',
    method: 'setDeviceMetricsOverride',
    fullName: 'Emulation.setDeviceMetricsOverride',
    description: 'Overrides device metrics.',
    parameters: [
      { name: 'width', type: 'number', optional: false, description: 'Width.' },
      { name: 'height', type: 'number', optional: false, description: 'Height.' },
    ],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Emulation',
    method: 'setUserAgentOverride',
    fullName: 'Emulation.setUserAgentOverride',
    description: 'Overrides user agent.',
    parameters: [
      { name: 'userAgent', type: 'string', optional: false, description: 'User agent.' },
    ],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Emulation',
    method: 'setGeolocationOverride',
    fullName: 'Emulation.setGeolocationOverride',
    description: 'Overrides geolocation.',
    parameters: [
      { name: 'latitude', type: 'number', optional: true, description: 'Latitude.' },
      { name: 'longitude', type: 'number', optional: true, description: 'Longitude.' },
    ],
    returns: [],
    deprecated: false,
  },

  // Tracing
  {
    domain: 'Tracing',
    method: 'start',
    fullName: 'Tracing.start',
    description: 'Starts tracing.',
    parameters: [
      {
        name: 'categories',
        type: 'string',
        optional: true,
        description: 'Comma-separated tracing categories.',
      },
    ],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Tracing',
    method: 'end',
    fullName: 'Tracing.end',
    description: 'Stops tracing.',
    parameters: [],
    returns: [],
    deprecated: false,
  },

  // Debugger
  {
    domain: 'Debugger',
    method: 'enable',
    fullName: 'Debugger.enable',
    description: 'Enables debugger.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Debugger',
    method: 'disable',
    fullName: 'Debugger.disable',
    description: 'Disables debugger.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Debugger',
    method: 'pause',
    fullName: 'Debugger.pause',
    description: 'Stops on the next JS statement.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Debugger',
    method: 'resume',
    fullName: 'Debugger.resume',
    description: 'Resumes execution.',
    parameters: [],
    returns: [],
    deprecated: false,
  },

  // CSS
  {
    domain: 'CSS',
    method: 'enable',
    fullName: 'CSS.enable',
    description: 'Enables CSS agent.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'CSS',
    method: 'disable',
    fullName: 'CSS.disable',
    description: 'Disables CSS agent.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'CSS',
    method: 'getComputedStyleForNode',
    fullName: 'CSS.getComputedStyleForNode',
    description: 'Returns computed styles for a node.',
    parameters: [{ name: 'nodeId', type: 'number', optional: false, description: 'Node id.' }],
    returns: [],
    deprecated: false,
  },

  // Log
  {
    domain: 'Log',
    method: 'enable',
    fullName: 'Log.enable',
    description: 'Enables log domain.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Log',
    method: 'disable',
    fullName: 'Log.disable',
    description: 'Disables log domain.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
  {
    domain: 'Log',
    method: 'clear',
    fullName: 'Log.clear',
    description: 'Clears log.',
    parameters: [],
    returns: [],
    deprecated: false,
  },
]

/** Distinct domains present in a method list. */
export function listCdpDomains(methods: CdpMethodDescriptor[]): string[] {
  return [...new Set(methods.map((m) => m.domain))].sort()
}

/** Normalize a discovery source: de-duplicate by fullName, keep first occurrence. */
export function discoverCdpMethods(source: CdpMethodDescriptor[]): CdpMethodDescriptor[] {
  const seen = new Set<string>()
  const out: CdpMethodDescriptor[] = []
  for (const m of source) {
    if (seen.has(m.fullName)) continue
    seen.add(m.fullName)
    out.push(m)
  }
  return out
}
