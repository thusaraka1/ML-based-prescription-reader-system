"""
Export a CRNN OCR model to ONNX format for browser-based inference.

Architecture: CNN Feature Extractor → Bidirectional LSTM → Linear → CTC Output
Input:  [1, 1, 32, 100] (batch, channels, height=32, width=100) — grayscale
Output: [timesteps, 1, 72] — 72 character classes
"""

import torch
import torch.nn as nn
import os

# Must match the CHARSET in ctcDecoder.ts
NUM_CLASSES = 72  # blank + digits + lower + upper + special chars
INPUT_HEIGHT = 32
INPUT_WIDTH = 100
HIDDEN_SIZE = 256


class CRNN(nn.Module):
    """CRNN: CNN + BiLSTM + CTC for text recognition."""

    def __init__(self, num_classes=NUM_CLASSES, hidden_size=HIDDEN_SIZE):
        super().__init__()

        # CNN feature extractor
        self.cnn = nn.Sequential(
            nn.Conv2d(1, 64, 3, 1, 1), nn.ReLU(), nn.MaxPool2d(2, 2),       # 32x100 → 16x50
            nn.Conv2d(64, 128, 3, 1, 1), nn.ReLU(), nn.MaxPool2d(2, 2),     # 16x50 → 8x25
            nn.Conv2d(128, 256, 3, 1, 1), nn.BatchNorm2d(256), nn.ReLU(),
            nn.Conv2d(256, 256, 3, 1, 1), nn.ReLU(), nn.MaxPool2d((2, 1), (2, 1)),  # 8x25 → 4x25
            nn.Conv2d(256, 512, 3, 1, 1), nn.BatchNorm2d(512), nn.ReLU(),
            nn.Conv2d(512, 512, 3, 1, 1), nn.ReLU(), nn.MaxPool2d((2, 1), (2, 1)),  # 4x25 → 2x25
            nn.Conv2d(512, 512, (2, 1), 1, 0), nn.ReLU(),  # 2x25 → 1x25
        )

        # Bidirectional LSTM
        self.rnn = nn.LSTM(512, hidden_size, num_layers=2, bidirectional=True, batch_first=False)

        # Output layer
        self.fc = nn.Linear(hidden_size * 2, num_classes)

    def forward(self, x):
        # CNN
        conv = self.cnn(x)  # [B, 512, 1, W']

        # Reshape for RNN: [W', B, C]
        b, c, h, w = conv.size()
        conv = conv.squeeze(2)  # [B, 512, W']
        conv = conv.permute(2, 0, 1)  # [W', B, 512]

        # RNN
        rnn_out, _ = self.rnn(conv)  # [W', B, hidden*2]

        # FC
        output = self.fc(rnn_out)  # [W', B, num_classes]

        return output


def main():
    model = CRNN(num_classes=NUM_CLASSES, hidden_size=HIDDEN_SIZE)
    model.eval()

    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    print(f"CRNN Model: {total_params:,} parameters")

    # Dummy input
    dummy_input = torch.randn(1, 1, INPUT_HEIGHT, INPUT_WIDTH)

    # Test forward pass
    with torch.no_grad():
        output = model(dummy_input)
    print(f"Input shape:  {dummy_input.shape}")
    print(f"Output shape: {output.shape}")  # Should be [25, 1, 72]

    # Export to ONNX
    output_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "public", "models", "crnn", "crnn.onnx"
    )
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={
            "input": {0: "batch"},
            "output": {1: "batch"},
        },
        opset_version=13,
    )

    file_size = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\n✅ CRNN model exported to: {output_path}")
    print(f"   File size: {file_size:.1f} MB")


if __name__ == "__main__":
    main()
