> [!NOTE]
> **This is a personal fork of [opencode](https://github.com/anomalyco/opencode)** that I maintain for my own use. The features and fixes below live here because I rely on them day-to-day. I've opened PRs upstream but they've been sitting without review, so the fork ships them in the meantime. You're welcome to use it, but it's not a maintained product.
>
> | Feature | Description | PR |
> | ------- | ----------- | -- |
> | Send with Ctrl+Enter (desktop) | New General → Input toggle. Enter inserts a newline; Ctrl/Cmd+Enter sends the message. Default off | [#13637](https://github.com/anomalyco/opencode/pull/13637) |
> | View & restore archived sessions | Adds an "Archived Sessions" tab in Settings to browse and unarchive sessions across projects | [#15250](https://github.com/anomalyco/opencode/pull/15250) |
> | Edit config files inside app | Adds a Config tab in Settings to edit `opencode.json` files directly in the desktop app with JSON validation | [#14617](https://github.com/anomalyco/opencode/pull/14617) |
> | Marquee scroll for long sidebar titles | Sidebar session titles scroll horizontally on hover to reveal full text instead of truncating | [#13210](https://github.com/anomalyco/opencode/pull/13210) |
>
> **Fixes**
>
> | Fix | Description | PR |
> | --- | ----------- | -- |
> | TUI: `Ctrl+V` text paste on Windows | Pasting text in the TUI prompt was a no-op under Bun on Windows. Now reads text via PowerShell `Get-Clipboard -Raw` alongside the existing image probe | [#97](https://github.com/alexyaroshuk/opencode/pull/97) |
>
> ### Install (Windows)
>
> **TUI / CLI** — open PowerShell, paste, hit Enter:
>
> ```powershell
> iwr -useb https://github.com/alexyaroshuk/opencode/releases/latest/download/install-fork.ps1 | iex
> ```
>
> Downloads the latest fork release, extracts `opencode-fork.exe` to `%LOCALAPPDATA%\opencode-fork`, adds it to your user PATH. Coexists with upstream `opencode`. Open a new shell and run `opencode-fork`.
>
> **Desktop app** — download the installer from the [latest release](https://github.com/alexyaroshuk/opencode/releases/latest) and run it:
>
> - `opencode-desktop-win-x64.exe` — Electron installer for the desktop app
>
> **Release assets at a glance**
>
> | File | What it is |
> | ---- | ---------- |
> | `install-fork.ps1` | PowerShell installer for the CLI/TUI. Run it via the one-liner above |
> | `opencode-fork-windows-x64.zip` | Windows CLI/TUI binary. The PowerShell installer downloads this for you, but you can also unzip it manually and drop `opencode-fork.exe` anywhere on your PATH |
> | `opencode-desktop-win-x64.exe` | Desktop app installer (Electron). Run it to install the GUI |
> | `latest.yml` | Update manifest used by the desktop app's auto-updater — ignore |
> | Source code (zip/tar.gz) | GitHub-generated source archives — ignore unless you want to build from source |

<p align="center">
  <a href="https://opencode.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="OpenCode logo">
    </picture>
  </a>
</p>
<p align="center">The open source AI coding agent.</p>
<p align="center">
  <a href="https://opencode.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/opencode-ai"><img alt="npm" src="https://img.shields.io/npm/v/opencode-ai?style=flat-square" /></a>
  <a href="https://github.com/anomalyco/opencode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/anomalyco/opencode/publish.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

[![OpenCode Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://opencode.ai)

---

### Installation

```bash
# YOLO
curl -fsSL https://opencode.ai/install | bash

# Package managers
npm i -g opencode-ai@latest        # or bun/pnpm/yarn
scoop install opencode             # Windows
choco install opencode             # Windows
brew install anomalyco/tap/opencode # macOS and Linux (recommended, always up to date)
brew install opencode              # macOS and Linux (official brew formula, updated less)
sudo pacman -S opencode            # Arch Linux (Stable)
paru -S opencode-bin               # Arch Linux (Latest from AUR)
mise use -g opencode               # Any OS
nix run nixpkgs#opencode           # or github:anomalyco/opencode for latest dev branch
```

> [!TIP]
> Remove versions older than 0.1.x before installing.

### Desktop App (BETA)

OpenCode is also available as a desktop application. Download directly from the [releases page](https://github.com/anomalyco/opencode/releases) or [opencode.ai/download](https://opencode.ai/download).

| Platform              | Download                           |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `opencode-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `opencode-desktop-mac-x64.dmg`     |
| Windows               | `opencode-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm`, or `.AppImage`     |

```bash
# macOS (Homebrew)
brew install --cask opencode-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/opencode-desktop
```

#### Installation Directory

The install script respects the following priority order for the installation path:

1. `$OPENCODE_INSTALL_DIR` - Custom installation directory
2. `$XDG_BIN_DIR` - XDG Base Directory Specification compliant path
3. `$HOME/bin` - Standard user binary directory (if it exists or can be created)
4. `$HOME/.opencode/bin` - Default fallback

```bash
# Examples
OPENCODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://opencode.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://opencode.ai/install | bash
```

### Agents

OpenCode includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

Learn more about [agents](https://opencode.ai/docs/agents).

### Documentation

For more info on how to configure OpenCode, [**head over to our docs**](https://opencode.ai/docs).

### Contributing

If you're interested in contributing to OpenCode, please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Building on OpenCode

If you are working on a project that's related to OpenCode and is using "opencode" as part of its name, for example "opencode-dashboard" or "opencode-mobile", please add a note to your README to clarify that it is not built by the OpenCode team and is not affiliated with us in any way.

### FAQ

#### How is this different from Claude Code?

It's very similar to Claude Code in terms of capability. Here are the key differences:

- 100% open source
- Not coupled to any provider. Although we recommend the models we provide through [OpenCode Zen](https://opencode.ai/zen), OpenCode can be used with Claude, OpenAI, Google, or even local models. As models evolve, the gaps between them will close and pricing will drop, so being provider-agnostic is important.
- Built-in opt-in LSP support
- A focus on TUI. OpenCode is built by neovim users and the creators of [terminal.shop](https://terminal.shop); we are going to push the limits of what's possible in the terminal.
- A client/server architecture. This, for example, can allow OpenCode to run on your computer while you drive it remotely from a mobile app, meaning that the TUI frontend is just one of the possible clients.

---

**Join our community** [Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
