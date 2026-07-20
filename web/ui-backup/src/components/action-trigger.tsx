import type { FC } from 'react'
import { ActionRegistry } from '../actions/registry.js'

interface ActionTriggerProps {
  actionId: string
  params?: Record<string, unknown>
  children: React.ReactNode
}

export const ActionTrigger: FC<ActionTriggerProps> = ({ actionId, params, children }) => {
  const handleClick = () => {
    if (params) {
      ActionRegistry.dispatch(actionId, params).catch(console.error)
    } else {
      // Allow actions without params
      const action = ActionRegistry.getAction(actionId)
      if (action) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        action.spec.run({})
      }
    }
  }

  return (
    <button type="button" onClick={handleClick}>
      {children}
    </button>
  )
}