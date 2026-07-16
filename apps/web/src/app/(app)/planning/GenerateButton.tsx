"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { clearPlan, generatePlan } from "@/app/actions/planning";

export function GenerateButton({ weekStart, hasPlan }: { weekStart: string; hasPlan: boolean }) {
  const t = useTranslations("planning");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="plan-controls">
      <button
        className="btn"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await generatePlan(weekStart);
            router.refresh();
          })
        }
      >
        {pending ? t("generating") : hasPlan ? t("regenerate") : t("generate")}
      </button>
      {hasPlan && (
        <button
          className="btn-ghost"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await clearPlan(weekStart);
              router.refresh();
            })
          }
        >
          {t("clear")}
        </button>
      )}
    </div>
  );
}
