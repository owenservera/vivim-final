'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export interface Collection {
  id: string
  name: string
  parentId: string | null
  description?: string
  color?: string
  icon?: string
  createdAt: number
  updatedAt: number
  itemCount?: number
  children?: Collection[]
}

export function useCollections() {
  const queryClient = useQueryClient()

  const {
    data: collections,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['collections'],
    queryFn: async (): Promise<Collection[]> => {
      const response = await fetch('/api/collections')
      if (!response.ok) throw new Error('Failed to fetch collections')
      return response.json()
    },
  })

  const createCollection = useMutation({
    mutationFn: async (collection: Partial<Collection>) => {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collection),
      })
      if (!response.ok) throw new Error('Failed to create collection')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const updateCollection = useMutation({
    mutationFn: async ({ id, ...collection }: { id: string } & Partial<Collection>) => {
      const response = await fetch(`/api/collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collection),
      })
      if (!response.ok) throw new Error('Failed to update collection')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const deleteCollection = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/collections/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete collection')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  return {
    collections: collections || [],
    isLoading,
    error,
    createCollection: createCollection.mutateAsync,
    updateCollection: updateCollection.mutateAsync,
    deleteCollection: deleteCollection.mutateAsync,
    isCreating: createCollection.isPending,
    isUpdating: updateCollection.isPending,
    isDeleting: deleteCollection.isPending,
  }
}
