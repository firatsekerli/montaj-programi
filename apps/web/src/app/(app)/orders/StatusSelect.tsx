"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { setOrderStatus } from "@/app/actions/orders";

/**
 * Order status is auto-derived from the plan and installs, so it's shown as a
 * read-only badge. The only manual lever is blocking the order out of planning
 * (or releasing it back), via the button.
 */
export function StatusSelect({ orderId, status }: { orderId: string; status: string }) {
  const ts = useTranslations("order.status");
  const t = useTranslations("orders");
  const [pending, startTransition] = useTransition();
  const blocked = status === "blocked";
  const toggle = () =>
    startTransition(() => setOrderStatus(orderId, blocked ? "backlog" : "blocked"));

  return (
    <span className={`status-cell${pending ? " busy" : ""}`}>
      <span className={`status-badge status-${status}`}>{ts(status)}</span>
      <button type="button" className="status-block" disabled={pending} onClick={toggle}>
        {blocked ? t("unblock") : t("block")}
      </button>
    </span>
  );
}
