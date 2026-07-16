"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { setOrderStatus } from "@/app/actions/orders";

const STATUSES = ["backlog", "planned", "in_progress", "completed", "blocked"] as const;

export function StatusSelect({ orderId, status }: { orderId: string; status: string }) {
  const ts = useTranslations("order.status");
  const [pending, startTransition] = useTransition();

  return (
    <select
      className="status-select"
      defaultValue={status}
      disabled={pending}
      onChange={(e) => startTransition(() => setOrderStatus(orderId, e.target.value))}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {ts(s)}
        </option>
      ))}
    </select>
  );
}
