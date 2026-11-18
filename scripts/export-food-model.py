"""Export the food photo model to ONNX (int8) for Transformers.js, into public/models/.

Model: dima806/indian_food_image_detection (ViT-base, 80 Indian dishes, Apache-2.0).
Output: public/models/dima806/indian_food_image_detection/{config.json, preprocessor_config.json, onnx/model_quantized.onnx}
Pulse loads this bundled copy first (no download on the phone). Without it, the app downloads the model
from Hugging Face on first use, which only works if that repo already has ONNX files.

Also writes labels.json: compare it with src/data/foodLabels.ts (every label should have an entry).

Usage (needs internet and Python 3.10+; CI runs this in .github/workflows/android.yml):
    pip install --index-url https://download.pytorch.org/whl/cpu torch
    pip install "optimum-onnx[onnxruntime]" transformers pillow
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
    # optimum 2.x moved ONNX export to the optimum-onnx package; its CLI is `optimum-cli export onnx`.
    cli = shutil.which("optimum-cli")
    cmd = [cli, "export", "onnx"] if cli else [sys.executable, "-m", "optimum.exporters.onnx"]
    subprocess.run([*cmd, "--model", MODEL, "--task", "image-classification", str(TMP)], check=True)

    from onnxruntime.quantization import QuantType, quantize_dynamic

    # Build the output next to TMP and move it into place only when complete, so a failed or partial
    # export never leaves files where the app (and the CI cache) would pick them up.
    stage = TMP.parent / "food-model-stage"
    shutil.rmtree(stage, ignore_errors=True)
    (stage / "onnx").mkdir(parents=True)
    # Transformers.js dtype "q8" loads onnx/model_quantized.onnx
    quantize_dynamic(str(TMP / "model.onnx"), str(stage / "onnx" / "model_quantized.onnx"), weight_type=QuantType.QUInt8)
    # Write config.json and preprocessor_config.json from the model itself: optimum-onnx 0.1.0 doesn't
    # put the image processor's config in its output folder (CI run #5 failed on that).
    from transformers import AutoConfig, AutoImageProcessor

    AutoConfig.from_pretrained(MODEL).save_pretrained(stage)
    AutoImageProcessor.from_pretrained(MODEL, use_fast=False).save_pretrained(stage)
    for name in ("config.json", "preprocessor_config.json"):
        if not (stage / name).exists():
            sys.exit(f"{name} was not written; cannot use this export.")

    labels = sorted(json.loads((stage / "config.json").read_text())["id2label"].values())
    (stage / "labels.json").write_text(json.dumps(labels, indent=1))
    size = (stage / "onnx" / "model_quantized.onnx").stat().st_size / 1e6
    if size < 20:
        sys.exit(f"Quantized model is only {size:.1f} MB; expected about 90 MB. Not using it.")
    shutil.rmtree(OUT, ignore_errors=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(stage), str(OUT))
    print(f"Exported {len(labels)} labels, model {size:.0f} MB -> {OUT}")


if __name__ == "__main__":
    main()
