/// <reference path="../env.d.ts" />
import { tool } from "@opencode-ai/plugin"
import DESCRIPTION from "./github-pr-triage.txt"

function getPRNumber(): number {
  const pr = parseInt(process.env.PR_NUMBER ?? "", 10)
  if (!pr) throw new Error("PR_NUMBER env var not set")
  return pr
}

async function githubFetch(endpoint: string, options: RequestInit = {}) {
  const url = `https://api.github.com${endpoint}`
  console.log("Fetching:", url)
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
  console.log("Response status:", response.status, response.statusText)
  if (!response.ok) {
    const error = await response.text()
    console.log("Response error:", error)
    return { error, ok: false }
  }
  return response.json()
}

async function ensureLabelExists(owner: string, repo: string, label: string) {
  const response = await githubFetch(`/repos/${owner}/${repo}/labels/${label}`)
  if (!response.error) return

  console.log("Creating label:", label)
  await githubFetch(`/repos/${owner}/${repo}/labels`, {
    method: "POST",
    body: JSON.stringify({
      name: label,
      color: "ededed",
      description: label.charAt(0).toUpperCase() + label.slice(1),
    }),
  })
}

function getRepoInfo(): { owner: string; repo: string } {
  const repoFull = process.env.GITHUB_REPOSITORY ?? ""
  console.log("GITHUB_REPOSITORY:", repoFull)
  const [owner, repo] = repoFull.split("/")
  return { owner: owner ?? "alexyaroshuk", repo: repo ?? "opencode" }
}

export default tool({
  description: DESCRIPTION,
  args: {
    command: tool.schema.string().describe("Command to execute").optional(),
    label: tool.schema.string().describe("Single label to add").optional(),
    labels: tool.schema.array(tool.schema.string()).describe("Labels to add").optional(),
  },
  async execute(args) {
    const pr = getPRNumber()
    const { owner, repo } = getRepoInfo()

    const results: string[] = []

    let labels: string[] = []

    if (args.label) {
      labels = [args.label]
    } else if (args.labels) {
      labels = args.labels
    } else {
      labels = ["zen"]
    }

    if (labels.length > 0) {
      for (const label of labels) {
        await ensureLabelExists(owner, repo, label)
      }
      console.log("Adding labels to PR:", owner, repo, pr, labels)
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
