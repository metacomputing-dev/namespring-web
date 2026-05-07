#!/bin/bash
# Phase 24 Agent A5 — Production CI gates run script.
#
# Captures output of the 14 production CI gates + ci:hook-concentration
# + ci:samples-stale + test:namespring-compat against current main HEAD
# (16 gates total). Each gate is tagged with
# [branch=phase24-agent-a5 head=<short-sha>].
#
# P24-A1 (`ci:standard-paragraph-floor`) and P24-A2
# (`ci:brief-tier-placeholder`) are pending merge — the underlying
# metrics are surfaced via snapshot measurement instead (sub-3 = 0,
# PLACEHOLDER = 0). Once P24-A1 + P24-A2 merge, the gate count will
# become 18.
#
# Read-only on data + samples. Pure CI gate execution.
#
# Usage: bash artifacts/phase24-agent-a5/run_gates.sh > acceptance-gates.txt 2>&1

set +e
TAG='[branch=phase24-agent-a5 head=0290ea65]'

echo "Phase 24 Agent A5 — Post-fix acceptance gates"
echo "Generated at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Identity: $TAG"
echo ""
echo "Sample regen / measurement performed at $TAG"
echo ""

run_gate() {
  local name="$1"
  echo "===== ${name} ${TAG} ====="
  echo ""
  npm --silent run "${name}"
  local rc=$?
  echo ""
  echo "===== ${name} exit=${rc} ====="
  echo ""
}

run_gate typecheck
run_gate ci:no-ai-policy
run_gate ci:narrative-voice
run_gate ci:narrative-truncated-endings
run_gate ci:narrative-tag-label-alignment
run_gate ci:narrative-orphan-tags
run_gate ci:narrative-cell-axis
run_gate ci:narrative-density
run_gate ci:narrative-tuple-density
run_gate ci:narrative-daymaster-tuple-density
run_gate ci:post-processor-grammar
run_gate ci:hook-coverage
run_gate ci:hook-concentration
run_gate ci:acceptance-completeness
run_gate ci:samples-stale
run_gate test:namespring-compat
