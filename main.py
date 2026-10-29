
# from io import BytesIO

# from fastapi import FastAPI, File, HTTPException, UploadFile
# from fastapi.middleware.cors import CORSMiddleware
# from PIL import Image, UnidentifiedImageError

# from predict import predict_image

# app = FastAPI(title="Plant Disease Detection API")

# # Allow requests from the local React development server.
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[
#         "http://localhost:5173",
#         "http://127.0.0.1:5173",
#     ],
#     allow_credentials=False,
#     allow_methods=["GET", "POST"],
#     allow_headers=["*"],
# )


# @app.get("/")
# def home():
#     return {"message": "Plant Disease Detection API is running"}


# @app.post("/predict")
# async def predict(file: UploadFile = File(...)):
#     if file.content_type not in {
#         "image/jpeg",
#         "image/png",
#         "image/webp",
#     }:
#         raise HTTPException(
#             status_code=400,
#             detail="Please upload a JPG, PNG, or WebP image.",
#         )

#     contents = await file.read()

#     if len(contents) > 10 * 1024 * 1024:
#         raise HTTPException(
#             status_code=413,
#             detail="Image must be smaller than 10 MB.",
#         )

#     try:
#         image = Image.open(BytesIO(contents))
#         image.verify()

#         # Reopen after verify() before processing.
#         image = Image.open(BytesIO(contents))
#         image.load()

#     except (UnidentifiedImageError, OSError, ValueError):
#         raise HTTPException(
#             status_code=400,
#             detail="The uploaded file is not a valid image.",
#         )

#     try:
#         result = predict_image(image)
#         return result

#     except Exception as exc:
#         raise HTTPException(
#             status_code=500,
#             detail=f"Prediction failed: {str(exc)}",
#         ) from exc


from email.mime import image
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
# newly added
from transformers import pipeline
import numpy as np
import tensorflow as tf
from PIL import Image, UnidentifiedImageError
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware


# Configuration


BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models/mobilenetv2_best (2)_ver.keras"
CLASS_PATH = BASE_DIR / "class.json" #new json

IMAGE_SIZE = (224, 224)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

model = None
class_names = []
# newly added code 2 lines
image_validator = None
LEAF_LABEL = "a close-up photograph of a real plant leaf"

#new function---
def validate_leaf_image(image: Image.Image) -> tuple[bool, str, float]:
    candidate_labels = [
        "a close-up photograph of a real plant leaf",
        "a screenshot of a social media profile on a computer screen",
        "a document or page containing text",
        "a photograph of a person",
        "a photograph of an animal",
        "a photograph of an object unrelated to plants",
    ]

    predictions = image_validator(
        image.convert("RGB"),
        candidate_labels=candidate_labels,
    )

    best = predictions[0]
    is_leaf = (
        best["label"] == LEAF_LABEL
        and best["score"] >= 0.40
    )

    return is_leaf, best["label"], float(best["score"])



def load_class_names(path: Path) -> list[str]:
    """Load class names in the model's output-index order."""
    if not path.exists():
        raise FileNotFoundError(
            f"Class mapping not found: {path}. "
            "Copy the class.json used during training."
        )

    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if isinstance(data, list):
        names = data

    elif isinstance(data, dict):
        # Supports {"class name": index}
        # and {"index": "class name"} formats.
        if "class_indices" in data:
            data = data["class_indices"]

        if not isinstance(data, dict):
            raise ValueError("Invalid class_indices format.")

        try:
            if all(
                isinstance(value, int) and not isinstance(value, bool)
                for value in data.values()
            ):
                names = [
                    name
                    for name, index in sorted(
                        data.items(), key=lambda item: item[1]
                    )
                ]
                indices = sorted(data.values())
                if indices != list(range(len(indices))):
                    raise ValueError(
                        "Class indices must start at 0 and be consecutive."
                    )
            elif all(str(key).isdigit() for key in data):
                indexed = {int(key): value for key, value in data.items()}
                if sorted(indexed) != list(range(len(indexed))):
                    raise ValueError("Class indices must start at 0.")
                names = [indexed[i] for i in range(len(indexed))]
            else:
                raise ValueError(
                    "Unsupported class.json format. Use a list or "
                    "a class-to-index/index-to-class mapping."
                )
        except (TypeError, KeyError) as exc:
            raise ValueError("Invalid class mapping.") from exc
    else:
        raise ValueError("class.json must contain a list or object.")

    if not names or not all(isinstance(name, str) for name in names):
        raise ValueError("Class names must be a non-empty list of strings.")

    return names


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model and classes once at server startup."""
    global model, class_names

    if not MODEL_PATH.is_file():
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

    class_names = load_class_names(CLASS_PATH)
    model = tf.keras.models.load_model(MODEL_PATH, compile=False)
    
    #new ----
    global image_validator

    image_validator = pipeline(
    task="zero-shot-image-classification",
    model="openai/clip-vit-base-patch32",
    device=-1,  # CPU
    )
    logger.info("CLIP image validator loaded")
    
    #------------------------
    output_shape = model.output_shape
    output_count = output_shape[-1]

    if output_count != len(class_names):
        raise ValueError(
            f"Model has {output_count} outputs but class.json "
            f"contains {len(class_names)} classes. "
            "Check the original training class mapping."
        )

    logger.info("Model loaded: %s", MODEL_PATH.name)
    logger.info("Input shape: %s", model.input_shape)
    logger.info("Number of classes: %d", len(class_names))

    yield

    model = None
    logger.info("Model shutdown complete.")


app = FastAPI(
    title="VerdantScan Plant Disease API",
    description="Plant disease classification using MobileNetV2.",
    version="1.0.0",
    lifespan=lifespan,
)

# React + Vite development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "VerdantScan Plant Disease API",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health():
    return {
        "status": "ok" if model is not None else "not_ready",
        "model_loaded": model is not None,
        "classes_loaded": len(class_names),
    }


@app.get("/classes")
def get_classes():
    return {"classes": class_names, "total": len(class_names)}


def predict_image(image: Image.Image) -> dict:
    """Prepare an image and run model inference."""
    image = image.convert("RGB").resize(IMAGE_SIZE)

    # The inspected model contains a Rescaling layer that maps
    # [0, 1] to [-1, 1]. Do not normalize to [-1, 1] here.
    image_array = np.asarray(image, dtype=np.float32) / 255.0
    batch = np.expand_dims(image_array, axis=0)

    outputs = model(batch, training=False).numpy()[0]
    probabilities = outputs.astype(float)

    if (
        probabilities.ndim != 1
        or len(probabilities) != len(class_names)
        or not np.all(np.isfinite(probabilities))
    ):
        raise RuntimeError("The model returned invalid predictions.")

    # This endpoint expects a softmax classifier.
    if (
        np.any(probabilities < -1e-5)
        or np.any(probabilities > 1.00001)
        or not np.isclose(np.sum(probabilities), 1.0, atol=1e-3)
    ):
        raise RuntimeError(
            "Model output is not a valid probability distribution."
        )

    best_index = int(np.argmax(probabilities))
    top_indices = np.argsort(probabilities)[::-1][:5]

    return {
        "predicted_class": class_names[best_index],
        "confidence": round(float(probabilities[best_index]) * 100, 2),
        "top_predictions": [
            {
                "class_name": class_names[int(index)],
                "confidence": round(float(probabilities[index]) * 100, 2),
            }
            for index in top_indices
        ],
        "model": "MobileNetV2",
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if model is None:
        raise HTTPException(
            status_code=503, detail="Prediction model is not ready."
        )

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Upload a JPEG, PNG, or WebP image.",
        )

    try:
        contents = await file.read(MAX_FILE_SIZE + 1)

        if not contents:
            raise HTTPException(status_code=400, detail="The file is empty.")

        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Image exceeds the 10 MB limit.",
            )

        def open_image(data: bytes) -> Image.Image:
            import io

            with Image.open(io.BytesIO(data)) as source:
                source.verify()

            with Image.open(io.BytesIO(data)) as source:
                source.load()
                return source.convert("RGB")

        image = await run_in_threadpool(open_image, contents)
        
        

        if image_validator is None:
            raise HTTPException(
            status_code=503,
        detail="Image validation model is not ready.",
    )

        is_leaf, matched_label, score = await run_in_threadpool(
        validate_leaf_image, image
)

        logger.info(
            "CLIP validation: label=%s score=%.3f",
    matched_label,
    score,
)

        if not is_leaf:
                raise HTTPException(
        status_code=400,
        detail=(
            "This image does not appear to show a plant leaf. "
            "Please upload a clear plant leaf image."
        ),
    )



        
        result = await run_in_threadpool(predict_image, image)

        return {
            "success": True,
            "filename": Path(file.filename or "image").name,
            **result,
        }

    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid supported image.",
        )
    except Exception:
        logger.exception("Prediction failed")
        raise HTTPException(
            status_code=500,
            detail="Prediction failed. Check the backend logs.",
        )
    finally:
        await file.close()
