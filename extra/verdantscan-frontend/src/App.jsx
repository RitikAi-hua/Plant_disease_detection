import React from "react";
import { useEffect, useRef, useState } from "react";
import {
  Leaf, Sprout, Camera, Image as ImageIcon, UploadCloud, ScanSearch,
  ShieldCheck, ArrowUpRight, CheckCircle2, AlertCircle, LoaderCircle,
  X, RotateCcw, FileImage, ChevronDown, Menu, Info
} from "lucide-react";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const PREDICT_PATH = import.meta.env.VITE_PREDICT_PATH || "/predict";
const UPLOAD_FIELD = import.meta.env.VITE_UPLOAD_FIELD || "file";

function prettyLabel(value) {
  if (typeof value !== "string") return value;
  return value.replaceAll("_", " ").replaceAll("-", " ").replace(/\s+/g, " ").trim();
}

function findFirst(object, keys) {
  if (!object || typeof object !== "object") return undefined;
  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null && object[key] !== "") return object[key];
  }
  return undefined;
}

// The backend schema has not been provided, so this adapter only recognizes
// common response field names and preserves the full payload for inspection.
function normalizePrediction(payload) {
  const nested = payload?.result && typeof payload.result === "object" ? payload.result
    : payload?.prediction_result && typeof payload.prediction_result === "object" ? payload.prediction_result
    : payload;
  const label = findFirst(nested, [
    "predicted_class", "predicted_disease", "prediction", "class_name",
    "disease", "label", "class", "predicted_label"
  ]);
  let confidence = findFirst(nested, [
    "confidence", "confidence_score", "probability", "prediction_confidence", "score"
  ]);
  if (typeof confidence === "string" && confidence.trim().endsWith("%")) {
    const parsed = Number(confidence.trim().slice(0, -1));
    confidence = Number.isFinite(parsed) ? parsed / 100 : confidence;
  } else if (typeof confidence === "string" && confidence.trim() !== "") {
    const parsed = Number(confidence);
    confidence = Number.isFinite(parsed) ? parsed : confidence;
  }
  if (typeof confidence === "number" && confidence > 1 && confidence <= 100) confidence /= 100;
  return { label, confidence, payload };
}

function isProbablyHealthy(label) {
  return /healthy|normal|no disease/i.test(String(label || ""));
}

