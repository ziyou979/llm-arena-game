#!/bin/sh
# 像素竞技场 skill 安装/更新（macOS / Linux / WSL / Git Bash）
#   sh install.sh http://<服务器>:8787           自动找本机装了的 AI 工具，装进各自的 skill 目录
#   sh install.sh http://<服务器>:8787 <目录>    只装到指定目录
set -e
if [ -z "$1" ]; then echo "用法：sh install.sh http://<服务器>:8787 [目录]"; exit 1; fi
B="${1%/}"; shift
fetch(){ if command -v curl >/dev/null 2>&1; then curl -fsSL "$1"; else wget -qO- "$1"; fi; }
T=""
add(){ T="$T
$1/pixel-arena"; }
if [ -n "$1" ]; then T="$1"; else
  { [ -d "$HOME/.codex" ] || [ -d "$HOME/.minimax" ] || [ -d "$HOME/.agents" ]; } && add "$HOME/.agents/skills"
  [ -d "$HOME/.claude" ] && add "$HOME/.claude/skills"
  [ -d "$HOME/.qoder" ] && add "$HOME/.qoder/skills"
  { [ -d "$HOME/.gemini/config" ] || [ -d "$HOME/.gemini/antigravity" ]; } && add "$HOME/.gemini/config/skills"
  [ -f "$HOME/.gemini/settings.json" ] && add "$HOME/.gemini/skills"
  [ -d "$HOME/.workbuddy" ] && add "$HOME/.workbuddy/skills"
  [ -z "$T" ] && add "$HOME/.agents/skills"
fi
M=$(fetch "$B/skill/manifest.json")
V=$(printf '%s' "$M" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
FILES=$(printf '%s' "$M" | grep -o '"path":"[^"]*"' | cut -d'"' -f4)
mkdir -p "$HOME/.pixel-arena"; REG="$HOME/.pixel-arena/installs.txt"; touch "$REG"
printf '%s\n' "$T" | while IFS= read -r dir; do
  [ -z "$dir" ] && continue
  for f in $FILES; do mkdir -p "$dir/$(dirname "$f")"; fetch "$B/skill/file/$f" > "$dir/$f.tmp" && mv "$dir/$f.tmp" "$dir/$f"; done
  printf '%s' "$M" > "$dir/.manifest.json"; printf '%s\n' "$B" > "$dir/.server"
  grep -qxF "$dir" "$REG" || printf '%s\n' "$dir" >> "$REG"
  echo "已装到 $dir（版本 $V）"
done
echo "以后每局开局，模型跑 arena.mjs update 会把上面所有位置一起同步。装完重启一下 AI 工具。"
