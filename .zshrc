# ~/.zshrc

# User configuration
export PATH="$HOME/.local/bin:$PATH"

# Catppuccin Mocha file-type colors (used by ls and completion menu)
export LS_COLORS="$(vivid generate catppuccin-mocha)"

# Completion: menu with highlighted selection (Tab cycles, arrows navigate)
autoload -Uz compinit
compinit
zmodload zsh/complist
zstyle ':completion:*' menu select
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}'
zstyle ':completion:*' list-colors ${(s.:.)LS_COLORS}
zstyle ':completion:*:descriptions' format '%F{yellow}-- %d --%f'
# In the selection menu: hjkl to move, Enter to accept
bindkey -M menuselect 'h' vi-backward-char
bindkey -M menuselect 'l' vi-forward-char
bindkey -M menuselect 'j' vi-down-line-or-history
bindkey -M menuselect 'k' vi-up-line-or-history

# fzf: preview files with bat (syntax highlighting), directories as an
# eza tree view, falling back to ls if either tool is unavailable.
export FZF_DEFAULT_OPTS="--height=80% --layout=reverse --border \
--preview '[[ -d {} ]] && eza --tree --color=always --level=2 --icons=always {} || bat --style=numbers --color=always --line-range=:500 {} 2>/dev/null || ls -la --color=always {}' \
--preview-window 'right:50%'"

# Don't run the file preview on Ctrl-R history search
export FZF_CTRL_R_OPTS="--no-preview"

# fzf key bindings and fuzzy completion
source <(fzf --zsh)

eval "$(starship init zsh)"

# Transient prompt: collapse previous prompts to just the character module
# once a command is accepted, keeping scrollback compact.
zle-line-init() {
    emulate -L zsh
    [[ $CONTEXT == start ]] || return 0

    while true; do
        zle .recursive-edit
        local -i ret=$?
        [[ $ret == 0 && $KEYS == $'\4' ]] || break
        [[ -o ignore_eof ]] || break
    done

    local saved_prompt=$PROMPT
    local saved_rprompt=$RPROMPT

    PROMPT='$(starship module character) '
    RPROMPT=''
    zle .reset-prompt

    PROMPT=$saved_prompt
    RPROMPT=$saved_rprompt

    if (( ret )); then
        zle .send-break
    else
        zle .accept-line
    fi
    return ret
}
zle -N zle-line-init

# Qwen Code PATH block begin
# (~/.local/bin is already added at the top of this file)
# Qwen Code PATH block end

# Dotfiles: bare repo at ~/.dotfiles, work-tree is $HOME
alias dotfiles='/usr/bin/git --git-dir=$HOME/.dotfiles --work-tree=$HOME'

# Added by LM Studio CLI (lms)
export PATH="$PATH:$HOME/.lmstudio/bin"
# End of LM Studio CLI section


# OpenJDK 21 (Homebrew, keg-only)
export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"

# Machine-specific / private settings (not tracked in dotfiles)
[[ -f ~/.zshrc.local ]] && source ~/.zshrc.local
