import { getTranslations } from "next-intl/server";
import { dailyCapacity, type ShiftContext, type WorkItemType } from "@montaj/rules";

// Illustrative types — in the real app these come from the tenant's data in
// Supabase. Here they show the engine driving the UI with zero hard-coded logic.
const DEMO_TYPES: Array<{ label: string; type: WorkItemType }> = [
  {
    label: "Yarım/Blok Kasa Tek Kanat Yangın Kapısı",
    type: {
      id: "1",
      code: "YARIM_BLOK_TEK_KANAT",
      capacityModel: "count",
      baseCapacity: { normal: 9, overtime: 12 },
    },
  },
  {
    label: "Tam Kasa Tek Kanat Yangın Kapısı",
    type: {
      id: "2",
      code: "TAM_KASA_TEK_KANAT",
      capacityModel: "count",
      baseCapacity: { normal: 7, overtime: 10 },
    },
  },
  {
    label: "Tam Kasa Çift Kanat Yangın Kapısı",
    type: {
      id: "3",
      code: "TAM_KASA_CIFT_KANAT",
      capacityModel: "count",
      baseCapacity: { normal: 5, overtime: 8 },
    },
  },
];

const normalShift: ShiftContext = { overtime: false, normalShiftHours: 9, overtimeShiftHours: 12 };
const overtimeShift: ShiftContext = { ...normalShift, overtime: true };

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <main>
      <h1>{t("title")}</h1>
      <p className="subtitle">{t("subtitle")}</p>

      <section className="panel">
        <h2>{t("capacityDemoTitle")}</h2>
        <p className="note">{t("capacityDemoNote")}</p>
        <table>
          <thead>
            <tr>
              <th>Kapı Tipi</th>
              <th style={{ textAlign: "end" }}>
                {t("normal")} ({t("perDay")})
              </th>
              <th style={{ textAlign: "end" }}>
                {t("overtime")} ({t("perDay")})
              </th>
            </tr>
          </thead>
          <tbody>
            {DEMO_TYPES.map(({ label, type }) => (
              <tr key={type.id}>
                <td>{label}</td>
                <td className="num">{dailyCapacity(type, normalShift, [])}</td>
                <td className="num">{dailyCapacity(type, overtimeShift, [])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="status">{t("status")}</p>
    </main>
  );
}
