import { notFound } from "next/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addLeave, deleteLeave, updatePerson } from "@/app/actions/people";
import { PersonForm } from "../PersonForm";

export default async function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("people");
  const tc = await getTranslations("crud");
  const format = await getFormatter();
  const supabase = await createSupabaseServerClient();
  const [{ data: row }, { data: leaves }] = await Promise.all([
    supabase.from("person").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("availability")
      .select("id, date_from, date_to, kind")
      .eq("person_id", id)
      .order("date_from"),
  ]);
  if (!row) notFound();

  return (
    <main>
      <h1>{t("editTitle")}</h1>
      <p className="subtitle">{row.name}</p>
      <PersonForm
        action={updatePerson.bind(null, id)}
        submitLabel={tc("save")}
        defaults={{ name: row.name, isLead: row.is_lead }}
      />

      <div className="panel">
        <h2>{t("leave")}</h2>
        <p className="note">{t("leaveHelp")}</p>
        <table>
          <thead>
            <tr>
              <th>{t("leaveFrom")}</th>
              <th>{t("leaveTo")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(leaves ?? []).map((l) => (
              <tr key={l.id}>
                <td>{format.dateTime(new Date(`${l.date_from}T00:00:00`), { dateStyle: "medium" })}</td>
                <td>{format.dateTime(new Date(`${l.date_to}T00:00:00`), { dateStyle: "medium" })}</td>
                <td className="row-actions">
                  <form action={deleteLeave.bind(null, l.id, id)}>
                    <button type="submit" className="link-danger">
                      {tc("delete")}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(!leaves || leaves.length === 0) && (
              <tr>
                <td colSpan={3} className="empty">
                  {t("noLeave")}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form action={addLeave.bind(null, id)} className="form" style={{ marginTop: "1rem" }}>
          <div className="row-2">
            <label>
              {t("leaveFrom")}
              <input name="date_from" type="date" required />
            </label>
            <label>
              {t("leaveTo")}
              <input name="date_to" type="date" />
            </label>
          </div>
          <button type="submit" className="btn-ghost" style={{ alignSelf: "flex-start" }}>
            + {t("addLeave")}
          </button>
        </form>
      </div>
    </main>
  );
}
