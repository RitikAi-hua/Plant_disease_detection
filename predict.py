
# import json
# from pathlib import Path

# import numpy as np
# import tensorflow as tf
# from PIL import Image
# from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

# BASE_DIR = Path(__file__).resolve().parent

# MODEL_PATH = BASE_DIR / "models" / "mobilenetv2_best.keras"
# CLASS_PATH = BASE_DIR / "class.json"

# # Change this to your actual training image size.
# IMG_SIZE = (224, 224)

# # Choose the preprocessing used during training:
# # "mobilenet" = MobileNetV2 preprocess_input
# # "rescale"   = divide pixel values by 255
# # "none"      = leave pixel values in the 0–255 range
# PREPROCESSING = "mobilenet"


# def load_classes(path):
#     with open(path, "r", encoding="utf-8") as file:
#         data = json.load(file)

#     if isinstance(data, list):
#         return [str(label) for label in data]

#     if isinstance(data, dict):
#         # Supports {"0": "Apple___Scab", ...}
#         # and {"Apple___Scab": 0, ...}
#         if all(str(key).isdigit() for key in data):
#             return [
#                 str(data[key])
#                 for key in sorted(data, key=lambda x: int(x))
#             ]

#         if all(isinstance(value, int) for value in data.values()):
#             return [
#                 label
#                 for label, index in sorted(
#                     data.items(), key=lambda item: item[1]
#                 )
#             ]

#     raise ValueError(
#         "Unsupported class.json format. "
#         "Use a list of class names or a class-to-index mapping."
#     )


# # Load once, not on every request.
# model = tf.keras.models.load_model(MODEL_PATH, compile=False)
# class_names = load_classes(CLASS_PATH)


# def predict_image(image: Image.Image):
#     image = image.convert("RGB")
#     image = image.resize(IMG_SIZE)

#     image_array = np.asarray(image, dtype=np.float32)

#     if PREPROCESSING == "mobilenet":
#         image_array = preprocess_input(image_array)
#     elif PREPROCESSING == "rescale":
#         image_array = image_array / 255.0
#     elif PREPROCESSING != "none":
#         raise ValueError("Invalid PREPROCESSING setting")

#     image_array = np.expand_dims(image_array, axis=0)

#     predictions = model.predict(image_array, verbose=0)
#     scores = np.asarray(predictions)[0].reshape(-1)

#     if len(scores) != len(class_names):
#         raise ValueError(
#             f"Model outputs {len(scores)} classes, "
#             f"but class.json contains {len(class_names)} classes."
#         )

#     predicted_index = int(np.argmax(scores))

#     return {
#         "predicted_disease": class_names[predicted_index],
#         "confidence": round(float(scores[predicted_index]) * 100, 2),
#     }




import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from PIL import Image
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input


# ==========================================
# 1. Project paths
# ==========================================

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"

# Change this to your actual model filename
MODEL_FILENAME = "mobilenetv2_best.keras"

MODEL_PATH = MODEL_DIR / MODEL_FILENAME
CLASS_PATH = BASE_DIR / "class_names.json"


# ==========================================
# 2. Model configuration
# ==========================================

# Must match the image size used during training
IMG_SIZE = (224, 224)

# Choose the preprocessing used during training:
# "mobilenet" -> MobileNetV2 preprocess_input
# "rescale"   -> divide pixel values by 255
# "none"      -> leave pixel values in the 0-255 range
PREPROCESSING = "rescale"


# ==========================================
# 3. Validate file paths
# ==========================================

print("Project directory:", BASE_DIR)
print("Model path:", MODEL_PATH)
print("Model exists:", MODEL_PATH.is_file())
print("Class file:", CLASS_PATH)
print("Class file exists:", CLASS_PATH.is_file())

if not MODEL_PATH.is_file():
    raise FileNotFoundError(
        f"Model not found: {MODEL_PATH}\n"
        "Check the filename and models folder."
    )

if not CLASS_PATH.is_file():
    raise FileNotFoundError(
        f"class_names.json not found: {CLASS_PATH}"
    )


# ==========================================
# 4. Load class names
# ==========================================

def load_classes(path):
    with open(path, "r", encoding="utf-8") as file:
        data = json.load(file)

    # Format: ["Apple___Scab", "Apple___healthy", ...]
    if isinstance(data, list):
        return [str(label) for label in data]

    if isinstance(data, dict):
        # Format: {"0": "Apple___Scab", "1": "Apple___healthy"}
        if all(str(key).isdigit() for key in data):
            return [
                str(data[key])
                for key in sorted(data, key=lambda x: int(x))
            ]

        # Format: {"Apple___Scab": 0, "Apple___healthy": 1}
        if all(
            isinstance(value, int) and not isinstance(value, bool)
            for value in data.values()
        ):
            ordered = sorted(data.items(), key=lambda item: item[1])

            indices = [index for _, index in ordered]
            if indices != list(range(len(indices))):
                raise ValueError(
                    "Class indices must start at 0 and be consecutive."
                )

            return [str(label) for label, _ in ordered]

    raise ValueError(
        "Unsupported class.json format. "
        "Expected a list of class names or a class-to-index mapping."
    )


class_names = load_classes(CLASS_PATH)

if not class_names:
    raise ValueError("class.json contains no classes.")

print("Number of classes:", len(class_names))


# ==========================================
# 5. Load trained model
# ==========================================

model = tf.keras.models.load_model(
    MODEL_PATH,
    compile=False
)

print("Model loaded successfully!")
print("Model input shape:", model.input_shape)
print("Model output shape:", model.output_shape)


# ==========================================
# 6. Image preprocessing
# ==========================================

def preprocess_image(image: Image.Image):
    image = image.convert("RGB")
    image = image.resize(IMG_SIZE)

    image_array = np.asarray(image, dtype=np.float32)

    if PREPROCESSING == "mobilenet":
        image_array = preprocess_input(image_array)

    elif PREPROCESSING == "rescale":
        image_array = image_array / 255.0

    elif PREPROCESSING != "none":
        raise ValueError(
            f"Unknown preprocessing method: {PREPROCESSING}"
        )

    # Shape: (1, height, width, 3)
    image_array = np.expand_dims(image_array, axis=0)

    return image_array


# ==========================================
# 7. Predict plant disease
# ==========================================

def predict_image(image: Image.Image):
    processed_image = preprocess_image(image)

    predictions = model.predict(
        processed_image,
        verbose=0
    )

    scores = np.asarray(predictions)[0].reshape(-1)

    if len(scores) != len(class_names):
        raise ValueError(
            f"Model predicts {len(scores)} outputs, but "
            f"class.json contains {len(class_names)} classes."
        )

    predicted_index = int(np.argmax(scores))
    confidence = float(scores[predicted_index]) * 100

    return {
        "predicted_disease": class_names[predicted_index],
        "confidence": round(confidence, 2)
    }



