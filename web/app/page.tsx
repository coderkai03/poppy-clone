import Link from "next/link";

const STEPS = [
  {
    title: "Paste a link",
    body: "Drop a YouTube, TikTok or Instagram URL into the canvas toolbar.",
  },
  {
    title: "Get a transcript",
    body: "The local engine uses native captions when they exist, and falls back to Whisper when they don't.",
  },
  {
    title: "Synthesise",
    body: "Click Chat on a transcript (or drag an edge) and stream markdown notes from the local model.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-12 px-6 py-20">
      <div className="flex max-w-2xl flex-col items-center gap-5 text-center">
        <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
          Local ingestion · free models
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Video in, structured notes out.
        </h1>
        <p className="text-balance text-lg text-muted">
          A canvas-based multimodal workspace. Transcription runs on your own
          machine, synthesis runs on free models, and nothing costs anything.
        </p>
        <Link
          href="/canvas"
          className="mt-2 rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition-opacity hover:opacity-90"
        >
          Open the canvas
        </Link>
      </div>

      <ol className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <span className="text-xs font-medium text-accent">
              0{index + 1}
            </span>
            <h2 className="mt-2 font-medium">{step.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </main>
  );
}
