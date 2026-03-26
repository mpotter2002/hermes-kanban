#!/usr/bin/env bash

set -euo pipefail

input="$(cat)"
cache_dir="${HOME}/.claude/statusline"
cache_path="${cache_dir}/latest.json"

mkdir -p "${cache_dir}"

echo "${input}" | jq '{
  captured_at: (now * 1000 | floor),
  model: (.model.display_name // null),
  five_hour_used_percentage: (.rate_limits.five_hour.used_percentage // null),
  seven_day_used_percentage: (.rate_limits.seven_day.used_percentage // null),
  five_hour_resets_at: (.rate_limits.five_hour.resets_at // null),
  seven_day_resets_at: (.rate_limits.seven_day.resets_at // null)
}' > "${cache_path}.tmp"
mv "${cache_path}.tmp" "${cache_path}"

MODEL="$(echo "${input}" | jq -r '.model.display_name')"
FIVE_H="$(echo "${input}" | jq -r '.rate_limits.five_hour.used_percentage // empty')"
WEEK="$(echo "${input}" | jq -r '.rate_limits.seven_day.used_percentage // empty')"
LIMITS=""
[ -n "${FIVE_H}" ] && LIMITS="5h: $(printf %.0f "${FIVE_H}")%"
[ -n "${WEEK}" ] && LIMITS="${LIMITS:+${LIMITS} }7d: $(printf %.0f "${WEEK}")%"
[ -n "${LIMITS}" ] && echo "[${MODEL}] | ${LIMITS}" || echo "[${MODEL}]"
