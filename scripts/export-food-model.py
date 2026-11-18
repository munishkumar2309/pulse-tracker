"""Export the food photo model to ONNX (int8) for Transformers.js, into public/models/.

Model: dima806/indian_food_image_detection (ViT-base, 80 Indian dishes, Apache-2.0).
Output: public/models/dima806/indian_food_image_detection/{config.json, preprocessor_config.json, onnx/model_quantized.onnx}
Pulse loads this bundled copy first (no download on the phone). Without it, the app downloads the model
from Hugging Face on first use, which only works if that repo already has ONNX files.

Also writes labels.json: compare it with src/data/foodLabels.ts (every label should have an entry).

Usage (needs internet and Python 3.10+):
    pip install "optimum[onnxruntime]" transformers torch
    npm run export:food-model
"""
import json
import pathlib
import shutil
import subprocess
import sys

MODEL = "dima806/indian_food_image_detection"
OUT = pathlib.Path("public/models") / MODEL
TMP = pathlib.Path("build/food-model-onnx")


def main() -> None:
    shutil.rmtree(TMP, ignore_errors=True)
    subprocess.run([sys.executable, "-m", "optimum.exporters.onnx", "--model", MODEL, "--task", "image-classification", str(TMP)], check=True)

    from onnxruntime.quantization import QuantType, quantize_dynamic

    (OUT / "onnx").mkdir(parents=True, exist_ok=True)
    # Transformers.js dtype "q8" loads onnx/model_quantized.onnx
    quantize_dynamic(str(TMP / "model.onnx"), str(OUT / "onnx" / "model_quantized.onnx"), weight_type=QuantType.QUInt8)
    for name in ("config.json", "preprocessor_config.json"):
        shutil.copy(TMP / name, OUT / name)

    labels = sorted(json.loads((OUT / "config.json").read_text())["id2label"].values())
    (OUT / "labels.json").write_text(json.dumps(labels, indent=1))
    size = (OUT / "onnx" / "model_quantized.onnx").stat().st_size / 1e6
    print(f"Exported {len(labels)} labels, model {size:.0f} MB -> {OUT}")


if __name__ == "__main__":
    main()
