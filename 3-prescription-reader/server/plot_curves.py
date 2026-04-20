"""
Plot Training Loss Curves — Research Visualization

Generates publication-ready loss curve plots from training history.

Usage:
  python plot_curves.py
  python plot_curves.py --history ./research/training_history.json
  python plot_curves.py --comparison ./research/evaluation_results.json

Output:
  - Training/validation loss curve (PNG)
  - Model comparison bar chart (PNG)
  - Learning rate schedule plot (PNG)
"""

import json
import argparse
from pathlib import Path

RESEARCH_DIR = Path(__file__).parent / "research"


def plot_loss_curves(history_path=None):
    """Plot training and validation loss curves."""
    import matplotlib.pyplot as plt
    import matplotlib

    matplotlib.rcParams.update({
        'font.size': 12,
        'font.family': 'sans-serif',
        'axes.titlesize': 14,
        'axes.labelsize': 12,
        'figure.figsize': (10, 6),
        'figure.dpi': 150,
    })

    if history_path is None:
        history_path = RESEARCH_DIR / "training_history.json"

    with open(history_path) as f:
        data = json.load(f)

    history = data["history"]
    epochs = [h["epoch"] for h in history]
    train_losses = [h["train_loss"] for h in history]
    val_losses = [h["val_loss"] for h in history if h["val_loss"] is not None]
    val_epochs = [h["epoch"] for h in history if h["val_loss"] is not None]

    # ── Plot 1: Loss Curves ──
    fig, ax = plt.subplots()
    ax.plot(epochs, train_losses, 'b-', linewidth=2, label='Training Loss', alpha=0.8)
    if val_losses:
        ax.plot(val_epochs, val_losses, 'r-o', linewidth=2, markersize=6, label='Validation Loss')

    ax.set_xlabel('Epoch')
    ax.set_ylabel('Loss')
    ax.set_title('Donut Model — Training & Validation Loss')
    ax.legend(loc='upper right')
    ax.grid(True, alpha=0.3)
    ax.set_xlim(1, max(epochs))

    # Add annotations
    if val_losses:
        best_val = min(val_losses)
        best_epoch = val_epochs[val_losses.index(best_val)]
        ax.annotate(
            f'Best: {best_val:.4f}\n(Epoch {best_epoch})',
            xy=(best_epoch, best_val),
            xytext=(best_epoch + 2, best_val + 0.1),
            arrowprops=dict(arrowstyle='->', color='red'),
            fontsize=10, color='red',
        )

    fig.tight_layout()
    out_path = RESEARCH_DIR / "loss_curve.png"
    fig.savefig(str(out_path), bbox_inches='tight')
    plt.close()
    print(f"✅ Loss curve saved: {out_path}")

    # ── Plot 2: Learning Rate Schedule ──
    lrs = [h["learning_rate"] for h in history]
    fig2, ax2 = plt.subplots()
    ax2.plot(epochs, lrs, 'g-', linewidth=2)
    ax2.set_xlabel('Epoch')
    ax2.set_ylabel('Learning Rate')
    ax2.set_title('Learning Rate Schedule (Cosine Annealing)')
    ax2.grid(True, alpha=0.3)
    ax2.ticklabel_format(style='scientific', axis='y', scilimits=(0, 0))
    fig2.tight_layout()
    lr_path = RESEARCH_DIR / "learning_rate_schedule.png"
    fig2.savefig(str(lr_path), bbox_inches='tight')
    plt.close()
    print(f"✅ LR schedule saved: {lr_path}")

    # ── Print summary ──
    print(f"\n  Model:  {data.get('model_source', 'N/A')}")
    print(f"  Dataset: {data.get('dataset', 'N/A')}")
    print(f"  Device:  {data.get('device', 'N/A')}")
    print(f"  Params:  {data.get('parameters', 0):,}")
    print(f"  Train:   {data.get('train_samples', 0)} samples")
    print(f"  Val:     {data.get('val_samples', 0)} samples")
    print(f"  Final Train Loss: {data.get('final_train_loss', 'N/A')}")
    print(f"  Best Val Loss:    {data.get('best_val_loss', 'N/A')}")


