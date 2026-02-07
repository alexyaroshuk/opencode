/// <reference path="../env.d.ts" />
import { tool } from "@opencode-ai/plugin"
import DESCRIPTION from "./github-pr-triage.txt"

function getPRNumber(): number {
  const pr = parseInt(process.env.PR_NUMBER ?? "", 10)
  if (!pr) throw new Error("PR_NUMBER env var not set")
  return pr
}

async function githubFetch(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
  if (!response.ok) {
    const error = await response.text()
    return { error, ok: false }
  }
  return response.json()
}

async function ensureLabelExists(owner: string, repo: string, label: string) {
  const response = await githubFetch(`/repos/${owner}/${repo}/labels/${label}`)
  if (!response.error) return

  await githubFetch(`/repos/${owner}/${repo}/labels`, {
    method: "POST",
    body: JSON.stringify({
      name: label,
      color: "ededed",
      description: label.charAt(0).toUpperCase() + label.slice(1),
    }),
  })
}

export default tool({
  description: DESCRIPTION,
  args: {
    command: tool.schema.string().describe("The command to execute").default("add-label"),
    label: tool.schema.string().describe("The label to add").optional(),
    labels: tool.schema.array(tool.schema.string()).describe("The labels to add").optional(),
  },
  async execute(args) {
    const pr = getPRNumber()
    const owner = process.env.GITHUB_REPOSITORY_OWNER ?? "alexyaroshuk"
    const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "opencode"

    const results: string[] = []

    let labels: string[] = []

    if (args.label) {
      labels = [args.label]
    } else if (args.labels) {
      labels = args.labels
    }

    if (labels.length > 0) {
      for (const label of labels) {
        await ensureLabelExists(owner, repo, label)
      }
      const response = await githubFetch(`/repos/${owner}/${repo}/issues/${pr}/labels`, {
        method: "POST",
        body: JSON.stringify(labels),
      })
      console.log("Label API response:", JSON.stringify(response))
      if (!response.ok) {
        results.push(`Error adding labels: ${response.error}`)
      } else {
        results.push(`Added labels: ${labels.join(", ")}`)
      }
    }

    return results.join("\n")
  },
})
