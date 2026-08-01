import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ENDPOINT = "https://basement-existence-reach-antiques.trycloudflare.com/analyze";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Анализ диалогов — AI-разбор звонков" },
      {
        name: "description",
        content:
          "Загрузите аудиофайл или вставьте текст диалога, укажите критерии оценки и получите AI-анализ разговора.",
      },
      { property: "og:title", content: "Анализ диалогов" },
      {
        property: "og:description",
        content: "Аудио или текст диалога, свои критерии оценки и готовый разбор разговора.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [mode, setMode] = useState<"audio" | "text">("audio");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [criteria, setCriteria] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFile(null);
    setText("");
    setCriteria("");
    setResult("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const analyze = async () => {
    if (loading) return;
    if (mode === "audio" && !file) {
      setResult("⚠️ Выберите аудиофайл");
      return;
    }
    if (mode === "text" && !text.trim()) {
      setResult("⚠️ Введите текст диалога");
      return;
    }

    setLoading(true);
    setResult("⏳ Обрабатываю…");

    const form = new FormData();
    if (mode === "audio" && file) form.append("file", file);
    else form.append("text", text);

    const list = criteria
      .split(/[;\n]/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (list.length) form.append("criteria", JSON.stringify(list));

    try {
      const res = await fetch(ENDPOINT, { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (res.ok && (data?.status === "ok" || data?.analysis)) {
        setResult(String(data.analysis ?? ""));
      } else {
        setResult(`❌ ${data?.message || "Не удалось выполнить анализ. Попробуйте ещё раз."}`);
      }
    } catch {
      setResult("❌ Не удалось связаться с сервером анализа. Проверьте соединение.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/40 py-10">
      <div className="mx-auto w-full max-w-3xl px-5">
        <div className="rounded-xl border border-border bg-card p-8 shadow-soft">
          <h1 className="font-display text-2xl font-bold">🎙️ Анализ диалогов</h1>

          <div className="mt-5 flex gap-6 rounded-lg bg-muted p-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="radio"
                name="mode"
                checked={mode === "audio"}
                onChange={() => setMode("audio")}
              />
              🎵 Аудиофайл
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="radio"
                name="mode"
                checked={mode === "text"}
                onChange={() => setMode("text")}
              />
              📝 Текст
            </label>
          </div>

          {mode === "audio" ? (
            <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4">
              <input
                ref={inputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,.aac,.flac,.webm,audio/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full cursor-pointer rounded-lg border-2 border-dashed border-border p-3 text-sm"
              />
              {file && (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
                  <span className="text-2xl">🎵</span>
                  <span className="flex-1 truncate font-semibold">{file.name}</span>
                  <span className="rounded-full bg-success px-3 py-1 text-xs font-medium text-success-foreground">
                    Аудио
                  </span>
                </div>
              )}
              <small className="mt-2 block text-muted-foreground">
                Поддерживаются: MP3, WAV, M4A, OGG, AAC, FLAC, WEBM
              </small>
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Введите текст диалога для анализа..."
                className="min-h-[150px] w-full resize-y rounded-lg border border-border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
                <span className="text-2xl">📝</span>
                <span className="flex-1 font-semibold">Вставленный текст</span>
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Текст
                </span>
              </div>
            </div>
          )}

          <div className="mt-5">
            <label htmlFor="criteria" className="mb-2 block text-sm font-semibold">
              📋 Критерии оценки (опционально):
            </label>
            <Input
              id="criteria"
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              placeholder="Например: активное слушание; выявление потребностей; работа с возражениями"
            />
            <small className="mt-1 block text-muted-foreground">
              Разделяйте критерии точкой с запятой (;) или новой строкой
            </small>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={analyze} disabled={loading}>
              🔍 {loading ? "Анализирую…" : "Анализировать"}
            </Button>
            <Button size="lg" variant="destructive" onClick={resetForm} disabled={loading}>
              🔄 Очистить
            </Button>
          </div>

          <div className="mt-6 min-h-14 rounded-lg border-l-4 border-primary bg-muted/50 p-5 text-sm leading-relaxed whitespace-pre-wrap">
            {result}
          </div>
        </div>
      </div>
    </main>
  );
}