function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeNav, setActiveNav] = useState("Home");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [apiState, setApiState] = useState("unknown");
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function selectFile(nextFile) {
    if (!nextFile) return;
    setError("");
    setResult(null);
    if (!nextFile.type.startsWith("image/")) {
      setError("Please choose an image file such as JPG, PNG, or WEBP.");
      return;
    }
    if (nextFile.size > 15 * 1024 * 1024) {
      setError("This image is larger than 15 MB. Please choose a smaller image.");
      return;
    }
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
  }

  function clearImage() {
    setFile(null);
    setPreview("");
    setResult(null);
    setError("");
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  async function runPrediction() {
    if (!file) {
      setError("Upload or capture a clear leaf image first.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      body.append(UPLOAD_FIELD, file);
      const response = await fetch(`${API_URL}${PREDICT_PATH.startsWith("/") ? "" : "/"}${PREDICT_PATH}`, {
        method: "POST",
        body
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : { response_text: await response.text() };

      if (!response.ok) {
        const detail = typeof payload?.detail === "string" ? payload.detail : JSON.stringify(payload);
        throw new Error(`API returned ${response.status}${detail ? `: ${detail}` : ""}`);
      }
      setResult(normalizePrediction(payload));
      setApiState("connected");
    } catch (err) {
      setApiState("error");
      setError(
        `Could not complete the prediction. ${err.message || "Please check the API connection."} ` +
        `Confirm that FastAPI is running at ${API_URL}, the route is ${PREDICT_PATH}, ` +
        `and the upload field is "${UPLOAD_FIELD}".`
      );
    } finally {
      setLoading(false);
    }
  }

  const confidenceValue = typeof result?.confidence === "number" && Number.isFinite(result.confidence)
    ? Math.max(0, Math.min(100, result.confidence <= 1 ? result.confidence * 100 : result.confidence))
    : null;
  const label = result?.label;
  const isHealthy = isProbablyHealthy(label);

  return (
    <div className="min-h-screen bg-cream text-forest">
      <div className="grain pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
      <header className="relative z-20 mx-auto flex w-full max-w-[1600px] items-center justify-between px-5 py-5 sm:px-8 lg:px-20">
        <a href="#home" className="flex items-center gap-3" aria-label="VerdantScan home" onClick={() => setActiveNav("Home")}>
          <span className="organic-mark flex h-11 w-11 items-center justify-center bg-leaf text-white shadow-sm">
            <Leaf size={23} strokeWidth={1.8} />
          </span>
          <span className="font-serif text-[1.8rem] font-bold tracking-tight">VerdantScan</span>
        </a>

        <nav className="hidden items-center gap-9 md:flex" aria-label="Main navigation">
          {["Home", "How it works", "About"].map((item) => (
            <a key={item} href={item === "Home" ? "#home" : item === "How it works" ? "#how-it-works" : "#about"}
              onClick={() => setActiveNav(item)}
              className={`text-sm font-semibold transition-colors hover:text-leaf ${activeNav === item ? "text-forest" : "text-forest/55"}`}>
              {item}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-xs font-semibold text-muted sm:flex">
            <span className={`h-2 w-2 rounded-full ${apiState === "connected" ? "bg-leaf" : apiState === "error" ? "bg-red-500" : "bg-gold"}`} />
            {apiState === "connected" ? "API connected" : apiState === "error" ? "Check API" : "Ready to scan"}
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D4CFC3] bg-[#E5E1D8] transition hover:bg-pale md:hidden"
            onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle navigation">
            <Menu size={19} />
          </button>
          <a href="#scanner" className="hidden rounded-full bg-leaf px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3E5635] sm:inline-flex">
            Start a scan <ArrowUpRight size={16} className="ml-2" />
          </a>
        </div>
      </header>

      {mobileMenu && (
        <nav className="relative z-20 mx-5 mb-4 flex flex-col gap-1 rounded-2xl border border-line bg-white p-3 shadow-soft md:hidden">
          {[["Home", "#home"], ["How it works", "#how-it-works"], ["About", "#about"], ["Start a scan", "#scanner"]].map(([text, href]) => (
            <a key={text} href={href} onClick={() => { setActiveNav(text); setMobileMenu(false); }}
              className="rounded-xl px-4 py-3 text-sm font-semibold hover:bg-pale">{text}</a>
          ))}
        </nav>
      )}

      <main id="home" className="relative z-10 mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-20">
        <section className="grid items-center gap-10 pb-16 pt-8 md:pb-24 md:pt-12 lg:grid-cols-[1.04fr_.96fr] lg:gap-16 lg:pb-28">
          <div className="animate-rise">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#DCE4D5] bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-leaf">
              <Sprout size={15} /> Plant health, made clearer
            </div>
            <h1 className="max-w-3xl font-serif text-[3.4rem] font-bold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-[5.1rem]">
              A little leaf
              <br />can tell you <span className="italic text-leaf">a lot.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-muted sm:text-lg">
              Give your plant a closer look. Upload a leaf photo and let our trained model help screen for possible disease patterns.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#scanner" className="inline-flex items-center rounded-full bg-leaf px-6 py-4 text-sm font-bold text-white shadow-[0_12px_24px_rgba(79,109,68,0.22)] transition hover:-translate-y-0.5 hover:bg-[#3E5635]">
                Scan a leaf <ArrowUpRight size={17} className="ml-2" />
              </a>
              <a href="#how-it-works" className="inline-flex items-center rounded-full border border-line bg-white/70 px-6 py-4 text-sm font-bold transition hover:bg-white">
                How it works <ChevronDown size={16} className="ml-2" />
              </a>
            </div>
            <div className="mt-9 flex flex-wrap gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2.5 shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F0FAF0] text-leaf"><ShieldCheck size={19} /></span>
                <span className="text-sm font-semibold">Model-powered screening</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2.5 shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FBF2E4] text-gold"><CheckCircle2 size={19} /></span>
                <span className="text-sm font-semibold">Simple, clear results</span>
              </div>
            </div>
            <p className="mt-4 max-w-lg text-xs leading-5 text-muted">
              Results are model predictions, not a professional diagnosis. Image quality and the plant species can affect accuracy.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[600px] lg:ml-auto">
            <div className="absolute -right-3 top-4 h-28 w-28 rounded-full bg-[#E8EEDF] blur-2xl sm:-right-7 sm:h-40 sm:w-40" />
            <div className="absolute -bottom-5 -left-5 h-36 w-36 rounded-full bg-[#F1E6D2] blur-2xl" />
            <div className="relative overflow-hidden rounded-[40px] border border-white/80 bg-[#E8EEDF] p-3 shadow-soft sm:p-5">
              <div className="hero-art relative min-h-[370px] overflow-hidden rounded-[32px] sm:min-h-[490px]">
                <img
                  src="https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=85"
                  alt="Lush green leaves in natural light"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1E2A1C]/70 via-transparent to-[#1E2A1C]/10" />
                <div className="absolute left-5 top-5 rounded-full border border-white/50 bg-white/85 px-4 py-2 text-xs font-bold text-forest backdrop-blur-md sm:left-7 sm:top-7">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-leaf" /> Your plant care companion
                </div>
                <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-3 sm:bottom-7 sm:left-7 sm:right-7">
                  <div className="max-w-xs text-white">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-white/75">Observe · Understand · Act</p>
                    <h2 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">Better care starts with a closer look.</h2>
                  </div>
                  <span className="mb-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-leaf shadow-lg"><Leaf size={22} /></span>
                </div>
              </div>
            </div>
            <div className="float-card absolute -bottom-6 left-0 flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-soft sm:-left-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-pale text-leaf"><ScanSearch size={22} /></span>
              <div>
                <p className="text-sm font-bold">Leaf image analysis</p>
                <p className="mt-1 text-xs text-muted">Upload a clear, well-lit photo</p>
              </div>
            </div>
          </div>
        </section>

        <section id="scanner" className="scroll-mt-8 pb-20 md:pb-28">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-leaf">The leaf lab</p>
              <h2 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl">Let’s take a look.</h2>
              <p className="mt-3 max-w-xl leading-7 text-muted">Choose a leaf photo to begin. For best results, keep the leaf in focus and use natural, even lighting.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-pale text-leaf"><ShieldCheck size={16} /></span> Your image is sent to your configured API for analysis.</div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.03fr_.97fr]">
            <div className="rounded-[32px] border border-line bg-white p-4 shadow-soft sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-2xl font-bold">Your leaf image</h3>
                  <p className="mt-1 text-sm text-muted">JPG, PNG or WEBP · up to 15 MB</p>
                </div>
                {file && <button onClick={clearImage} className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold text-muted transition hover:bg-[#F4F1EA] hover:text-forest"><X size={14} /> Clear</button>}
              </div>

              <div
                className={`upload-zone organic-border relative flex min-h-[320px] flex-col items-center justify-center overflow-hidden border-2 border-dashed transition-all duration-300 sm:min-h-[390px] ${preview ? "border-[#B0BBA9] bg-[#F4F1EA]" : "border-[#B0BBA9] bg-[#F4F1EA] hover:border-leaf hover:bg-[#F0FAF0]"}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files?.[0]); }}
              >
                {preview ? (
                  <>
                    <img src={preview} alt="Selected plant leaf preview" className="absolute inset-0 h-full w-full object-contain p-3" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/90 p-3 backdrop-blur-md">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileImage size={18} className="shrink-0 text-leaf" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{file?.name}</p>
                          <p className="text-xs text-muted">{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : ""}</p>
                        </div>
                      </div>
                      <button onClick={() => galleryRef.current?.click()} className="shrink-0 rounded-full border border-line bg-white px-3 py-2 text-xs font-bold hover:bg-pale">Change</button>
                    </div>
                  </>
                ) : (
                  <button type="button" onClick={() => galleryRef.current?.click()} className="group flex w-full flex-col items-center justify-center px-5 py-10 text-center">
                    <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] bg-white text-leaf shadow-sm transition duration-500 group-hover:scale-110"><UploadCloud size={34} strokeWidth={1.6} /></span>
                    <span className="font-serif text-2xl font-bold">Capture or upload</span>
                    <span className="mt-2 max-w-xs text-sm leading-6 text-muted">Drop your image here or click to browse your files.</span>
                    <span className="mt-5 rounded-full border border-[#D6DFD0] bg-white px-4 py-2 text-xs font-bold text-leaf">Choose an image</span>
                  </button>
                )}
              </div>
              
              

              <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => selectFile(e.target.files?.[0])} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => selectFile(e.target.files?.[0])} /> 

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button onClick={() => cameraRef.current?.click()} className="flex min-h-[62px] items-center justify-center gap-3 rounded-2xl bg-leaf px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#3E5635] active:scale-[.99]">
                  <Camera size={20} /> Open camera
                </button>
                <button onClick={() => galleryRef.current?.click()} className="flex min-h-[62px] items-center justify-center gap-3 rounded-2xl border border-line bg-[#F4F1EA] px-4 py-3 text-sm font-bold text-forest transition hover:bg-[#E5E1D8] active:scale-[.99]">
                  <ImageIcon size={20} /> From gallery
                </button>
              </div>
              <button onClick={runPrediction} disabled={!file || loading} className="mt-3 flex min-h-[62px] w-full items-center justify-center gap-3 rounded-2xl bg-forest px-5 py-4 text-sm font-bold text-white transition hover:bg-[#202B1B] disabled:cursor-not-allowed disabled:opacity-45">
                {loading ? <><LoaderCircle className="animate-spin" size={20} /> Analyzing image…</> : <><ScanSearch size={20} /> Analyze leaf <ArrowUpRight size={17} /></>}
              </button>
              {error && <div role="alert" className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"><AlertCircle size={19} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
            </div>

            <div className="flex flex-col rounded-[32px] border border-line bg-white p-4 shadow-soft sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-2xl font-bold">Scan results</h3>
                  <p className="mt-1 text-sm text-muted">Your model response appears here.</p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pale text-leaf"><Sprout size={22} /></span>
              </div>

              {!result && !loading && (
                <div className="flex flex-1 flex-col items-center justify-center rounded-[26px] border border-dashed border-line bg-[#FBFAF7] px-6 py-12 text-center">
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-pale text-leaf"><ScanSearch size={34} strokeWidth={1.5} /></div>
                  <h4 className="font-serif text-2xl font-bold">Waiting for your leaf</h4>
                  <p className="mt-3 max-w-xs text-sm leading-6 text-muted">Once you analyze an image, the predicted class and confidence score returned by your API will appear here.</p>
                  <div className="mt-7 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-muted"><span className="h-2 w-2 rounded-full bg-gold" /> No prediction yet</div>
                </div>
              )}

              {loading && (
                <div className="flex flex-1 flex-col items-center justify-center rounded-[26px] bg-[#FBFAF7] px-6 py-12 text-center">
                  <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-pale text-leaf">
                    <Leaf size={38} className="animate-pulse" />
                    <span className="absolute inset-0 animate-ping rounded-full border border-[#B0BBA9] opacity-40" />
                  </div>
                  <h4 className="font-serif text-2xl font-bold">Taking a closer look…</h4>
                  <p className="mt-3 text-sm text-muted">Sending your image to the prediction API.</p>
                </div>
              )}

              {result && (
                <div className="flex flex-1 flex-col gap-4">
                  {label !== undefined ? (
                    <div className={`rounded-[26px] p-5 sm:p-6 ${isHealthy ? "bg-[#F0F7EB]" : "bg-[#FBF2E4]"}`}>
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                        <span className={`h-2 w-2 rounded-full ${isHealthy ? "bg-leaf" : "bg-gold"}`} />
                        Predicted class
                      </div>
                      <h4 className="mt-3 break-words font-serif text-3xl font-bold leading-tight sm:text-4xl">{prettyLabel(String(label))}</h4>
                      <p className="mt-3 text-sm leading-6 text-muted">
                        {isHealthy
                          ? "The model labeled this image as healthy. Continue monitoring the plant as it grows."
                          : "This is the class predicted by your model. Check the plant carefully and compare with trusted local guidance."}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[#E8D7B6] bg-[#FBF2E4] p-4 text-sm leading-6 text-forest">
                      The API responded successfully, but the frontend could not identify a prediction field automatically. Review the raw response below and configure the response adapter in <code>src/App.jsx</code>.
                    </div>
                  )}

                  <div className="rounded-2xl border border-line p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">Confidence score</p>
                        <p className="mt-1 text-xs leading-5 text-muted">Shown only when a numeric confidence field is returned by the API.</p>
                      </div>
                      {confidenceValue !== null && <span className="font-serif text-3xl font-bold text-leaf">{confidenceValue.toFixed(1)}%</span>}
                    </div>
                    {confidenceValue !== null ? (
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EAE8E0]">
                        <div className="h-full rounded-full bg-leaf transition-all duration-700" style={{ width: `${confidenceValue}%` }} />
                      </div>
                    ) : <p className="mt-3 rounded-xl bg-[#FBFAF7] p-3 text-sm text-muted">No recognizable numeric confidence value was found in the response.</p>}
                  </div>

                  <details className="group rounded-2xl border border-line bg-[#FBFAF7]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-bold">
                      View complete API response <ChevronDown size={17} className="transition group-open:rotate-180" />
                    </summary>
                    <pre className="max-h-64 overflow-auto border-t border-line p-4 text-xs leading-5 text-muted">{JSON.stringify(result.payload, null, 2)}</pre>
                  </details>
                  <div className="mt-auto flex items-start gap-3 rounded-2xl bg-[#F4F1EA] p-4 text-xs leading-5 text-muted">
                    <Info size={17} className="mt-0.5 shrink-0 text-leaf" />
                    A prediction is a screening aid, not a definitive diagnosis. Confirm uncertain cases with an agricultural expert before treating a plant.
                  </div>
                  <button onClick={clearImage} className="flex items-center justify-center gap-2 rounded-full border border-line px-5 py-3 text-sm font-bold transition hover:bg-pale"><RotateCcw size={16} /> Scan another leaf</button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-8 pb-20 md:pb-28">
          <div className="mb-9 max-w-2xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-leaf">A simple process</p>
            <h2 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl">From leaf to insight.</h2>
            <p className="mt-4 leading-7 text-muted">A clear photo gives your model the best chance to return a useful prediction.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { n: "01", icon: Camera, title: "Capture a clear image", text: "Choose a focused photo of the affected leaf in even, natural light." },
              { n: "02", icon: ScanSearch, title: "Run the model", text: "VerdantScan sends the image to your configured FastAPI prediction endpoint." },
              { n: "03", icon: Sprout, title: "Review the result", text: "Read the returned class and confidence, then verify any concerning symptoms." }
            ].map(({ n, icon: Icon, title, text }) => (
              <article key={n} className="rounded-[28px] border border-line bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-soft sm:p-8">
                <div className="mb-8 flex items-center justify-between"><span className="font-serif text-4xl font-bold text-[#C8D3C1]">{n}</span><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pale text-leaf"><Icon size={22} /></span></div>
                <h3 className="font-serif text-2xl font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="pb-20 md:pb-28">
          <div className="relative overflow-hidden rounded-[36px] bg-[#2D3A26] px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-16">
            <div className="absolute -right-14 -top-20 h-64 w-64 rounded-full border border-white/10" />
            <div className="absolute -right-2 -top-8 h-44 w-44 rounded-full border border-white/10" />
            <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
              <div className="max-w-2xl">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#C8D8BD]">Thoughtful plant care</p>
                <h2 className="font-serif text-4xl font-bold leading-tight sm:text-5xl">Small observations can make a meaningful difference.</h2>
                <p className="mt-4 max-w-xl leading-7 text-white/70">Use model output as one helpful signal alongside careful observation, reliable plant-care information, and expert advice when needed.</p>
              </div>
              <a href="#scanner" className="inline-flex w-fit items-center rounded-full bg-white px-6 py-4 text-sm font-bold text-forest transition hover:bg-pale">Try a scan <ArrowUpRight size={17} className="ml-2" /></a>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-line bg-white/60 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col items-center justify-between gap-5 px-5 py-8 sm:px-8 md:flex-row lg:px-20">
          <a href="#home" className="flex items-center gap-2.5">
            <span className="organic-mark flex h-9 w-9 items-center justify-center bg-leaf text-white"><Leaf size={19} /></span>
            <span className="font-serif text-xl font-bold">VerdantScan</span>
          </a>
          <p className="text-center text-xs text-muted">© {new Date().getFullYear()} VerdantScan Labs. All nature preserved.</p>
          <div className="flex flex-wrap justify-center gap-5 text-xs font-semibold text-muted">
            <a href="#about" className="transition hover:text-leaf">About</a>
            <a href="#how-it-works" className="transition hover:text-leaf">How it works</a>
            <a href="mailto:support@example.com" className="transition hover:text-leaf">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

