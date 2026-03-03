import os
import re

versions_dir = os.path.join("back", "alembic", "versions")

revisions = {}
down_revisions = {}

print(f"📂 Checking migrations in: {versions_dir}")

found_files = set()

for filename in os.listdir(versions_dir):
    if not filename.endswith(".py"):
        continue
    
    filepath = os.path.join(versions_dir, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
        # 정규식 수정: revision이나 down_revision 뒤에 따옴표 안의 값을 찾음 (타입 힌트 무시)
        rev_match = re.search(r"revision\s*[:=].*?['\"]([^'\"]+)['\"]", content)
        down_rev_match = re.search(r"down_revision\s*[:=].*?['\"]([^'\"]+)['\"]", content)
        
        if rev_match:
            rev_id = rev_match.group(1)
            found_files.add(filename)
            # None 또는 문자열 처리
            down_rev_id = down_rev_match.group(1) if down_rev_match else None
            
            revisions[rev_id] = {
                "file": filename,
                "down": down_rev_id
            }

            if down_rev_id:
                if down_rev_id not in down_revisions:
                    down_revisions[down_rev_id] = []
                down_revisions[down_rev_id].append(rev_id)

print(f"✅ Found {len(revisions)} revisions.")

all_files = set(f for f in os.listdir(versions_dir) if f.endswith(".py"))
missing_files = all_files - found_files
if missing_files:
    print(f"❌ SKIPPED FILES (Check format): {missing_files}")

# Check for disconnects (multiple heads or missing parents)
heads = []
for rev_id, data in revisions.items():
    # If no one points to this revision as parent, it might be a head
    is_parent = rev_id in down_revisions
    if not is_parent:
        heads.append(rev_id)

    # Check if parent exists
    parent = data["down"]
    if parent and parent not in revisions:
        print(f"❌ BROKEN LINK: {rev_id} ({data['file']}) points to MISSING parent {parent}")

print(f"🧩 Detected Heads: {len(heads)}")
for h in heads:
    print(f"  - {h} ({revisions[h]['file']}) -> Parent: {revisions[h]['down']}")

if len(heads) > 1:
    print("⚠️ MULTIPLE HEADS FOUND! Merge required.")
