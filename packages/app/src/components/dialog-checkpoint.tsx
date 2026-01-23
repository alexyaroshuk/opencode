import { Component, createMemo } from "solid-js"
import { useParams } from "@solidjs/router"
import { useSync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { List } from "@opencode-ai/ui/list"
import { Icon } from "@opencode-ai/ui/icon"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import type { TextPart as SDKTextPart } from "@opencode-ai/sdk/v2/client"

interface Checkpoint {
  messageID: string
  snapshot: string
  title: string
  time: number
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { timeStyle: "short" })
}

function formatDate(date: Date): string {
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()
  if (isToday) {
    return formatTime(date)
  }
  return date.toLocaleDateString(undefined, { dateStyle: "short" }) + " " + formatTime(date)
}

export const DialogCheckpoint: Component = () => {
  const params = useParams()
  const sync = useSync()
  const sdk = useSDK()
  const dialog = useDialog()
  const language = useLanguage()

  // Compute checkpoints from local message data
  // This mirrors what the backend does but uses already-loaded data
  const checkpoints = createMemo((): Checkpoint[] => {
    const sessionID = params.id
    if (!sessionID) return []

    const msgs = sync.data.message[sessionID] ?? []
    const result: Checkpoint[] = []

    // Find all user messages and sort oldest to newest to ensure deterministic ordering
    const sortedUserMessages = msgs
      .filter((m) => m.role === "user")
      .sort((a: any, b: any) => (a.time?.created ?? 0) - (b.time?.created ?? 0))

    for (let i = 0; i < sortedUserMessages.length; i++) {
      const message = sortedUserMessages[i]
      const parts = sync.data.part[message.id] ?? []
      const textPart = parts.find((x): x is SDKTextPart => x.type === "text" && !x.synthetic && !x.ignored)
      if (!textPart) continue

      // For the first user message, we don't need a snapshot - reverting to it undoes all changes
      // For subsequent messages, find the assistant message that follows and get its step-start snapshot
      let snapshot = ""
      if (i > 0) {
        const assistantMsg = msgs.find((m) => m.role === "assistant" && m.id > message.id)
        if (assistantMsg) {
          const assistantParts = sync.data.part[assistantMsg.id] ?? []
          const stepStart = assistantParts.find((p) => p.type === "step-start" && "snapshot" in p && p.snapshot)
          if (stepStart && "snapshot" in stepStart && stepStart.snapshot) {
            snapshot = stepStart.snapshot as string
          }
        }
      }

      result.push({
        messageID: message.id,
        snapshot,
        title: textPart.text.replace(/\n/g, " ").slice(0, 200),
        time: message.time.created,
      })
    }

    // Ensure oldest messages appear on top, newest at bottom
    return result.sort((a, b) => a.time - b.time || a.messageID.localeCompare(b.messageID))
  })

  const handleSelect = async (item: Checkpoint | undefined) => {
    if (!item) return

    const sessionID = params.id
    if (!sessionID) return

    dialog.close()

    try {
      // Use the existing revert API which handles file restoration
      await sdk.client.session.revert({
        sessionID,
        messageID: item.messageID,
      })

      showToast({
        title: language.t("checkpoint.toast.restored.title"),
        description: language.t("checkpoint.toast.restored.description"),
      })

      // Force a refresh of the session data
      await sync.session.sync(sessionID)
    } catch (error) {
      showToast({
        title: language.t("checkpoint.toast.error.title"),
        description: error instanceof Error ? error.message : language.t("common.requestFailed"),
      })
    }
  }

  return (
    <Dialog title={language.t("command.session.checkpoint")}>
      <div class="flex flex-col gap-2 mb-3">
        <div class="flex items-center gap-2 text-text-weak text-12-regular px-2">
          <Icon name="clock-rewind" size="small" />
          <span>{language.t("checkpoint.description")}</span>
        </div>
      </div>
      <List
        class="flex-1 min-h-0 [&_[data-slot=list-scroll]]:flex-1 [&_[data-slot=list-scroll]]:min-h-0"
        search={{ placeholder: language.t("common.search.placeholder"), autofocus: true }}
        emptyMessage={language.t("checkpoint.empty")}
        key={(x) => x.messageID}
        items={checkpoints}
        filterKeys={["title"]}
        onSelect={handleSelect}
      >
        {(item) => (
          <div class="w-full flex items-center gap-2">
            <span class="truncate flex-1 min-w-0 text-left" style={{ "font-weight": "400" }}>
              {item.title}
            </span>
            <span class="text-text-weak shrink-0" style={{ "font-weight": "400" }}>
              {formatDate(new Date(item.time))}
            </span>
          </div>
        )}
      </List>
    </Dialog>
  )
}
