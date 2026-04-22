#!/bin/bash
TRIGGER_FILE=".ready_for_claude"

echo "AI gatekeeper dang chay... (Nhan Ctrl+C de thoat)"
while true; do
  if [ -f "$TRIGGER_FILE" ]; then
    TASK=$(cat "$TRIGGER_FILE")
    rm "$TRIGGER_FILE"
    echo "========================================"
    echo "Bat dau thuc thi: $TASK"
    claude "Nhiem vu: '$TASK'. Doc docs/BOARD.md va docs/DESIGN.md. Ap dung TDD va tu dong sua code cho den khi PASS test."
    echo "Claude da hoan tat. Dang cho thiet ke moi..."
  fi
  sleep 3
done
