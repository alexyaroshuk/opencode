#!/usr/bin/env bun

import { $ } from "bun"

const REPO = "anomalyco/opencode"
const UPSTREAM_URL = "https://github.com/anomalyco/opencode.git"

interface PR {
  number: number
  title: string
  headRefName: string
  baseRefName: string
}

interface ConflictFile {
  path: string
  strategy: "upstream" | "ours" | "merge" | "manual"
  resolved: boolean
  error?: string
}

const prNumber = parseInt(process.env.PR_NUMBER || "")
const shouldPush = process.env.PUSH_RESOLUTION === "true"

if (!prNumber || isNaN(prNumber)) {
  console.error("Error: PR_NUMBER environment variable is required")
  process.exit(1)
}

async function setupGit() {
  await $`git config user.name "${process.env.GITHUB_ACTOR || "GitHub Actions"}"`.quiet()
  await $`git config user.email "${process.env.GITHUB_ACTOR || "github-actions"}@users.noreply.github.com"`.quiet()
}

async function setupUpstream() {
  try {
    await $`git remote add upstream ${UPSTREAM_URL}`.nothrow().quiet()
  } catch {}
  await $`git fetch upstream --quiet`.quiet()
}

async function fetchPR(): Promise<PR | null> {
  try {
    const result = await $`gh pr view ${prNumber} --repo ${REPO} --json number,title,headRefName,baseRefName`.quiet()
    return JSON.parse(result.stdout.toString()) as PR
  } catch {
    return null
  }
}

async function checkPRStatus(pr: PR): Promise<{ mergeable: string }> {
  const result = await $`gh pr view ${pr.number} --repo ${REPO} --json mergeable --jq .mergeable`.quiet()
  return { mergeable: result.stdout.toString().trim() }
}

async function getConflictedFiles(): Promise<string[]> {
  try {
    // Get list of unmerged files
    const result = await $`git diff --name-only --diff-filter=U`.quiet()
    return result.stdout.toString().trim().split("\n").filter(Boolean)
  } catch {
    return []
  }
}

function determineStrategy(filePath: string): "upstream" | "ours" | "merge" | "manual" {
  // Lock files - prefer upstream
  if (/\.(lock|lockb)$/.test(filePath) || filePath.includes("package-lock")) {
    return "upstream"
  }

  // Workflow files - prefer upstream
  if (filePath.startsWith(".github/workflows/")) {
    return "upstream"
  }

  // Generated files - prefer upstream
  if (/\.(generated\.|\.gen\.)/.test(filePath)) {
    return "upstream"
  }

  // Local config files - prefer ours (PR changes)
  if (/AGENTS\.md|\.cursorrules|\.opencode\/|\.vscode\//.test(filePath)) {
    return "ours"
  }

  // Source files - attempt smart merge
  if (/\.(ts|tsx|js|jsx|py|rs|go|java|cpp|c|h|hpp)$/.test(filePath)) {
    return "merge"
  }

  // Default to manual for other files
  return "manual"
}

async function resolveWithUpstream(filePath: string): Promise<boolean> {
  try {
    // --ours = upstream (the branch being merged)
    await $`git checkout --ours ${filePath}`.quiet()
    await $`git add ${filePath}`.quiet()
    return true
  } catch {
    return false
  }
}

async function resolveWithOurs(filePath: string): Promise<boolean> {
  try {
    // --theirs = our branch (PR branch)
    await $`git checkout --theirs ${filePath}`.quiet()
    await $`git add ${filePath}`.quiet()
    return true
  } catch {
    return false
  }
}

async function resolveWithMerge(
  filePath: string,
): Promise<{ success: boolean; hadConflicts: boolean; content?: string; error?: string }> {
  try {
    // Read the conflicted file
    const file = Bun.file(filePath)
    const content = await file.text()

    // Check if it still has conflict markers
    if (!content.includes("<<<<<<<")) {
      // Already resolved by git
      await $`git add ${filePath}`.quiet()
      return { success: true, hadConflicts: false }
    }

    // Parse conflict markers and resolve
    // Strategy: Respect upstream (base) context, keep PR (ours) changes for conflicting sections
    const lines = content.split("\n")
    const resolved: string[] = []
    let inConflict = false
    let inOurs = false
    let inTheirs = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.startsWith("<<<<<<< ")) {
        inConflict = true
        inOurs = true
        inTheirs = false
        continue
      }

      if (line === "=======") {
        inOurs = false
        inTheirs = true
        continue
      }

      if (line.startsWith(">>>>>>> ")) {
        inConflict = false
        inOurs = false
        inTheirs = false
        continue
      }

      if (!inConflict) {
        // Not in conflict - keep the line
        resolved.push(line)
      } else if (inOurs) {
        // In the "ours" section (PR changes) - keep these
        resolved.push(line)
      }
      // Skip the "theirs" section (upstream changes in conflicting part)
    }

    const resolvedContent = resolved.join("\n")

    // Write resolved content
    await Bun.write(filePath, resolvedContent)
    await $`git add ${filePath}`.quiet()

    return { success: true, hadConflicts: true, content: resolvedContent }
  } catch (e: any) {
    return { success: false, hadConflicts: true, error: e?.message || "Unknown error" }
  }
}

