"""
Dataset Explorer — Research Tool

Downloads and analyzes the prescription dataset for research documentation.
Generates statistics, sample visualizations, and annotation summaries.

Usage:
  python explore_dataset.py
  python explore_dataset.py --save-samples 20
  python explore_dataset.py --export-stats ./research/dataset_stats.json

Output:
  - Dataset statistics (size, annotation distribution, vocabulary)
  - Sample images saved to ./dataset_samples/
  - Stats JSON for inclusion in research paper
"""

import os
import json
import random
import argparse
import logging
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s")
log = logging.getLogger("dataset-explorer")

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────

HF_DATASET = "chinmays18/medical-prescription-dataset"
SAMPLES_DIR = Path(__file__).parent / "dataset_samples"
STATS_DIR = Path(__file__).parent / "research"


def download_dataset():
    """Download the prescription dataset from HuggingFace."""
    from huggingface_hub import snapshot_download
    from PIL import Image
    import glob

    log.info(f"📥 Downloading dataset repository: {HF_DATASET}")
    repo_path = snapshot_download(repo_id=HF_DATASET, repo_type="dataset")

    # Load raw files directly to bypass deprecated `trust_remote_code` mechanics
    data = []
    train_images_dir = os.path.join(repo_path, "train", "images")
    train_ann_dir = os.path.join(repo_path, "train", "annotations")

    for img_path in glob.glob(os.path.join(train_images_dir, "*.png")):
        base_name = os.path.splitext(os.path.basename(img_path))[0]
        json_path = os.path.join(train_ann_dir, f"{base_name}.json")
        
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                ann = json.load(f)
            
            data.append({
                "image": Image.open(img_path).convert("RGB"),
                "ground_truth": ann.get("ground_truth", "")
            })

    log.info(f"✅ Downloaded {len(data)} samples")
    return data


def analyze_dataset(data):
    """Compute comprehensive dataset statistics."""
    log.info("📊 Analyzing dataset...")

    stats = {
        "dataset_name": HF_DATASET,
        "total_samples": len(data),
        "analyzed_at": datetime.now().isoformat(),
        "columns": list(data.column_names) if hasattr(data, 'column_names') else [],
    }

    # Analyze ground truth annotations
    drug_names = Counter()
    dosage_units = Counter()
    frequency_terms = Counter()
    annotation_lengths = []
    medications_per_sample = []
    all_drug_classes = Counter()

    for i, sample in enumerate(data):
        gt = sample.get("ground_truth", sample.get("text", ""))

        if isinstance(gt, str):
            annotation_lengths.append(len(gt))

            # Try to parse as JSON
            try:
                parsed = json.loads(gt) if gt.strip().startswith("{") else None
                if parsed:
                    meds = parsed.get("medications", [])
                    if isinstance(meds, list):
                        medications_per_sample.append(len(meds))
                        for med in meds:
                            if isinstance(med, dict):
                                name = med.get("drugName", med.get("drug_name", med.get("name", "")))
                                if name:
                                    drug_names[name.lower()] += 1

                                dosage = med.get("dosage", "")
                                if dosage:
                                    # Extract unit
                                    import re
                                    unit_match = re.search(r'(mg|mcg|g|ml|IU|units?|mEq)', dosage, re.I)
                                    if unit_match:
                                        dosage_units[unit_match.group().lower()] += 1

                                freq = med.get("frequency", "")
                                if freq:
                                    frequency_terms[freq.lower()] += 1

                                drug_class = med.get("drugClass", med.get("drug_class", ""))
                                if drug_class:
                                    all_drug_classes[drug_class] += 1
            except (json.JSONDecodeError, ValueError):
                # Free text annotation — count words as potential drug names
                import re
                words = re.findall(r'[A-Z][a-z]+(?:\s[A-Z][a-z]+)?', gt)
                for word in words:
                    if len(word) > 3:
                        drug_names[word.lower()] += 1

        if (i + 1) % 100 == 0:
            log.info(f"   Processed {i + 1}/{len(data)} samples...")

    # Compile statistics
    stats["annotations"] = {
        "avg_length_chars": round(sum(annotation_lengths) / max(len(annotation_lengths), 1), 1),
        "min_length_chars": min(annotation_lengths) if annotation_lengths else 0,
        "max_length_chars": max(annotation_lengths) if annotation_lengths else 0,
    }

    if medications_per_sample:
        stats["medications"] = {
            "total_extracted": sum(medications_per_sample),
            "avg_per_sample": round(sum(medications_per_sample) / len(medications_per_sample), 2),
            "min_per_sample": min(medications_per_sample),
            "max_per_sample": max(medications_per_sample),
            "samples_with_meds": len([m for m in medications_per_sample if m > 0]),
        }

    stats["top_drugs"] = dict(drug_names.most_common(30))
    stats["dosage_units"] = dict(dosage_units.most_common(10))
    stats["frequency_terms"] = dict(frequency_terms.most_common(15))
    stats["drug_classes"] = dict(all_drug_classes.most_common(20))

    stats["unique_drugs"] = len(drug_names)
    stats["unique_dosage_units"] = len(dosage_units)

    # Image statistics (if images are present)
    try:
        sample_image = data[0].get("image")
        if sample_image:
            from PIL import Image
            widths = []
            heights = []
            for i in range(min(50, len(data))):
                img = data[i].get("image")
                if img:
                    if isinstance(img, Image.Image):
                        widths.append(img.width)
                        heights.append(img.height)

            if widths:
                stats["images"] = {
                    "avg_width": round(sum(widths) / len(widths)),
                    "avg_height": round(sum(heights) / len(heights)),
                    "min_width": min(widths),
                    "max_width": max(widths),
                    "min_height": min(heights),
                    "max_height": max(heights),
                    "sampled": len(widths),
                }
    except Exception as e:
        log.warning(f"Could not analyze images: {e}")

    return stats


