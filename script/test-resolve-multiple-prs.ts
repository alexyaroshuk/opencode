#!/usr/bin/env bun

import { $ } from "bun"

const GITHUB_REPO = "alexyaroshuk/opencode"

const prNumbersInput = process.env.PR_NUMBERS || ""
const shouldPush = process.env.PUSH_RESOLUTION === "true"

if (!prNumbersInput) {
  console.error("Error: PR_NUMBERS environment variable is required")
  console.error("Usage: PR_NUMBERS='13530,13531,13532' bun script/test-resolve-multiple-prs.ts")
  process.exit(1)
}

const prNumbers = prNumbersInput
  .split(",")
  .map((n) => parseInt(n.trim()))
  .filter((n) => !isNaN(n))

if (prNumbers.length === 0) {
  console.error("Error: No valid PR numbers provided")
  process.exit(1)
}

console.log(`🔄 Testing resolution for ${prNumbers.length} PR(s): ${prNumbers.join(", ")}\n`)

async function triggerResolutionWorkflow(prNumber: number): Promise<{ success: boolean; error?: string }> {
  try {
    await $`gh api repos/${GITHUB_REPO}/actions/workflows/test-resolve-pr-conflicts.yml/dispatches \
      -X POST \
      -f ref=daily-pr-conflicts \
      -f inputs[pr_number]=${prNumber} \
      -f inputs[push_resolution]=${shouldPush}`.quiet()

    return { success: true }
  } catch (e: any) {
    const error = e?.stderr?.toString() || e?.stdout?.toString() || "Unknown error"
    return { success: false, error }
  }
}

async function main() {
  const results: { prNumber: number; success: boolean; error?: string }[] = []

  console.log("Triggering resolution workflows:\n")

  for (const prNumber of prNumbers) {
    process.stdout.write(`  PR #${prNumber}: `)
    const result = await triggerResolutionWorkflow(prNumber)
    results.push({ prNumber, ...result })

    if (result.success) {
      console.log("✅ Triggered")
    } else {
      console.log(`❌ Failed: ${result.error}`)
    }
  }

  console.log("\n" + "=".repeat(50))
  console.log("\n📊 Summary:")
  console.log(`  Total PRs: ${results.length}`)
  console.log(`  ✅ Triggered: ${results.filter((r) => r.success).length}`)
  console.log(`  ❌ Failed: ${results.filter((r) => !r.success).length}`)

  if (shouldPush) {
    console.log("\n⏳ Resolution workflows are running with push_resolution=true")
    console.log("   Commits will be pushed to PR branches if conflicts are resolved")
  } else {
    console.log("\n⏳ Resolution workflows are running in dry-run mode")
    console.log("   Set push_resolution=true to actually apply fixes")
  }

  console.log("\n🔗 Check the Actions tab to monitor progress:")
  console.log(`   https://github.com/${GITHUB_REPO}/actions/workflows/test-resolve-pr-conflicts.yml`)

  const failedCount = results.filter((r) => !r.success).length
  if (failedCount > 0) {
    console.log("\n❌ Some workflows failed to trigger:")
    for (const result of results.filter((r) => !r.success)) {
      console.log(`   PR #${result.prNumber}: ${result.error}`)
    }
    process.exit(1)
  }

  console.log("\n✅ All workflows triggered successfully!")
}

main().catch((error) => {
  console.error("\n❌ Error:", error)
  process.exit(1)
})
