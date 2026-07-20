// src/schema/contact.ts
// Contact and organization node types for the second brain.

import { z } from 'zod'

// ── ContactNode (cap-store.contact) ────────────────────────────────────────
// Person profile with communication channels and relationships.

export interface ContactData {
  displayName: string
  givenName?: string
  familyName?: string
  nickname?: string
  emails?: Array<{ address: string; type?: string; primary?: boolean }>
  phones?: Array<{ number: string; type?: string }>
  urls?: Array<{ url: string; type?: string }>
  organization?: string
  jobTitle?: string
  avatarUrl?: string
  notes?: string
  birthday?: string
  addresses?: Array<{
    street?: string
    city?: string
    region?: string
    postalCode?: string
    country?: string
    type?: string
  }>
  socialProfiles?: Array<{ platform: string; username: string; url?: string }>
  tags?: string[]
  source?: string
  importedAt: number
}

export const EmailFieldSchema = z.object({
  address: z.string().email(),
  type: z.string().optional(),
  primary: z.boolean().optional(),
})

export const PhoneFieldSchema = z.object({
  number: z.string(),
  type: z.string().optional(),
})

export const UrlFieldSchema = z.object({
  url: z.string(),
  type: z.string().optional(),
})

export const AddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  type: z.string().optional(),
})

export const SocialProfileSchema = z.object({
  platform: z.string(),
  username: z.string(),
  url: z.string().optional(),
})

export const ContactDataSchema = z.object({
  displayName: z.string(),
  givenName: z.string().optional(),
  familyName: z.string().optional(),
  nickname: z.string().optional(),
  emails: z.array(EmailFieldSchema).optional(),
  phones: z.array(PhoneFieldSchema).optional(),
  urls: z.array(UrlFieldSchema).optional(),
  organization: z.string().optional(),
  jobTitle: z.string().optional(),
  avatarUrl: z.string().optional(),
  notes: z.string().optional(),
  birthday: z.string().optional(),
  addresses: z.array(AddressSchema).optional(),
  socialProfiles: z.array(SocialProfileSchema).optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
  importedAt: z.number(),
})

// ── OrganizationNode (cap-store.organization) ──────────────────────────────

export interface OrganizationData {
  name: string
  legalName?: string
  description?: string
  website?: string
  logoUrl?: string
  industry?: string
  employeeCount?: number
  foundedYear?: number
  addresses?: Array<{
    street?: string
    city?: string
    region?: string
    postalCode?: string
    country?: string
  }>
  tags?: string[]
  importedAt: number
}

export const OrganizationDataSchema = z.object({
  name: z.string(),
  legalName: z.string().optional(),
  description: z.string().optional(),
  website: z.string().optional(),
  logoUrl: z.string().optional(),
  industry: z.string().optional(),
  employeeCount: z.number().int().positive().optional(),
  foundedYear: z.number().int().optional(),
  addresses: z
    .array(
      z.object({
        street: z.string().optional(),
        city: z.string().optional(),
        region: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
      }),
    )
    .optional(),
  tags: z.array(z.string()).optional(),
  importedAt: z.number(),
})

// ── Node schemas for registration ─────────────────────────────────────────

export const contactNodeSchema = {
  type: 'cap-store.contact' as const,
  version: 1,
  schema: ContactDataSchema,
  indexContent: (data: ContactData) =>
    `${data.displayName} ${data.emails?.map((e) => e.address).join(' ') ?? ''} ${data.notes ?? ''}`,
  embeddingText: (data: ContactData) =>
    `${data.displayName} ${data.jobTitle ?? ''} ${data.organization ?? ''}`,
}

export const organizationNodeSchema = {
  type: 'cap-store.organization' as const,
  version: 1,
  schema: OrganizationDataSchema,
  indexContent: (data: OrganizationData) =>
    `${data.name} ${data.description ?? ''} ${data.industry ?? ''}`,
  embeddingText: (data: OrganizationData) => `${data.name} ${data.industry ?? ''}`,
}
