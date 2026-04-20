"""
🎨 Research Paper Visualization Generator — Google Colab

Copy the contents of this file and paste it into a new cell in your Colab notebook!
This script will read your model's history and generate highly professional, 
thesis-ready visualizations detailing every aspect of the fine-tuning process.
"""

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from matplotlib.gridspec import GridSpec

# Ensure seaborn styles are loaded for academic look
sns.set_theme(style="whitegrid", palette="muted")
plt.rcParams.update({
    'font.size': 12,
    'axes.labelsize': 14,
    'axes.titlesize': 16,
    'legend.fontsize': 12,
    'xtick.labelsize': 11,
    'ytick.labelsize': 11,
    'figure.dpi': 300, # High resolution for PDF thesis
})

print("🎨 Generating comprehensive research visualizations...")

# Safely extract the exact number of trained epochs
trained_epochs = len(history["train_loss"])
epochs = list(range(1, trained_epochs + 1))

# Extract metrics
train_loss = history["train_loss"]
val_epochs = [i+1 for i, v in enumerate(history["val_loss"]) if v is not None]
val_loss = [v for v in history["val_loss"] if v is not None]
token_acc = [v*100 for v in history["token_accuracy"] if v is not None]
cer = [v for v in history["cer"] if v is not None]
lr = history["learning_rate"]
time_sec = history["epoch_time"]
vram_gb = [v/1024 for v in history["vram_peak_mb"]]

# Create a massive GridSpec Layout for the thesis
fig = plt.figure(figsize=(22, 16))
gs = GridSpec(3, 2, figure=fig, hspace=0.4, wspace=0.25)

# ---------------------------------------------------------
# 1. Training vs Validation Convergence (Top Left)
# ---------------------------------------------------------
ax1 = fig.add_subplot(gs[0, 0])
ax1.plot(epochs, train_loss, color='#2563EB', linewidth=2.5, label='Training Loss (Smooth)')
if val_loss:
    ax1.plot(val_epochs, val_loss, marker='D', markersize=8, color='#EF4444', linewidth=2, label='Validation Loss')
    # Annotate best val loss
    best_idx = np.argmin(val_loss)
    ax1.annotate(f"Best: {val_loss[best_idx]:.4f}", 
                xy=(val_epochs[best_idx], val_loss[best_idx]),
                xytext=(val_epochs[best_idx], val_loss[best_idx]+max(train_loss)*0.1),
                arrowprops=dict(facecolor='#EF4444', shrink=0.05, width=1.5),
                fontsize=12, fontweight='bold', color='#EF4444')

ax1.set_title("Model Convergence: Loss Trajectory", fontweight='bold')
ax1.set_xlabel("Epochs")
ax1.set_ylabel("Cross Entropy Loss")
ax1.legend(loc="upper right", frameon=True, shadow=True)

# ---------------------------------------------------------
# 2. Token Accuracy & Character Error Rate (Top Right)
# ---------------------------------------------------------
ax2 = fig.add_subplot(gs[0, 1])
if token_acc and cer:
    ax2.plot(val_epochs, token_acc, marker='o', markersize=8, color='#10B981', linewidth=2.5, label='Token Accuracy (%)')
    ax2.set_ylabel("Token Accuracy (%)", color='#10B981', fontweight='bold')
    ax2.tick_params(axis='y', labelcolor='#10B981')
    
    # Create twin axis for CER
    ax2_twin = ax2.twinx()
    ax2_twin.plot(val_epochs, cer, marker='s', markersize=8, color='#F59E0B', linewidth=2.5, linestyle='--', label='CER (Error Rate)')
    ax2_twin.set_ylabel("Character Error Rate", color='#F59E0B', fontweight='bold')
    ax2_twin.tick_params(axis='y', labelcolor='#F59E0B')
    
    ax2.set_title("Performance Metrics Over Validation", fontweight='bold')
    ax2.set_xlabel("Epochs")
    
    # Combine legends
    lines_1, labels_1 = ax2.get_legend_handles_labels()
    lines_2, labels_2 = ax2_twin.get_legend_handles_labels()
    ax2.legend(lines_1 + lines_2, labels_1 + labels_2, loc="center right", frameon=True, shadow=True)

