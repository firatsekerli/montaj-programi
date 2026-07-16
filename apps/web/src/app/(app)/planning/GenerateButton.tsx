"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { clearPlan, generatePlan } from "@/app/actions/planning";

export function GenerateButton({ weekStart, hasPlan }: { weekStart: string; hasPlan: boolean }) {
  const t = useTranslations("planning");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="plan-controls">
      {error && <span className="error">{error}</span>}
      <button className="btn" disabled={pending} onClick={() => run(() => generatePlan(weekStart))}>
        {pending ? t("generating") : hasPlan ? t("regenerate") : t("generate")}
      </button>
      {hasPlan && (
        <button className="btn-ghost" disabled={pending} onClick={() => run(() => clearPlan(weekStart))}>
          {t("clear")}
        </button>
      )}
    </div>
  );
}
