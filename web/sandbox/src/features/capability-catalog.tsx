import { useCapabilityStore } from '../store/capability-store.js'

export function CapabilityCatalog() {
  const { capabilities, selectedCapability, selectCapability, loading, error } = useCapabilityStore()

  if (loading) {
    return (
      <aside className="w-64 border-r border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">Loading capabilities...</p>
      </aside>
    )
  }

  if (error) {
    return (
      <aside className="w-64 border-r border-gray-200 bg-white p-4">
        <p className="text-sm text-red-600">Error: {error}</p>
      </aside>
    )
  }

  return (
    <aside className="w-64 border-r border-gray-200 bg-white p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Capabilities</h2>
      <ul className="space-y-1">
        {capabilities.map((cap) => (
          <li key={cap.slug}>
            <button
              onClick={() => selectCapability(cap.slug)}
              className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 ${
                selectedCapability === cap.slug ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              <div className="font-medium">{cap.name}</div>
              <div className="text-xs text-gray-500">{cap.ui_position}</div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}