# ---------------------------------------------------------
# 3. Hardware Profiling: VRAM (Middle Left)
# ---------------------------------------------------------
ax3 = fig.add_subplot(gs[1, 0])
ax3.fill_between(epochs, vram_gb, color='#8B5CF6', alpha=0.3)
ax3.plot(epochs, vram_gb, color='#6D28D9', linewidth=2.5, marker='.')
ax3.axhline(y=15.0, color='red', linestyle='--', linewidth=2, label="Tesla T4 Memory Limit (15 GB)")
ax3.set_ylim(0, 16)
ax3.set_title("Hardware Profiling: Peak GPU Memory (VRAM)", fontweight='bold')
ax3.set_xlabel("Epochs")
ax3.set_ylabel("VRAM Usage (Gigabytes)")
ax3.legend(loc="lower right")

# ---------------------------------------------------------
# 4. Temporal Profiling: Epoch Processing Time (Middle Right)
# ---------------------------------------------------------
ax4 = fig.add_subplot(gs[1, 1])
bars = ax4.bar(epochs, time_sec, color='#3B82F6', edgecolor='black', alpha=0.8)
avg_time = np.mean(time_sec)
ax4.axhline(y=avg_time, color='#1D4ED8', linestyle='--', linewidth=2.5, label=f"Average: {avg_time:.0f}s")
ax4.set_title("Temporal Profiling: Training Time per Epoch", fontweight='bold')
ax4.set_xlabel("Epochs")
ax4.set_ylabel("Time (Seconds)")
ax4.legend(loc="upper right")

# ---------------------------------------------------------
# 5. Optimization Dynamics: Learning Rate (Bottom Left)
# ---------------------------------------------------------
ax5 = fig.add_subplot(gs[2, 0])
ax5.plot(epochs, lr, color='#EC4899', linewidth=3)
ax5.fill_between(epochs, lr, color='#F472B6', alpha=0.2)
ax5.ticklabel_format(style='sci', axis='y', scilimits=(0,0))
ax5.set_title("Optimization Dynamics: Cosine Annealing Learning Rate", fontweight='bold')
ax5.set_xlabel("Epochs")
ax5.set_ylabel("Learning Rate")

# ---------------------------------------------------------
# 6. Global Summary Radar Chart (Bottom Right)
# ---------------------------------------------------------
ax6 = fig.add_subplot(gs[2, 1], polar=True)
categories = ['Accuracy', 'Speed (Inv Time)', 'Loss (Inv)', 'Memory Efficiency']
N = len(categories)

# Normalize metrics between 0 and 1 for radar
try:
    max_acc = (max(token_acc) / 100) if token_acc else 0.5
    speed_score = 1 - (avg_time / 3000) # Assuming 3000s is very slow
    loss_score = 1 - (min(train_loss) / max(train_loss))
    mem_score = 1 - (max(vram_gb) / 15.0) # Relative to T4 limit
    
    values = [max_acc, speed_score, loss_score, mem_score]
    values += values[:1] # Close the circle
    
    angles = [n / float(N) * 2 * np.pi for n in range(N)]
    angles += angles[:1]
    
    ax6.plot(angles, values, color='#14B8A6', linewidth=2, linestyle='solid')
    ax6.fill(angles, values, color='#5EEAD4', alpha=0.4)
    
    plt.xticks(angles[:-1], categories, size=12, fontweight='bold')
    ax6.set_ylim(0, 1)
    ax6.set_yticks([]) # Hide radial ticks
    ax6.set_title("Overall Model Efficiency Footprint\n", fontweight='bold', size=16)
except Exception as e:
    ax6.text(0.5, 0.5, f"Insufficient data for radar chart", ha='center', va='center')

# Wrap up and Save
fig.suptitle("Medical Prescription OCR: Comprehensive Donut Model Analysis", fontsize=24, fontweight='bold', y=0.96)

# Save high-res for thesis
save_path = f"/content/thesis_research_graphs.pdf"
save_png = f"/content/thesis_research_graphs.png"
plt.savefig(save_path, format='pdf', bbox_inches='tight')
plt.savefig(save_png, format='png', bbox_inches='tight')
print(f"✅ High-resolution PDF generated at: {save_path}")
print(f"✅ High-resolution PNG generated at: {save_png}")

plt.show()

# Trigger automatic download
from google.colab import files
try:
    files.download(save_path)
    files.download(save_png)
except Exception as e:
    print("Please download manually from the left file pane!")
