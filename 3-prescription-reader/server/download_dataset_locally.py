"""
Dataset Downloader Utility

Downloads the full Hugging Face prescription dataset natively to your local machine 
for offline storage, backup, and local research usage.

Usage:
    python download_dataset_locally.py
"""

import os
from pathlib import Path
from huggingface_hub import snapshot_download

DATASET_NAME = "chinmays18/medical-prescription-dataset"
OUTPUT_DIR = Path(__file__).parent / "data" / "medical-prescription-dataset"

def main():
    print("=" * 60)
    print(f"🏥 Local Dataset Downloader")
    print(f"📥 Target: {DATASET_NAME}")
    print("=" * 60)
    
    # Ensure directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    print("\nConnecting to Hugging Face and downloading files...")
    print("(This might take a few minutes as it downloads ~1GB of high-res images)\n")
    
    try:
        # snapshot_download directly clones the dataset repository 
        # local_dir ensures the raw files exist outside the hidden HF cache vault.
        repo_path = snapshot_download(
            repo_id=DATASET_NAME, 
            repo_type="dataset",
            local_dir=OUTPUT_DIR,
            local_dir_use_symlinks=False 
        )
        
        print("\n✅ Download Phase Complete!")
        print(f"📁 Dataset permanently saved to:\n   {OUTPUT_DIR.absolute()}")
        
        # Verify contents
        train_img_dir = OUTPUT_DIR / "train" / "images"
        train_ann_dir = OUTPUT_DIR / "train" / "annotations"
        
        if train_img_dir.exists():
            num_images = len([f for f in os.listdir(train_img_dir) if f.endswith(('.png', '.jpg'))])
            print(f"   📸 Train Split: {num_images} Images")
        
        if train_ann_dir.exists():
            num_anns = len([f for f in os.listdir(train_ann_dir) if f.endswith('.json')])
            print(f"   📝 Train Split: {num_anns} Validated JSON Annotations")
            
        print("\n🎉 You can now browse your dataset locally without an internet connection!")
        
    except Exception as e:
        print(f"\n❌ Error downloading dataset: {e}")

if __name__ == "__main__":
    main()
