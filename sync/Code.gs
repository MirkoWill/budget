// Budget – gemeinsamer Speicher in dieser Google-Tabelle.
// Einrichtung: Tabelle → Erweiterungen → Apps Script → diesen Code einfügen → Bereitstellen als Web-App
// (Ausführen als: ich, Zugriff: jeder). Die App sendet beim Verbinden einen geheimen Schlüssel;
// der erste Schlüssel wird gespeichert, danach antwortet das Skript nur noch mit diesem Schlüssel.
const SHEET = "Ausgaben";
const HEAD = ["ID", "Datum", "Betrag (€)", "Kategorie", "Notiz", "Von", "geändert", "gelöscht"];

function doGet() {
  return ContentService.createTextOutput("Budget-Sync läuft ✓");
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return json(handle(JSON.parse(e.postData.contents)));
  } catch (err) {
    return json({ error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

function handle(req) {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty("KEY");
  if (!key && req.init && typeof req.key === "string" && req.key.length >= 16) {
    props.setProperty("KEY", req.key);
    key = req.key;
  }
  if (!key || req.key !== key) return { error: "key" };

  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  if (sh.getLastRow() === 0) { sh.appendRow(HEAD); sh.setFrozenRows(1); }
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, HEAD.length).getValues() : [];
  const at = {};
  rows.forEach((r, i) => { at[r[0]] = i; });

  // Änderungen übernehmen – die jüngere Fassung eines Eintrags gewinnt
  let dirty = false;
  for (const x of req.put || []) {
    if (!x || !x.id) continue;
    const i = at[x.id];
    if (i == null && x.x) continue;
    if (i != null && (+rows[i][6] || 0) > (x.u || 0)) continue;
    const row = [x.id, new Date(x.t), x.a / 100, x.c, x.n || "", x.w || "", x.u || 0, x.x ? "ja" : ""];
    if (i == null) { at[x.id] = rows.length; rows.push(row); } else rows[i] = row;
    dirty = true;
  }
  if (dirty) {
    sh.getRange(2, 1, rows.length, HEAD.length).setValues(rows);
    sh.getRange(2, 2, rows.length, 1).setNumberFormat("dd.mm.yyyy hh:mm");
    sh.getRange(2, 3, rows.length, 1).setNumberFormat("#,##0.00 €");
  }

  // Einstellungen (Budget, Stichtag …): die zuletzt geänderte Fassung gewinnt
  let su = +props.getProperty("SU") || 0;
  if (req.settings && (req.su || 0) > su) {
    props.setProperty("SETTINGS", JSON.stringify(req.settings));
    props.setProperty("SU", String(req.su));
    su = req.su;
  }

  const entries = rows.filter((r) => r[0] && r[7] !== "ja").map((r) => ({
    id: String(r[0]),
    t: r[1] instanceof Date ? r[1].getTime() : +new Date(r[1]),
    a: Math.round(+r[2] * 100),
    c: String(r[3]),
    n: String(r[4] || ""),
    w: String(r[5] || ""),
  }));
  return { entries, settings: JSON.parse(props.getProperty("SETTINGS") || "null"), su };
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