def save_sample_images(data, num_samples=20):
    """Save sample prescription images for research documentation."""
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)

    indices = random.sample(range(len(data)), min(num_samples, len(data)))

    log.info(f"💾 Saving {len(indices)} sample images to {SAMPLES_DIR}/")

    saved = 0
    for idx in indices:
        sample = data[idx]
        image = sample.get("image")
        gt = sample.get("ground_truth", sample.get("text", ""))

        if image:
            from PIL import Image
            if isinstance(image, Image.Image):
                img_path = SAMPLES_DIR / f"sample_{idx:04d}.png"
                image.save(str(img_path))

                # Save annotation alongside
                ann_path = SAMPLES_DIR / f"sample_{idx:04d}_annotation.txt"
                with open(ann_path, "w", encoding="utf-8") as f:
                    f.write(f"Sample Index: {idx}\n")
                    f.write(f"Ground Truth:\n{gt}\n")

                saved += 1

    log.info(f"   ✅ Saved {saved} sample images")
    return saved


def print_summary(stats):
    """Print a formatted research summary."""
    print("\n" + "=" * 70)
    print("  📊 DATASET SUMMARY — FOR RESEARCH DOCUMENTATION")
    print("=" * 70)

    print(f"\n  Dataset:       {stats['dataset_name']}")
    print(f"  Total Samples: {stats['total_samples']}")
    print(f"  Columns:       {', '.join(stats['columns'])}")

    if "images" in stats:
        img = stats["images"]
        print(f"\n  📸 Image Statistics (sampled {img['sampled']} images):")
        print(f"     Avg Size:   {img['avg_width']} × {img['avg_height']}px")
        print(f"     Range:      {img['min_width']}–{img['max_width']} × {img['min_height']}–{img['max_height']}px")

    if "annotations" in stats:
        ann = stats["annotations"]
        print(f"\n  📝 Annotation Statistics:")
        print(f"     Avg Length: {ann['avg_length_chars']} chars")
        print(f"     Range:      {ann['min_length_chars']}–{ann['max_length_chars']} chars")

    if "medications" in stats:
        med = stats["medications"]
        print(f"\n  💊 Medication Statistics:")
        print(f"     Total Medications: {med['total_extracted']}")
        print(f"     Avg per Sample:    {med['avg_per_sample']}")
        print(f"     Range:             {med['min_per_sample']}–{med['max_per_sample']} per sample")
        print(f"     Samples with Meds: {med['samples_with_meds']}/{stats['total_samples']}")

    print(f"\n  🏷️  Unique Drug Names:    {stats['unique_drugs']}")
    print(f"  🏷️  Unique Dosage Units:  {stats['unique_dosage_units']}")

    if stats["top_drugs"]:
        print(f"\n  📋 Top 15 Most Common Drugs:")
        for i, (drug, count) in enumerate(list(stats["top_drugs"].items())[:15], 1):
            print(f"     {i:2d}. {drug:<25s} ({count} occurrences)")

    if stats["dosage_units"]:
        print(f"\n  📏 Dosage Unit Distribution:")
        for unit, count in stats["dosage_units"].items():
            print(f"     {unit:<10s} {count} occurrences")

    if stats["drug_classes"]:
        print(f"\n  🏥 Drug Class Distribution:")
        for cls, count in list(stats["drug_classes"].items())[:10]:
            print(f"     {cls:<30s} {count} occurrences")

    print("\n" + "=" * 70)


def export_stats(stats, output_path=None):
    """Export statistics to JSON for research inclusion."""
    if output_path is None:
        output_path = STATS_DIR / "dataset_statistics.json"

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)

    log.info(f"📄 Stats exported to: {output_path}")

    # Also generate a markdown summary for the research paper
    md_path = output_path.parent / "dataset_summary.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# Dataset Summary\n\n")
        f.write(f"**Dataset**: `{stats['dataset_name']}`\n\n")
        f.write(f"| Metric | Value |\n|---|---|\n")
        f.write(f"| Total Samples | {stats['total_samples']} |\n")
        f.write(f"| Unique Drugs | {stats['unique_drugs']} |\n")
        if "medications" in stats:
            f.write(f"| Total Medications | {stats['medications']['total_extracted']} |\n")
            f.write(f"| Avg Medications/Sample | {stats['medications']['avg_per_sample']} |\n")
        if "images" in stats:
            f.write(f"| Avg Image Size | {stats['images']['avg_width']} × {stats['images']['avg_height']}px |\n")
        f.write(f"\n## Top Drugs\n\n")
        f.write("| Rank | Drug Name | Count |\n|---|---|---|\n")
        for i, (drug, count) in enumerate(list(stats["top_drugs"].items())[:20], 1):
            f.write(f"| {i} | {drug.title()} | {count} |\n")

    log.info(f"📄 Markdown summary exported to: {md_path}")


# ─────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Explore the prescription dataset for research")
    parser.add_argument("--save-samples", type=int, default=20, help="Number of sample images to save")
    parser.add_argument("--export-stats", type=str, default=None, help="Path to export stats JSON")
    parser.add_argument("--no-download", action="store_true", help="Skip dataset download (use cached)")
    args = parser.parse_args()

    data = download_dataset()
    stats = analyze_dataset(data)
    print_summary(stats)
    save_sample_images(data, args.save_samples)
    export_stats(stats, args.export_stats)

    print(f"\n✅ Done! Check {SAMPLES_DIR}/ for sample images and {STATS_DIR}/ for stats.")
