#!/bin/bash
# Runs the slow headless checks one after another (software rendering is CPU-bound, so parallel runs
# only slow each other down). Usage: tests/run-queue.sh <job>...  Jobs:
#   timing:<url>                      frame-rate independence test
#   capture:<url>:<outDir>:<vp>:<presets>:<query>   gate shots
#   compare:<goldenDir>:<candDir>:<outDir>          SSIM comparison
cd "$(dirname "$0")/.."
for job in "$@"; do
  IFS='|' read -r kind a b c d e <<< "$job"
  echo "=== $(date +%H:%M:%S) $job"
  case "$kind" in
    timing)  node tests/timing.cjs "$a" ;;
    capture) node tests/capture.cjs "$a" "$b" "$c" "$d" "$e" ;;
    compare) node tests/compare.cjs "$a" "$b" "$c" ;;
    sim)     node tests/sim-check.cjs "$a" ;;
    *) echo "unknown job $kind" ;;
  esac
  echo "=== exit $?"
done
echo "QUEUE DONE"
