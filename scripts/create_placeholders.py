import os

os.makedirs("data/serving/releases", exist_ok=True)
open("data/serving/releases/.gitkeep", "w").close()
open("data/raw/.gitkeep", "w").close()
open("data/mappings/.gitkeep", "w").close()
print("Placeholder .gitkeep files created")
