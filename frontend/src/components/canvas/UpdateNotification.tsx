/**
 * UpdateNotification — Component for displaying update availability
 * 
 * Shows both app updates and provider-specific updates
 */

'use client'

import { useUpdateChecker } from '@/hooks/useUpdateChecker'

interface UpdateNotificationProps {
  onDismiss?: () => void
}

export function UpdateNotification({ onDismiss }: UpdateNotificationProps) {
  const {
    currentVersion,
    updateAvailable,
    updateInfo,
    checking,
    downloading,
    installing,
    error,
    providers,
    providerUpdates,
    checkForUpdates,
    applyUpdate,
    checkAllProviderUpdates,
    installProviderUpdate
  } = useUpdateChecker()
  
  const hasProviderUpdates = providerUpdates.size > 0
  
  if (checking && !updateAvailable && !hasProviderUpdates) {
    return null
  }
  
  if (installing) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: 'var(--bg)',
        border: '1px solid var(--accent)',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        maxWidth: '320px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '3px solid var(--accent)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <div>
            <div style={{ fontWeight: 600 }}>Installing Update...</div>
            <div style={{ fontSize: '12px', color: 'var(--textDim)' }}>
              Application will restart shortly
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: 'var(--bg)',
        border: '1px solid #ff5252',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        maxWidth: '320px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 600, color: '#ff5252' }}>Update Error</div>
            <div style={{ fontSize: '12px', color: 'var(--textDim)', marginTop: '4px' }}>
              {error}
            </div>
          </div>
          <button
            onClick={onDismiss}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: 'var(--textDim)'
            }}
          >
            ×
          </button>
        </div>
        <button
          onClick={checkForUpdates}
          style={{
            marginTop: '12px',
            padding: '8px 16px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Try Again
        </button>
      </div>
    )
  }
  
  // No updates available
  if (!updateAvailable && !hasProviderUpdates) {
    return null
  }
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'var(--bg)',
      border: '1px solid var(--accent)',
      borderRadius: '8px',
      padding: '16px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      zIndex: 1000,
      maxWidth: '350px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600 }}>Updates Available</div>
          <div style={{ fontSize: '12px', color: 'var(--textDim)', marginTop: '4px' }}>
            v{currentVersion}
          </div>
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            color: 'var(--textDim)'
          }}
        >
          ×
        </button>
      </div>
      
      {/* App Update */}
      {updateAvailable && updateInfo && (
        <div style={{ marginTop: '12px', padding: '8px', background: 'var(--bgSecondary)', borderRadius: '4px' }}>
          <div style={{ fontWeight: 600, fontSize: '13px' }}>
            App Update: v{updateInfo.latestVersion}
          </div>
          {updateInfo.releaseNotes && (
            <div style={{ 
              marginTop: '8px', 
              fontSize: '11px', 
              maxHeight: '60px', 
              overflow: 'auto',
              color: 'var(--textDim)'
            }}>
              {updateInfo.releaseNotes.slice(0, 150)}
              {updateInfo.releaseNotes.length > 150 && '...'}
            </div>
          )}
          <button
            onClick={applyUpdate}
            disabled={downloading}
            style={{
              marginTop: '8px',
              width: '100%',
              padding: '8px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: downloading ? 'wait' : 'pointer',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            {downloading ? 'Downloading...' : 'Update App'}
          </button>
        </div>
      )}
      
      {/* Provider Updates */}
      {hasProviderUpdates && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
            Provider Updates:
          </div>
          {Array.from(providerUpdates.entries()).map(([slug, update]) => (
            <div 
              key={slug}
              style={{ 
                padding: '8px', 
                background: 'var(--bgSecondary)', 
                borderRadius: '4px',
                marginBottom: '8px'
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '13px', textTransform: 'capitalize' }}>
                {slug}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--textDim)', marginTop: '4px' }}>
                Parser v{update.parserVersion}
              </div>
              {update.changes.length > 0 && (
                <div style={{ fontSize: '10px', color: 'var(--textDim)', marginTop: '4px' }}>
                  {update.changes.slice(0, 2).join(' • ')}
                </div>
              )}
              <button
                onClick={() => {
                  // TODO: Get parser code and capabilities from update
                  installProviderUpdate(slug, '// parser code', [])
                }}
                style={{
                  marginTop: '8px',
                  padding: '4px 12px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                Update
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        style={{
          marginTop: '8px',
          width: '100%',
          padding: '8px 16px',
          background: 'transparent',
          color: 'var(--textDim)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px'
        }}
      >
        Later
      </button>
    </div>
  )
}
