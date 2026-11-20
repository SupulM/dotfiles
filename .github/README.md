# dotfiles

My macOS terminal setup: zsh + starship, tmux, Ghostty, yazi, Zed, and a
Homebrew bundle, themed around Catppuccin Mocha.

Managed as a **bare git repo** in `~/.dotfiles` with `$HOME` as the work tree,
so there are no symlinks and no install scripts. Files live where the tools expect them.

## What's here

| Path | What |
|---|---|
| `.zshrc` | zsh: completion menu, fzf (bat/eza previews), starship, transient prompt |
| `.config/starship.toml` | Prompt |
| `.tmux.conf` | tmux + TPM + catppuccin |
| `.config/ghostty/config.ghostty` | Ghostty terminal |
| `.config/yazi/` | yazi file manager (keymap, theme, plugins) |
| `.config/zed/settings.json` | Zed editor |
| `.config/btop/`, `.config/herdr/`, `.config/ccstatusline/`, `.config/gh/config.yml` | Misc tool configs |
| `.config/lazygit/config.yml`, `.config/posting/config.yaml` | lazygit and posting, both Catppuccin Mocha |
| `.warp/settings.toml` | Warp terminal |
| `.claude/settings.json`, `.claude/hooks/` | Claude Code settings |
| `.claude/CLAUDE.md` | Global Claude Code instructions (how to work with this repo) |
| `.config/claude-mods/token-weather/` | Claude Code mod: a context-window forecast in the footer line |
| `.gitconfig`, `.config/git/ignore`, `.tigrc`, `.nanorc` | git (config and global ignore), tig, nano |
| `.homebrew/Brewfile` | Everything installed via Homebrew |
| `.gitignore` | Ignore rules for this repo only: secrets and machine state that must never be tracked |
| `.config/dotfiles/hooks/pre-commit` | Guard for this repo: secret scan, plus a check that this table covers every new file |

## Install on a new Mac

```sh
# 1. Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Clone and check out (back up any files that conflict first)
git clone --bare https://github.com/SupulM/dotfiles.git "$HOME/.dotfiles"
alias dotfiles='/usr/bin/git --git-dir=$HOME/.dotfiles --work-tree=$HOME'
dotfiles checkout
dotfiles config status.showUntrackedFiles no
dotfiles config core.hooksPath '~/.config/dotfiles/hooks'

# 3. Packages
brew bundle --file ~/.homebrew/Brewfile

# 4. Plugins
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm   # then prefix + I inside tmux
ya pkg install                                                     # yazi plugins/flavors
```

## Machine-specific settings (not tracked)

Private or per-machine settings live in local files that are sourced if present
and git-ignored:

- `~/.zshrc.local`: extra env vars / PATH entries
- `~/.gitconfig.local`: `[user] email = …` and other overrides
- `~/.homebrew/Brewfile.work`: packages only needed on one machine
- `~/.config/dotfiles/blocklist.local`: regexes the pre-commit hook refuses to commit

## Day-to-day

```sh
dotfiles status
dotfiles add ~/.config/foo/config.toml   # always add files by name, never `add -A` / `add .`
dotfiles commit -m "…"
dotfiles push
```

The pre-commit hook runs `trufflehog` and the local blocklist against staged
content and blocks the commit if anything is found. It also blocks a commit that
adds a file the "What's here" table doesn't cover (by exact path or a listed
directory), so add the row in the same commit.

> `brew bundle dump --global --force` regenerates the Brewfile from *everything*
> installed, including machine-specific packages. Review the diff before committing.
