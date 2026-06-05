"use client"

import * as React from "react"

import {
  readWhatsAppConfig,
  writeWhatsAppConfig,
} from "@/lib/integrations/whatsapp/whatsapp-storage"
import type {
  WhatsAppIntegrationConfig,
  WhatsAppTemplateKind,
  WhatsAppTemplatePreviewContext,
} from "@/lib/integrations/whatsapp/types"
import { WHATSAPP_PREVIEW_SAMPLE } from "@/lib/integrations/whatsapp/template-vars"

export function useWhatsAppWorkspace(businessId: string | null) {
  const [config, setConfig] = React.useState<WhatsAppIntegrationConfig | null>(null)
  const [previewContext, setPreviewContext] =
    React.useState<WhatsAppTemplatePreviewContext>(WHATSAPP_PREVIEW_SAMPLE)
  const [activeTemplate, setActiveTemplate] = React.useState<WhatsAppTemplateKind>("confirmation")

  React.useEffect(() => {
    if (!businessId) {
      setConfig(null)
      return
    }
    setConfig(readWhatsAppConfig(businessId))
  }, [businessId])

  const persist = React.useCallback(
    (next: WhatsAppIntegrationConfig) => {
      writeWhatsAppConfig(next)
      setConfig(next)
    },
    [],
  )

  const saveConfig = React.useCallback(
    (patch: Partial<WhatsAppIntegrationConfig>) => {
      if (!config) return
      persist({ ...config, ...patch })
    },
    [config, persist],
  )

  const setConnected = React.useCallback(
    (connected: boolean) => {
      if (!config) return
      persist({ ...config, connected })
    },
    [config, persist],
  )

  const updateTemplateBody = React.useCallback(
    (kind: WhatsAppTemplateKind, body: string) => {
      if (!config) return
      persist({
        ...config,
        templates: {
          ...config.templates,
          [kind]: { ...config.templates[kind], body },
        },
      })
    },
    [config, persist],
  )

  const toggleTemplateEnabled = React.useCallback(
    (kind: WhatsAppTemplateKind, enabled: boolean) => {
      if (!config) return
      persist({
        ...config,
        templates: {
          ...config.templates,
          [kind]: { ...config.templates[kind], enabled },
        },
      })
    },
    [config, persist],
  )

  return {
    config,
    previewContext,
    setPreviewContext,
    activeTemplate,
    setActiveTemplate,
    saveConfig,
    setConnected,
    updateTemplateBody,
    toggleTemplateEnabled,
  }
}
