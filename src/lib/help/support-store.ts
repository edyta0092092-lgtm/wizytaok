"use client"

import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Tables } from "@/types/database"

export type SupportConversation = Tables<"support_conversations">
export type SupportMessage = Tables<"support_messages">

export type CreateSupportConversationInput = {
  businessId: string
  subject?: string
}

export async function createSupportConversation(
  input: CreateSupportConversationInput
): Promise<SupportConversation> {
  const client = getBrowserClient()
  if (!isSupabaseConfigured() || !client) {
    throw new Error("Supabase is not configured")
  }

  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError) throw authError
  const userId = authData.user?.id
  if (!userId) throw new Error("No authenticated user")

  const { data: conversation, error: conversationError } = await client
    .from("support_conversations")
    .insert({
      business_id: input.businessId,
      user_id: userId,
      subject: input.subject?.trim() || "Czat z obsługą",
    })
    .select("*")
    .single()

  if (conversationError) throw conversationError
  return conversation as SupportConversation
}

export async function getLatestOpenSupportConversation(
  businessId: string
): Promise<SupportConversation | null> {
  const client = getBrowserClient()
  if (!isSupabaseConfigured() || !client) return null

  const { data: openData, error: openError } = await client
    .from("support_conversations")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (openError) throw openError
  if (openData) return openData as SupportConversation

  const { data, error } = await client
    .from("support_conversations")
    .select("*")
    .eq("business_id", businessId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as SupportConversation | null) ?? null
}

export async function getSupportConversationMessages(
  conversationId: string
): Promise<SupportMessage[]> {
  const client = getBrowserClient()
  if (!isSupabaseConfigured() || !client) return []

  const { data, error } = await client
    .from("support_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as SupportMessage[]
}

export async function ensureOpenSupportConversation(
  businessId: string
): Promise<SupportConversation> {
  const existing = await getLatestOpenSupportConversation(businessId)
  if (existing) return existing
  return createSupportConversation({ businessId, subject: "Czat z obsługą" })
}

export async function addSupportMessage(input: {
  conversationId: string
  businessId: string
  body: string
}): Promise<SupportMessage> {
  const client = getBrowserClient()
  if (!isSupabaseConfigured() || !client) {
    throw new Error("Supabase is not configured")
  }

  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError) throw authError
  const userId = authData.user?.id
  if (!userId) throw new Error("No authenticated user")

  const { data, error } = await client
    .from("support_messages")
    .insert({
      conversation_id: input.conversationId,
      business_id: input.businessId,
      body: input.body.trim(),
      sender_role: "user",
      sender_user_id: userId,
    })
    .select("*")
    .single()

  if (error) throw error
  return data as SupportMessage
}

export async function reopenSupportConversation(conversationId: string): Promise<void> {
  const client = getBrowserClient()
  if (!isSupabaseConfigured() || !client) {
    throw new Error("Supabase is not configured")
  }
  const { error } = await client
    .from("support_conversations")
    .update({ status: "open" })
    .eq("id", conversationId)
  if (error) throw error
}

export function isConversationClosed(status: string): boolean {
  return status === "closed"
}
