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
  const response = await fetch(url, {
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
    throw new Error(`GitHub API ${response.status}: ${error}`)
  }
  return response.json()
}

async function ensureLabelExists(owner: string, repo: string, label: string) {
  try {
    await githubFetch(`/repos/${owner}/${repo}/labels/${label}`)
  } catch {
    await githubFetch(`/repos/${owner}/${repo}/labels`, {
      method: "POST",
      body: JSON.stringify({
        name: label,
        color: "ededed",
        description: label.charAt(0).toUpperCase() + label.slice(1),
      }),
    })
  }
}

function getRepoInfo(): { owner: string; repo: string } {
  const repoFull = process.env.GITHUB_REPOSITORY ?? ""
  const [owner, repo] = repoFull.split("/")
  return { owner: owner ?? "anomalyco", repo: repo ?? "opencode" }
}

export default tool({
  description: DESCRIPTION,
  args: {
    action: tool.schema.string().describe("Action to perform").optional(),
    label: tool.schema.string().describe("Single label to add").optional(),
    labels: tool.schema.array(tool.schema.string()).describe("Labels to add").optional(),
    reason: tool.schema.string().describe("Reason for the label").optional(),
  },
  async execute(args) {
    const pr = getPRNumber()
    const { owner, repo } = getRepoInfo()

    let labels: string[] = []

    if (args.label) {
      labels = [args.label]
    } else if (args.labels) {
      labels = args.labels
    } else {
      labels = ["zen"]
    }

    for (const label of labels) {
      await ensureLabelExists(owner, repo, label)
    }

    await githubFetch(`/repos/${owner}/${repo}/issues/${pr}/labels`, {
      method: "POST",
      body: JSON.stringify({ labels }),
    })

    return `Added labels: ${labels.join(", ")}`
  },
})
