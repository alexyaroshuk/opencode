#!/usr/bin/env bun

import { $ } from "bun"

interface PR {
  number: number
  title: string
  headRefName: string
  baseRefName: string
}

const REPO = "anomalyco/opencode"

async function getAuthor(): Promise<string> {
  const envAuthor = process.env.GITHUB_ACTOR
  if (envAuthor) return envAuthor

  const result = await $`gh api user --jq .login`.quiet()
  return result.stdout.toString().trim()
}

async function fetchPRs(): Promise<PR[]> {
  const author = await getAuthor()
  const result =
    await $`gh pr list --repo ${REPO} --author ${author} --state open --json number,title,headRefName,baseRefName`.quiet()
  return JSON.parse(result.stdout.toString()) as PR[]
}

async function checkPRStatus(pr: PR): Promise<{ updatable: boolean; hasConflict: boolean }> {
  const result = await $`gh pr view ${pr.number} --repo ${REPO} --json mergeable --jq .mergeable`.quiet()
  const mergeable = result.stdout.toString().trim()

  if (mergeable === "MERGEABLE") {
    return { updatable: true, hasConflict: false }
  } else if (mergeable === "CONFLICTING") {
    return { updatable: false, hasConflict: true }
  } else {
    return { updatable: false, hasConflict: false }
  }
}

async function updatePR(pr: PR): Promise<boolean> {
  try {
    await $`gh pr update-branch ${pr.number} --repo ${REPO}`.quiet()
    return true
  } catch {
    return false
  }
}

async function getConflictDetails(pr: PR) {
  try {
    const filesResult = await $`gh pr view ${pr.number} --repo ${REPO} --json files --jq '.files[].path'`.quiet()
    const files = filesResult.stdout.toString().trim().split("\n").filter(Boolean)

    let totalLines = 0
    for (const file of files.slice(0, 10)) {
      try {
        const diffResult =
          await $`gh api repos/anomalyco/opencode/pulls/${pr.number}/files --paginate --jq '.[] | select(.filename == "${file}") | .patch'`.quiet()
        const diff = diffResult.stdout.toString()
        const lines = diff.split("\n").filter((line: string) => line.startsWith("+") || line.startsWith("-")).length
        totalLines += lines
      } catch {}
    }

    return { files: files.slice(0, 20), totalLines }
  } catch {
    return null
  }
}

async function main() {
  console.log("Fetching open PRs...\n")

  const prs = await fetchPRs()

  if (prs.length === 0) {
    console.log("No open PRs found.")
    return
  }

  console.log(`Found ${prs.length} open PR(s)\n`)

  const updated: PR[] = []
  const conflicted: { pr: PR; details: ReturnType<typeof getConflictDetails> extends Promise<infer T> ? T : never }[] =
    []

  for (const pr of prs) {
    console.log(`PR #${pr.number}: ${pr.title}`)

    process.stdout.write("   Checking... ")
    const status = await checkPRStatus(pr)

    if (status.updatable) {
      process.stdout.write("updating... ")
      const success = await updatePR(pr)
      if (success) {
        console.log("✅ Updated")
        updated.push(pr)
      } else {
        console.log("❌ Failed")
      }
    } else if (status.hasConflict) {
      console.log("❌ Has conflicts")
      process.stdout.write("   Analyzing... ")
      const details = await getConflictDetails(pr)
      console.log("done")
      conflicted.push({ pr, details })

      if (details) {
        console.log(`   📁 Files: ${details.files.length} | Lines: ~${details.totalLines}`)
        for (const file of details.files.slice(0, 5)) {
          console.log(`      - ${file}`)
        }
        if (details.files.length > 5) {
          console.log(`      ... and ${details.files.length - 5} more`)
        }
      }
    } else {
      console.log("⚠️ Check failed")
    }
    console.log()
  }

  console.log("=".repeat(50))
  console.log(`\nSummary:`)
  console.log(`  ✅ Updated: ${updated.length}`)
  console.log(`  ❌ Conflicts: ${conflicted.length}`)

  if (conflicted.length > 0) {
    console.log("\n❌ PRs with conflicts:")
    for (const { pr, details } of conflicted) {
      console.log(`  #${pr.number}: ${pr.title}`)
      if (details) {
        console.log(`     📁 ${details.files.length} files, ~${details.totalLines} lines`)
      }
    }
  }

  console.log()
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
