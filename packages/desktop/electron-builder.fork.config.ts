import type { Configuration } from "electron-builder"
import baseConfig from "./electron-builder.config"

const owner = process.env.GH_OWNER
const repo = process.env.GH_REPO

if (!owner || !repo) {
  throw new Error("electron-builder.fork.config: GH_OWNER and GH_REPO env vars required")
}

const resolved = (await Promise.resolve(baseConfig)) as Configuration

const { installerIcon: _installerIcon, installerHeaderIcon: _installerHeaderIcon, ...nsisRest } = resolved.nsis ?? {}

const config: Configuration = {
  ...resolved,
  publish: { provider: "github", owner, repo, channel: "latest" },
  win: {
    ...resolved.win,
    icon: "resources/icons/icon.png",
  },
  nsis: nsisRest,
}

export default config
