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
    labels: tool.schema
      .array(tool.schema.enum(["nix", "opentui", "perf", "desktop", "zen", "docs", "windows"]))
      .describe("The label(s) to add to the PR")
      .default([]),
  },
  async execute(args) {
    const pr = getPRNumber()
    const owner = "alexyaroshuk"
    const repo = "opencode"

    const results: string[] = []

    const labels: string[] = ["desktop"]

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