def plot_comparison(results_path=None):
    """Plot model comparison bar chart from evaluation results."""
    import matplotlib.pyplot as plt
    import numpy as np

    if results_path is None:
        results_path = RESEARCH_DIR / "evaluation_results.json"

    if not results_path.exists():
        print(f"⚠️  No evaluation results found at {results_path}. Run evaluate_model.py first.")
        return

    with open(results_path) as f:
        data = json.load(f)

    methods = []
    precisions = []
    recalls = []
    f1s = []
    colors = []

    for mode, label, color in [
        ("donut_only", "Donut Model\n(Ours)", "#8B5CF6"),
        ("donut_gemini", "Donut + Gemini\n(Ours - Ensemble)", "#10B981"),
        ("gemini_only", "Gemini Only\n(Baseline)", "#F59E0B"),
    ]:
        if mode in data:
            methods.append(label)
            precisions.append(data[mode]["avg_precision"])
            recalls.append(data[mode]["avg_recall"])
            f1s.append(data[mode]["avg_f1"])
            colors.append(color)

    if not methods:
        print("⚠️  No evaluation data to plot")
        return

    x = np.arange(len(methods))
    width = 0.25

    fig, ax = plt.subplots(figsize=(12, 7))
    bars1 = ax.bar(x - width, precisions, width, label='Precision', color=[c + '99' for c in colors], edgecolor=colors, linewidth=2)
    bars2 = ax.bar(x, recalls, width, label='Recall', color=[c + 'CC' for c in colors], edgecolor=colors, linewidth=2)
    bars3 = ax.bar(x + width, f1s, width, label='F1 Score', color=colors, edgecolor=colors, linewidth=2)

    ax.set_ylabel('Score')
    ax.set_title('Model Comparison — Prescription Medication Extraction')
    ax.set_xticks(x)
    ax.set_xticklabels(methods, fontsize=11)
    ax.legend()
    ax.set_ylim(0, 1.1)
    ax.grid(True, axis='y', alpha=0.3)

    # Add value labels on bars
    for bars in [bars1, bars2, bars3]:
        for bar in bars:
            height = bar.get_height()
            ax.annotate(f'{height:.2f}',
                xy=(bar.get_x() + bar.get_width() / 2, height),
                xytext=(0, 3), textcoords="offset points",
                ha='center', va='bottom', fontsize=9)

    fig.tight_layout()
    out_path = RESEARCH_DIR / "model_comparison.png"
    fig.savefig(str(out_path), bbox_inches='tight')
    plt.close()
    print(f"✅ Comparison chart saved: {out_path}")

    # ── Improvement highlight ──
    if "improvement_with_gemini" in data:
        imp = data["improvement_with_gemini"]
        print(f"\n  📈 Gemini Enhancement Impact:")
        print(f"     F1: +{imp['f1_absolute']:.4f} ({imp['f1_relative_pct']:+.1f}%)")
        print(f"     Precision: +{imp['precision_absolute']:.4f}")
        print(f"     Recall: +{imp['recall_absolute']:.4f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Plot research charts")
    parser.add_argument("--history", type=str, default=None, help="Training history JSON path")
    parser.add_argument("--comparison", type=str, default=None, help="Evaluation results JSON path")
    args = parser.parse_args()

    RESEARCH_DIR.mkdir(parents=True, exist_ok=True)

    history_path = Path(args.history) if args.history else RESEARCH_DIR / "training_history.json"
    if history_path.exists():
        plot_loss_curves(history_path)
    else:
        print(f"⚠️  No training history found at {history_path}. Run train_donut.py first.")

    comparison_path = Path(args.comparison) if args.comparison else RESEARCH_DIR / "evaluation_results.json"
    if comparison_path.exists():
        plot_comparison(comparison_path)
    else:
        print(f"ℹ️  No evaluation results yet. Run evaluate_model.py to generate comparison charts.")
