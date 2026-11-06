import json

with open('analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261105-v2/kmeans/kmeans_2024_k3.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

for c in d['clusters']:
    print(f"Cluster {c['cluster_id']} (size: {c['size']})")
    if c['size'] <= 20:
        print("  Members:", c['regions'])

# Also check k=4 and k=5
for k in (4, 5):
    with open(f'analysis/output/runs/ncrb-national-2024-admin-log1p-zscore-20261105-v2/kmeans/kmeans_2024_k{k}.json', 'r', encoding='utf-8') as f:
        dk = json.load(f)
    print(f"\n--- k={k} ---")
    for c in dk['clusters']:
        print(f"Cluster {c['cluster_id']} (size: {c['size']})")
        if c['size'] <= 20:
            print("  Members:", c['regions'])

