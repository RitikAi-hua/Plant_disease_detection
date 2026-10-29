# VerdantScan frontend

Responsive React + Tailwind CSS frontend for the Plant Disease Detection project.

## 1. Requirements

- Node.js 18+ recommended
- Your FastAPI backend running locally
- The exact prediction route and multipart upload field used by your backend

## 2. Install and run

Open PowerShell in this folder:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Vite prints the local frontend URL, usually `http://localhost:5173`.

## 3. Connect your FastAPI backend

Edit `.env` and set the values to match your existing backend:

```dotenv
VITE_API_URL=http://127.0.0.1:8000
VITE_PREDICT_PATH=/predict
VITE_UPLOAD_FIELD=file
```

These are configuration defaults, **not a claim about your backend schema**. Check the FastAPI code or open `http://127.0.0.1:8000/docs` and confirm:

1. The prediction route (for example, `/predict`).
2. Whether it accepts an uploaded image with `UploadFile = File(...)`.
3. The exact multipart field name (for example, `file` or `image`).

Restart Vite after changing `.env`.

### CORS

If the browser reports a CORS error, enable the frontend origin in your FastAPI app. For local Vite development, add this to the FastAPI app file after creating `app = FastAPI()`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Only add this middleware once. For production, replace development origins with your deployed frontend origin.

## 4. Prediction response handling

The frontend does not assume one specific JSON schema. It shows the complete API payload under **View complete API response** and recognizes common class/confidence field names when present. If your API uses different field names or returns confidence as a per-class dictionary/list, edit `normalizePrediction()` in `src/App.jsx` to map the real response.

If no confidence value is returned by the backend, the UI will not fabricate one.

## 5. Build for production

```powershell
npm run build
npm run preview
```

## 6. Notes

- Camera capture uses the browser's file input with `capture="environment"`; support depends on browser/device.
- Image uploads are limited to 15 MB in the UI.
- The remote hero photo and Google Fonts require internet access. The core upload/result interface does not.
