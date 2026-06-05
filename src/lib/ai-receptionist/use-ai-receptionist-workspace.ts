"use client"

import * as React from "react"

import {
  readAiReceptionistConfig,
  readAiReceptionistStats,
  writeAiReceptionistConfig,
} from "@/lib/ai-receptionist/ai-receptionist-storage"
import { pickDemoConversation } from "@/lib/ai-receptionist/mock-conversations"
import type {
  AiConversationPreview,
  AiReceptionistConfig,
  AiReceptionistStats,
} from "@/lib/ai-receptionist/types"

export function useAiReceptionistWorkspace(businessId: string | null | undefined) {
  const [ready, setReady] = React.useState(false)
  const [config, setConfig] = React.useState<AiReceptionistConfig | null>(null)
  const [stats, setStats] = React.useState<AiReceptionistStats | null>(null)

  const reload = React.useCallback(() => {
    if (!businessId) {
      setConfig(null)
      setStats(null)
      setReady(true)
      return
    }
    setConfig(readAiReceptionistConfig(businessId))
    setStats(readAiReceptionistStats(businessId))
    setReady(true)
  }, [businessId])

  React.useEffect(() => {
    reload()
  }, [reload])

  const saveConfig = React.useCallback(
    (next: AiReceptionistConfig) => {
      writeAiReceptionistConfig(next)
      setConfig(next)
    },
    [],
  )

  const demoConversation: AiConversationPreview | null = React.useMemo(() => {
    if (!config) return null
    return pickDemoConversation(config.language)
  }, [config])

  return {
    ready,
    config,
    stats,
    demoConversation,
    saveConfig,
    reload,
  }
}