async function attemptMerge(pr: PR): Promise<{ success: boolean; files: ConflictFile[] }> {
  const files: ConflictFile[] = []
  const currentBranch = (await $`git branch --show-current`.quiet()).stdout.toString().trim()

  try {
    // Fetch PR branch
    await $`git fetch origin ${pr.headRefName}:${pr.headRefName}`.quiet()

    // Checkout PR branch
    await $`git checkout ${pr.headRefName}`.quiet()

    // Attempt merge from upstream
    const mergeResult = await $`git merge upstream/${pr.baseRefName} --no-commit`.nothrow().quiet()

    // Get list of conflicted files
    const conflictedFiles = await getConflictedFiles()

    if (conflictedFiles.length === 0) {
      // No conflicts - merge succeeded
      if (shouldPush) {
        await $`git commit -m "Merge upstream/${pr.baseRefName} into ${pr.headRefName}"`.quiet()
        await $`git push origin ${pr.headRefName}`.quiet()
      }
      await $`git checkout ${currentBranch}`.quiet()
      return { success: true, files: [] }
    }

    console.log(`\nFound ${conflictedFiles.length} conflicted file(s):`)

    // Resolve each file
    for (const filePath of conflictedFiles) {
      const strategy = determineStrategy(filePath)
      console.log(`  📄 ${filePath} → ${strategy}`)

      const conflictFile: ConflictFile = {
        path: filePath,
        strategy,
        resolved: false,
      }

      try {
        switch (strategy) {
          case "upstream":
            conflictFile.resolved = await resolveWithUpstream(filePath)
            break
          case "ours":
            conflictFile.resolved = await resolveWithOurs(filePath)
            break
          case "merge":
            const mergeResult = await resolveWithMerge(filePath)
            conflictFile.resolved = mergeResult.success
            break
          case "manual":
            conflictFile.error = "Manual resolution required"
            break
        }
      } catch (e: any) {
        conflictFile.error = e?.message || "Resolution failed"
      }

      files.push(conflictFile)
    }

    // Check if all files resolved
    const allResolved = files.every((f) => f.resolved)

    if (allResolved && shouldPush) {
      await $`git commit -m "Resolve conflicts with upstream/${pr.baseRefName}"`.quiet()
      await $`git push origin ${pr.headRefName} --no-verify`.quiet()
      console.log(`\n✅ Pushed resolved changes to PR #${pr.number}`)
    }

    // Cleanup - reset any changes before switching back
    await $`git reset --hard`.nothrow().quiet()
    await $`git checkout ${currentBranch}`.quiet()

    return { success: allResolved, files }
  } catch (e: any) {
    // Cleanup on error
    await $`git merge --abort`.nothrow().quiet()
    await $`git reset --hard`.nothrow().quiet()
    await $`git checkout ${currentBranch}`.nothrow().quiet()
    throw e
  }
}

async function commentOnPR(files: ConflictFile[]) {
  const resolved = files.filter((f) => f.resolved)
  const unresolved = files.filter((f) => !f.resolved)

  let body = `## 🤖 Automatic Conflict Resolution Report\n\n`

  if (resolved.length > 0) {
    body += `### ✅ Resolved (${resolved.length})\n\n`
    for (const file of resolved) {
      body += `- \`${file.path}\` (${file.strategy})\n`
    }
    body += "\n"
  }

  if (unresolved.length > 0) {
    body += `### ❌ Needs Manual Resolution (${unresolved.length})\n\n`
    for (const file of unresolved) {
      body += `- \`${file.path}\`: ${file.error || "Manual resolution required"}\n`
    }
  }

  if (shouldPush && resolved.length === files.length) {
    body += "\n✅ All conflicts resolved and pushed to this PR."
  } else if (resolved.length === files.length) {
    body += "\n⚠️ All conflicts can be resolved automatically. Set `push_resolution: true` to apply."
  }

  try {
    await $`gh pr comment ${prNumber} --repo ${REPO} --body ${body}`.quiet()
  } catch (e) {
    console.log("Failed to comment on PR:", e)
  }
}

async function main() {
  console.log(`🔍 Testing conflict resolution for PR #${prNumber}\n`)

  await setupGit()
  await setupUpstream()

  const pr = await fetchPR()
  if (!pr) {
    console.error(`❌ PR #${prNumber} not found in ${REPO}`)
    process.exit(1)
  }

  console.log(`PR #${pr.number}: ${pr.title}`)
  console.log(`Branch: ${pr.headRefName} → ${pr.baseRefName}\n`)

  const status = await checkPRStatus(pr)
  console.log(`Merge status: ${status.mergeable}`)

  if (status.mergeable === "MERGEABLE") {
    console.log("✅ PR has no conflicts. Nothing to resolve.")
    process.exit(0)
  }

  if (status.mergeable !== "CONFLICTING") {
    console.log("⚠️ PR merge status is unknown. Checking manually...")
  }

  console.log("\n🔄 Attempting automatic conflict resolution...\n")

  const result = await attemptMerge(pr)

  console.log("\n" + "=".repeat(50))
  console.log("\n📊 Resolution Summary:")
  console.log(`  Total files: ${result.files.length}`)
  console.log(`  ✅ Resolved: ${result.files.filter((f) => f.resolved).length}`)
  console.log(`  ❌ Unresolved: ${result.files.filter((f) => !f.resolved).length}`)

  if (result.files.length > 0) {
    console.log("\n📁 File Details:")
    for (const file of result.files) {
      const icon = file.resolved ? "✅" : "❌"
      const status = file.resolved ? "resolved" : file.error || "failed"
      console.log(`  ${icon} ${file.path} (${file.strategy}): ${status}`)
    }
  }

  // Comment on PR
  await commentOnPR(result.files)

  if (result.success) {
    console.log("\n✅ All conflicts resolved successfully!")
    if (!shouldPush) {
      console.log("⚠️ Changes were NOT pushed. Set push_resolution=true to apply.")
    }
  } else {
    console.log("\n❌ Some conflicts require manual resolution.")
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("\n❌ Error:", error)
  process.exit(1)
})
