import os
import json
import glob
from sentence_transformers import SentenceTransformer

print("Loading SentenceTransformer (all-MiniLM-L6-v2)...")
model = SentenceTransformer('all-MiniLM-L6-v2')

# Find all markdown files in mental_health_skill
skill_dir = "mental_health_skill"
md_files = glob.glob(os.path.join(skill_dir, "**/*.md"), recursive=True)

db = []

print(f"Found {len(md_files)} skill documents. Embedding...")

for file_path in md_files:
    # Skip the router.md as it's a meta file
    if "router.md" in file_path:
        continue
        
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read().strip()
        
    if not content:
        continue
        
    # Extract the filename without extension as the title
    title = os.path.basename(file_path).replace(".md", "").replace("_", " ").title()
    
    # Compute embedding
    vector = model.encode(content).tolist()
    
    db.append({
        "title": title,
        "content": content,
        "vector": vector
    })

# Save to disk
with open('rag_db.json', 'w', encoding='utf-8') as f:
    json.dump(db, f)
    
print(f"Successfully built Vector DB with {len(db)} embedded documents at 'rag_db.json'.")
