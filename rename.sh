#!/bin/bash
# --- set these two, then run from the project root ---
OLD_NAME="Hostel Fund Manager"
NEW_NAME="Expense Splitter"

OLD_SLUG="hostel-fund"
NEW_SLUG="expense-splitter"

# 1. Replace the display name everywhere it appears in source files
grep -rl "$OLD_NAME" src supabase .lovable 2>/dev/null | while read -r f; do
  sed -i "s/$OLD_NAME/$NEW_NAME/g" "$f"
done

# 2. Replace the localStorage key prefixes
sed -i "s/$OLD_SLUG/$NEW_SLUG/g" src/lib/store.tsx
sed -i "s/$OLD_SLUG/$NEW_SLUG/g" src/lib/supabase.ts

# 3. Update package.json's internal name field
sed -i 's/"name": "tanstack_start_ts"/"name": "'"$NEW_SLUG"'"/' package.json

# 4. Confirm nothing was missed
echo "Remaining matches (should be empty):"
grep -rn "$OLD_NAME\|$OLD_SLUG" src supabase package.json .lovable 2>/dev/null