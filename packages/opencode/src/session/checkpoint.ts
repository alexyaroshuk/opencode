import z from "zod"
import { Identifier } from "../id/id"
import { MessageV2 } from "./message-v2"
import { Session } from "."
import { Snapshot } from "@/snapshot"
import { SessionRevert } from "./revert"
import { Log } from "../util/log"
import { fn } from "@/util/fn"

export namespace SessionCheckpoint {
  const log = Log.create({ service: "session.checkpoint" })

  export const Info = z
    .object({
      messageID: Identifier.schema("message"),
      snapshot: z.string(),
      title: z.string(),
      time: z.number(),
    })
    .meta({
      ref: "Checkpoint",
    })
  export type Info = z.infer<typeof Info>

  export const list = fn(
    z.object({
      sessionID: Identifier.schema("session"),
    }),
    async (input): Promise<Info[]> => {
      const msgs = await Session.messages({ sessionID: input.sessionID })
      const checkpoints: Info[] = []

      for (const msg of msgs) {
        if (msg.info.role !== "user") continue

        // Find the text content of the user message for the title
        const textPart = msg.parts.find(
          (p): p is MessageV2.TextPart => p.type === "text" && !p.synthetic && !p.ignored,
        )
        if (!textPart) continue

        // Find the assistant message that follows this user message
        const assistantIdx = msgs.findIndex(
          (m) => m.info.role === "assistant" && m.info.id > msg.info.id,
        )
        if (assistantIdx === -1) continue

        const assistantMsg = msgs[assistantIdx]

        // Find the step-start part in the assistant message that contains the snapshot
        const stepStart = assistantMsg.parts.find(
          (p): p is MessageV2.StepStartPart => p.type === "step-start" && !!p.snapshot,
        )
        if (!stepStart?.snapshot) continue

        checkpoints.push({
          messageID: msg.info.id,
          snapshot: stepStart.snapshot,
          title: textPart.text.replace(/\n/g, " ").slice(0, 200),
          time: msg.info.time.created,
        })
      }

      return checkpoints
    },
  )

  export const restore = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message"),
    }),
    async (input) => {
      log.info("restoring checkpoint", input)

      // Use the existing revert system which handles:
      // 1. Restoring files from the snapshot
      // 2. Tracking the revert state in the session
      // 3. Cleaning up messages after the revert point
      const session = await SessionRevert.revert({
        sessionID: input.sessionID,
        messageID: input.messageID,
      })

      // Immediately cleanup the revert state and remove messages after the checkpoint
      await SessionRevert.cleanup(session)

      return Session.get(input.sessionID)
    },
  )
}
