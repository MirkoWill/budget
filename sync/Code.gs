// Budget – gemeinsamer Speicher in dieser Google-Tabelle.
// Einrichtung: siehe README (Erweiterungen → Apps Script → diesen Code einfügen → als Web-App bereitstellen,
// Ausführen als: ich, Zugriff: jeder). Zugänge verwaltest du im Blatt „Zugänge“.
const APP = "https://mirkowill.github.io/budget/";
const SHEET = "Ausgaben";
const HEAD = ["ID", "Datum", "Betrag (€)", "Kategorie", "Notiz", "Von", "geändert", "gelöscht"];
const ACCESS = "Zugänge";
const FIRST = 4;   // erste Zeile mit einem Zugang (darüber: Web-App-URL und Überschriften)

// ---------- Tabelle: Menü und Blatt „Zugänge“ ----------
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Budget").addItem("Einrichten", "setup").addToUi();
}

function setup() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(ACCESS) || ss.insertSheet(ACCESS, 0);
  sh.getRange("A1").setValue("Web-App-URL").setFontWeight("bold");
  if (!sh.getRange("B1").getValue()) sh.getRange("B1").setValue("← hier die Web-App-URL (…/exec) einfügen");
  sh.getRange("A2").setValue("Unten einen Namen eintragen – Schlüssel, Häkchen und Link entstehen von selbst. Häkchen weg = gesperrt.")
    .setFontColor("#777777");
  sh.getRange(FIRST - 1, 1, 1, 5).setValues([["Name", "Aktiv", "Link zum Verschicken", "Schlüssel", "Zuletzt gesehen"]]).setFontWeight("bold");
  sh.setFrozenRows(FIRST - 1);
  sh.setColumnWidth(1, 140); sh.setColumnWidth(3, 420); sh.setColumnWidth(4, 260);
  for (let r = FIRST; r <= sh.getLastRow(); r++) fillAccess(sh, r);
  const data = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  if (data.getLastRow() === 0) { data.appendRow(HEAD); data.setFrozenRows(1); }
}

// Name eingetragen → Schlüssel, Häkchen und Link ergänzen
function onEdit(e) {
  const sh = e.range.getSheet();
  if (sh.getName() !== ACCESS || e.range.getColumn() !== 1 || e.range.getRow() < FIRST) return;
  for (let r = e.range.getRow(); r <= e.range.getLastRow(); r++) fillAccess(sh, r);
}

function fillAccess(sh, r) {
  const name = String(sh.getRange(r, 1).getValue()).trim();
  if (!name || sh.getRange(r, 4).getValue()) return;
  sh.getRange(r, 4).setValue(Utilities.getUuid().replace(/-/g, ""));
  sh.getRange(r, 2).insertCheckboxes().setValue(true);
  sh.getRange(r, 3).setFormula(
    `=IFERROR("${APP}#join=" & REGEXEXTRACT($B$1, "/s/([^/]+)/exec") & "." & D${r} & "." & ENCODEURL(A${r}), "erst oben die Web-App-URL einfügen")`);
}

// ---------- Web-App ----------
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
  const ss = SpreadsheetApp.getActive();

  // Zugang prüfen: Schlüssel muss im Blatt „Zugänge“ stehen und aktiv sein
  const acc = ss.getSheetByName(ACCESS);
  if (!acc || acc.getLastRow() < FIRST || !req.key) return { error: "key" };
  const list = acc.getRange(FIRST, 1, acc.getLastRow() - FIRST + 1, 5).getValues();
  const i = list.findIndex((r) => String(r[3]) === String(req.key));
  if (i < 0) return { error: "key" };
  if (list[i][1] !== true) return { error: "inactive" };
  const seen = list[i][4];
  if (!(seen instanceof Date) || Date.now() - seen.getTime() > 10 * 60000) acc.getRange(FIRST + i, 5).setValue(new Date());
  const who = String(list[i][0]);

  const sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  if (sh.getLastRow() === 0) { sh.appendRow(HEAD); sh.setFrozenRows(1); }
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, HEAD.length).getValues() : [];
  const at = {};
  rows.forEach((r, k) => { at[r[0]] = k; });

  // Änderungen übernehmen – die jüngere Fassung eines Eintrags gewinnt
  let dirty = false;
  for (const x of req.put || []) {
    if (!x || !x.id) continue;
    const k = at[x.id];
    if (k == null && x.x) continue;
    if (k != null && (+rows[k][6] || 0) > (x.u || 0)) continue;
    const row = [x.id, new Date(x.t), x.a / 100, x.c, x.n || "", x.w || who, x.u || 0, x.x ? "ja" : ""];
    if (k == null) { at[x.id] = rows.length; rows.push(row); } else rows[k] = row;
    dirty = true;
  }
  if (dirty) {
    sh.getRange(2, 1, rows.length, HEAD.length).setValues(rows);
    sh.getRange(2, 2, rows.length, 1).setNumberFormat("dd.mm.yyyy hh:mm");
    sh.getRange(2, 3, rows.length, 1).setNumberFormat("#,##0.00 €");
  }

  // Einstellungen (Budget, Stichtag …): die zuletzt geänderte Fassung gewinnt
  const props = PropertiesService.getScriptProperties();
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
  return { entries, settings: JSON.parse(props.getProperty("SETTINGS") || "null"), su, me: who };
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
