#!/usr/bin/env bash
# 用法：bash push.sh git@github.com:owner/repo.git
set -euo pipefail
URL="${1:-}"
if [ -z "$URL" ]; then
  echo "用法: bash push.sh git@github.com:owner/repo.git"
  exit 1
fi
cd "$(dirname "$0")"
git remote remove origin >/dev/null 2>&1 || true
git remote add origin "$URL"
echo "→ 探测远端: $URL"
if git ls-remote --exit-code origin >/dev/null 2>&1; then
  echo "远端已有内容，先看一眼前 3 条提交："
  git fetch origin >/dev/null 2>&1 || true
  git log --oneline -3 FETCH_HEAD 2>/dev/null || echo "(读取失败)"
  echo
  read -r -p "远端非空，是否强制覆盖（输入 YES 继续）: " ans
  [ "$ans" = "YES" ] || { echo "已取消，未推送"; exit 1; }
  git push -u origin HEAD:main --force
else
  echo "远端为空仓库，直接推送："
  git push -u origin HEAD:main
fi
echo
echo "完成：$URL"
echo "提示：仓库 Settings → Pages → Source 选 main / (root)，即可直接用网址访问 index.html"