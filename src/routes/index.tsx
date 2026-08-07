import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
  Download,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadAnalysisPdf } from "@/lib/pdf";

const ENDPOINT = "https://ing-nextel-efforts-fires.trycloudflare.com/analyze";
const ALLOWED = ["mp3", "wav", "m4a", "ogg", "aac", "flac", "webm"];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI-анализ звонка — разбор разговоров по критериям" },
      {
        name: "description",
        content:
          "Загрузите аудиозапись звонка или вставьте расшифровку, задайте критерии и получите структурированный AI-анализ с выгрузкой в PDF.",
      },
      { property: "og:title", content: "AI-анализ звонка" },
      {
        property: "og:description",
        content:
          "Аудио или расшифровка, свои критерии оценки и готовый разбор звонка в один клик.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Status = "idle" | "received" | "processing" | "done";

type HistoryItem = {
  id: string;
  title: string;
  createdAt: number;
  analysis: string;
};

function Hint({ tone = "warn", children }: { tone?: "warn" | "error"; children: React.ReactNode }) {
  return (
    <p
      role="status"
      className={`mt-2 flex items-start gap-1.5 text-sm ${
        tone === "error" ? "text-destructive" : "text-warning"
      }`}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [dropHint, setDropHint] = useState<string | null>(null);
  const [runHint, setRunHint] = useState<string | null>(null);
  const [runHintTone, setRunHintTone] = useState<"warn" | "error">("warn");
  const [criteriaHint, setCriteriaHint] = useState<string | null>(null);
  const [pdfHint, setPdfHint] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [criteria, setCriteria] = useState<string[]>([
    "Приветствие",
    "Выявление проблемы",
    "Обработка возражений",
  ]);
  const [newCriterion, setNewCriterion] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const textCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasInput = Boolean(file) || text.trim().length > 0;
  const processing = status === "processing";

  const clearHints = () => {
    setRunHint(null);
    setCriteriaHint(null);
    setPdfHint(null);
  };

  const busyGuard = useCallback(
    (setter: (v: string | null) => void) => {
      if (processing) {
        clearHints();
        setter("Идёт обработка, подождите");
        return true;
      }
      return false;
    },
    [processing],
  );

  const acceptFile = (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED.includes(ext)) {
      setDropHint("Неверный формат, загрузите mp3/wav/m4a/ogg/aac/flac/webm");
      return;
    }
    setDropHint(null);
    setFile(f);
    setText("");
    setStatus("received");
    clearHints();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (busyGuard(setRunHint)) return;
    const f = e.dataTransfer.files?.[0];
    if (f) acceptFile(f);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    if (busyGuard(setRunHint)) return;
    const f = e.clipboardData.files?.[0];
    if (f) {
      e.preventDefault();
      acceptFile(f);
      return;
    }
    const pasted = e.clipboardData.getData("text");
    if (pasted.trim()) {
      e.preventDefault();
      setFile(null);
      setDropHint(null);
      setText(pasted);
      setStatus("received");
      clearHints();
    }
  };

  const clearAll = () => {
    if (busyGuard(setRunHint)) return;
    setFile(null);
    setText("");
    setAnalysis(null);
    setActiveHistoryId(null);
    setDropHint(null);
    setStatus("idle");
    clearHints();
    if (inputRef.current) inputRef.current.value = "";
  };

  const openHistoryItem = (item: HistoryItem) => {
    if (busyGuard(setRunHint)) return;
    setAnalysis(item.analysis);
    setActiveHistoryId(item.id);
    setStatus("done");
    clearHints();
  };

  const addCriterion = () => {
    if (busyGuard(setCriteriaHint)) return;
    const value = newCriterion.trim();
    if (!value) {
      setCriteriaHint("Введите название критерия");
      return;
    }
    setCriteria((prev) => [...prev, value]);
    setNewCriterion("");
    setCriteriaHint(null);
  };

  const removeCriterion = (index: number) => {
    if (busyGuard(setCriteriaHint)) return;
    setCriteria((prev) => prev.filter((_, i) => i !== index));
  };

  const runAnalysis = async () => {
    if (busyGuard(setRunHint)) return;
    clearHints();
    if (!hasInput) {
      setRunHintTone("warn");
      setRunHint("Добавьте файл или вставьте текст");
      return;
    }

    setStatus("processing");
    setAnalysis(null);

    const form = new FormData();
    if (file) {
      // Бэкенд ожидает поле "file" для аудиофайла
      form.append("file", file, file.name);
    } else {
      form.append("text", text);
    }
    form.append("criteria", JSON.stringify(criteria));

    try {
      const res = await fetch(ENDPOINT, { method: "POST", body: form });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.status === "ok") {
        const result = String(data.analysis ?? "");
        setAnalysis(result);
        setStatus("done");
        const title = file ? file.name : `Текстовый анализ #${++textCounter.current}`;
        const item: HistoryItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title,
          createdAt: Date.now(),
          analysis: result,
        };
        setHistory((prev) => [item, ...prev].slice(0, 3));
        setActiveHistoryId(item.id);
        return;
      }

      setStatus("received");
      setRunHintTone("error");
      setRunHint(data?.message || "Не удалось выполнить анализ. Попробуйте ещё раз.");
    } catch {
      setStatus("received");
      setRunHintTone("error");
      setRunHint("Не удалось связаться с сервером анализа. Проверьте соединение.");
    }
  };

  const downloadPdf = async () => {
    if (busyGuard(setPdfHint)) return;
    if (!analysis) {
      setPdfHint("Сначала получите результат анализа");
      return;
    }
    setPdfHint(null);
    await downloadAnalysisPdf(analysis, criteria, file ? file.name : "Вставленный текст");
  };

  const statusBadge = useMemo(() => {
    switch (status) {
      case "received":
        return { label: "Получили", icon: CheckCircle2, cls: "bg-accent text-accent-foreground" };
      case "processing":
        return { label: "Обрабатываю…", icon: Loader2, cls: "bg-warning/15 text-warning" };
      case "done":
        return { label: "Готово", icon: CheckCircle2, cls: "bg-success/15 text-success" };
      default:
        return { label: "Ожидание данных", icon: Sparkles, cls: "bg-muted text-muted-foreground" };
    }
  }, [status]);

  const StatusIcon = statusBadge.icon;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 md:py-14">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary-foreground">
              <Sparkles className="size-3.5" /> AI Quality Control
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              AI-анализ звонка
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Загрузите аудиозапись или вставьте расшифровку, задайте критерии — и получите
              структурированный разбор разговора.
            </p>
          </div>
          <div
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${statusBadge.cls}`}
          >
            <StatusIcon className={`size-4 ${processing ? "animate-spin" : ""}`} />
            {statusBadge.label}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          {/* Left */}
          <section className="panel p-6">
            <h2 className="font-display text-lg font-semibold">Источник</h2>

            <div
              role="button"
              tabIndex={0}
              onClick={() => (processing ? busyGuard(setRunHint) : inputRef.current?.click())}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onPaste={onPaste}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`mt-4 flex aspect-square w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                dragging
                  ? "border-primary bg-primary/5 shadow-lift"
                  : "border-border bg-muted/40 hover:border-primary/60 hover:bg-primary/5"
              }`}
            >
              <div className="gradient-hero mb-4 flex size-14 items-center justify-center rounded-2xl text-primary-foreground">
                <Upload className="size-6" />
              </div>
              <p className="max-w-xs text-base font-semibold">
                Переместите сюда аудиофайл и получите анализ звонка
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Форматы: mp3, wav, m4a, ogg, aac, flac, webm
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Или нажмите, чтобы выбрать файл — либо вставьте текст расшифровки (Ctrl+V)
              </p>

              {(file || text.trim()) && (
                <div className="mt-5 flex max-w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-soft">
                  {file ? (
                    <AudioLines className="size-4 shrink-0 text-primary" aria-label="Аудиофайл" />
                  ) : (
                    <FileText className="size-4 shrink-0 text-success" aria-label="Текст" />
                  )}
                  <span className="truncate font-medium">
                    {file ? file.name : "Вставлен текст"}
                  </span>
                </div>
              )}

              <input
                ref={inputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,.aac,.flac,.webm,audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) acceptFile(f);
                }}
              />
            </div>

            {dropHint && <Hint tone="error">{dropHint}</Hint>}

            {text.trim() && (
              <div className="mt-4 max-h-32 overflow-auto rounded-xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
                {text}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={runAnalysis} size="lg" className="gap-2">
                {processing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Обрабатываю…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> Запустить анализ
                  </>
                )}
              </Button>
              <Button variant="outline" size="lg" onClick={clearAll} className="gap-2">
                <X className="size-4" /> Очистить
              </Button>
            </div>
            {runHint && <Hint tone={runHintTone}>{runHint}</Hint>}
          </section>

          {/* Right */}
          <section className="panel flex flex-col p-6">
            <h2 className="font-display text-lg font-semibold">Критерии</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              По этим пунктам будет оцениваться разговор.
            </p>

            <ul className="mt-4 flex flex-1 flex-col gap-2">
              {criteria.length === 0 && (
                <li className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Список пуст — добавьте критерий
                </li>
              )}
              {criteria.map((c, i) => (
                <li
                  key={`${c}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
                >
                  <span className="truncate">{c}</span>
                  <button
                    type="button"
                    aria-label={`Удалить критерий ${c}`}
                    onClick={() => removeCriterion(i)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-5">
              <label className="text-sm font-medium" htmlFor="new-criterion">
                Новый критерий
              </label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="new-criterion"
                  value={newCriterion}
                  placeholder="Например: Работа с ценой"
                  onChange={(e) => setNewCriterion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCriterion();
                    }
                  }}
                />
                <Button onClick={addCriterion} className="gap-1.5">
                  <Plus className="size-4" /> Добавить
                </Button>
              </div>
              {criteriaHint && <Hint>{criteriaHint}</Hint>}
            </div>
          </section>
        </div>

        {/* Result */}
        <section className="panel mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Результат анализа</h2>
            {status === "done" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
                <CheckCircle2 className="size-3.5" /> Готово
              </span>
            )}
          </div>

          <div className="mt-4 min-h-40 rounded-2xl border border-dashed border-border bg-muted/40 p-6">
            {processing ? (
              <div className="flex h-full min-h-28 flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="size-7 animate-spin text-primary" />
                <p className="font-medium">Обрабатываю…</p>
              </div>
            ) : analysis ? (
              <article className="text-sm leading-relaxed whitespace-pre-wrap">{analysis}</article>
            ) : (
              <p className="flex h-full min-h-28 items-center justify-center text-center text-muted-foreground">
                Загрузите файл или вставьте текст и запустите анализ
              </p>
            )}
          </div>

          <div className="mt-5">
            <Button variant="outline" size="lg" onClick={downloadPdf} className="gap-2">
              <Download className="size-4" /> Скачать PDF
            </Button>
            {pdfHint && <Hint>{pdfHint}</Hint>}
          </div>
        </section>

        {/* History */}
        <section className="panel mt-6 p-6">
          <h2 className="font-display text-lg font-semibold">История анализов</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Последние 3 результата — нажмите на карточку, чтобы открыть её заново.
          </p>

          {history.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Пока нет сохранённых результатов
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 md:grid-cols-3">
              {history.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openHistoryItem(item)}
                    className={`flex h-full w-full flex-col items-start gap-1.5 rounded-2xl border p-4 text-left transition-all hover:shadow-lift ${
                      activeHistoryId === item.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/60"
                    }`}
                  >
                    <span className="flex w-full items-center gap-2">
                      <FileText className="size-4 shrink-0 text-primary" />
                      <span className="truncate text-sm font-semibold">{item.title}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString("ru-RU")}
                    </span>
                    <span className="line-clamp-3 text-xs text-muted-foreground">
                      {item.analysis}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

    </main>
  );
}
