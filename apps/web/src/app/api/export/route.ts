import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/rel";

/**
 * Excel export of completed installs in a date range: which order was installed
 * on which day, by whom. One row per completed assignment (a team-day-order-line
 * install record). Not CSV — a real .xlsx workbook.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const iso = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const from = iso(searchParams.get("from"));
  const to = iso(searchParams.get("to"));

  const supabase = await createSupabaseServerClient();

  // Full select embeds customer_* (0025). Fall back if that migration is behind.
  const witSel = "order_line:order_line_id(work_item_type:work_item_type_id(name))";
  const full =
    `assign_date, units, installer_ids, team:team_id(name), ${witSel}, ` +
    "work_order:order_id(code, district, customer_name, customer_surname, customer_phone)";
  const lean = `assign_date, units, installer_ids, team:team_id(name), ${witSel}, work_order:order_id(code, district)`;

  const run = (sel: string) => {
    let q = supabase.from("assignment").select(sel).eq("status", "completed");
    if (from) q = q.gte("assign_date", from);
    if (to) q = q.lte("assign_date", to);
    return q.order("assign_date", { ascending: true });
  };

  let rows = (await run(full)).data as Array<Record<string, unknown>> | null;
  if (!rows) rows = (await run(lean)).data as Array<Record<string, unknown>> | null;
  rows = rows ?? [];

  // Resolve installer person names (empty installer_ids ⇒ the assigned team).
  const ids = new Set<string>();
  for (const r of rows) for (const id of (r.installer_ids as string[] | null) ?? []) ids.add(id);
  const nameById = new Map<string, string>();
  if (ids.size) {
    const { data: ppl } = await supabase.from("person").select("id, name").in("id", [...ids]);
    for (const p of (ppl ?? []) as Array<{ id: string; name: string }>) nameById.set(p.id, p.name);
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Montaj");
  ws.columns = [
    { header: "Tarih", key: "date", width: 12 },
    { header: "Sipariş No", key: "code", width: 16 },
    { header: "Müşteri", key: "customer", width: 22 },
    { header: "Telefon", key: "phone", width: 15 },
    { header: "İlçe", key: "district", width: 14 },
    { header: "Kapı Tipi", key: "type", width: 20 },
    { header: "Adet", key: "units", width: 8 },
    { header: "Ekip", key: "team", width: 16 },
    { header: "Takanlar", key: "installers", width: 28 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFF6B00" },
  };
  ws.getRow(1).alignment = { vertical: "middle" };

  for (const r of rows) {
    const wo = one<{
      code: string;
      district: string | null;
      customer_name?: string | null;
      customer_surname?: string | null;
      customer_phone?: string | null;
    }>(r.work_order);
    const wit = one<{ name: string }>(one<{ work_item_type: unknown }>(r.order_line)?.work_item_type);
    const team = one<{ name: string }>(r.team);
    const installerIds = ((r.installer_ids as string[] | null) ?? []).filter(Boolean);
    const installerNames = installerIds.map((id) => nameById.get(id) ?? "—");
    const customer = [wo?.customer_name, wo?.customer_surname].filter(Boolean).join(" ");

    ws.addRow({
      date: r.assign_date,
      code: wo?.code ?? "",
      customer,
      phone: wo?.customer_phone ?? "",
      district: wo?.district ?? "",
      type: wit?.name ?? "",
      units: Number(r.units),
      team: team?.name ?? "",
      // Empty installer list ⇒ the assigned team did the install.
      installers: installerNames.length ? installerNames.join(", ") : "Ekip",
    });
  }

  ws.autoFilter = { from: "A1", to: "I1" };

  const buf = await wb.xlsx.writeBuffer();
  const label = from && to ? `${from}_${to}` : from ? `${from}` : to ? `${to}` : "tumu";
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="montaj-${label}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
