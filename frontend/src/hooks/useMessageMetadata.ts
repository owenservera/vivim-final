'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

interface MessageMetadata {
  isPinned?: number
  isArchived?: number
  readStatus?: string
}

export function useMessageMetadata(conversationId: string) {
  const queryClient = useQueryClient()

  const updateMetadata = useMutation({
    mutationFn: async ({ messageId, updates }: { messageId: string; updates: MessageMetadata }) => {
      const response = await fetch(`/api/conversations/${conversationId}/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!response.ok) throw new Error('Failed to update metadata')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
    },
  })

  const batchUpdate = useMutation({
    mutationFn: async ({
      messageIds,
      updates,
    }: {
      messageIds: string[]
      updates: MessageMetadata
    }) => {
      const response = await fetch(`/api/conversations/${conversationId}/messages/batch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds, updates }),
      })
      if (!response.ok) throw new Error('Failed to batch update')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
    },
  })

  return {
    updateMetadata: updateMetadata.mutateAsync,
    batchUpdate: batchUpdate.mutateAsync,
    isUpdating: updateMetadata.isPending,
  }
}
