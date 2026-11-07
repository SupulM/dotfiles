# Dotfiles

My dotfiles are a **bare git repo** at `~/.dotfiles` with `$HOME` as the work tree,
published **publicly** at https://github.com/SupulM/dotfiles.

- Run git through the alias `dotfiles` (= `git --git-dir=$HOME/.dotfiles --work-tree=$HOME`).
  In a non-interactive shell, spell it out in full, since the alias may not be loaded.
- **Add files by explicit path only.** Never `dotfiles add -A`, `add .` or `add -u ~`;
  the work tree is my entire home directory. `dotfiles commit -a` is fine (tracked files only).
- Untracked files are hidden (`status.showUntrackedFiles=no`). To find configs not yet
  tracked: `dotfiles status -uall -- .config`.
- Before committing, show me `dotfiles diff --cached` and read every newly added file.
  The repo is public, so no secrets, tokens, hostnames, or employer/work-internal content.
- Work- or machine-specific settings go in untracked files that the tracked ones source/include:
  `~/.zshrc.local`, `~/.gitconfig.local`, `~/.homebrew/Brewfile.work`.
- A pre-commit hook (`~/.config/dotfiles/hooks/pre-commit`, via `core.hooksPath`) runs
  trufflehog plus a private regex blocklist at `~/.config/dotfiles/blocklist.local`.
  Never copy blocklist terms into tracked files, and never use `--no-verify` without asking.
- `~/.gitignore` blocks `.claude/*` (except the files explicitly un-ignored there) and `Library/`.
  To track something there, add a `!path` line; for app configs prefer a `~/.config/` location.
- Commits use my GitHub noreply email (set in the repo-local config). If `dotfiles push`
  fails with an auth error, retry with
  `-c credential.helper= -c 'credential.helper=!gh auth git-credential'`.
- Ask before pushing.
