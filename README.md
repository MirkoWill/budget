# Budget

Freies Monatsbudget (alles, was nicht Fixkosten ist) – schlank, fürs Handy, für unterwegs.

- **Schnell erfassen:** Betrag ins große Feld tippen, Kategorie antippen – gespeichert (Essen unterwegs,
  Lebensmittel, Amazon, Kultur, Kleidung, Sonstiges). Notiz optional, „Gestern“ für Nachträge, Rückgängig im Hinweis.
- **Überblick:** Verfügbares Monatsbudget mit Abweichung zum gleichmäßigen Plan, darunter die **Woche** (Mo–So):
  Wochenbudget, Rest, „Heute noch“ und Rest pro Tag bis Wochenende.
- **Monat → Woche → Tag:** Zu Wochenbeginn wird der Monatsrest anteilig auf die Woche verteilt; der Tageswert
  ergibt sich aus dem Wochenrest. Ein Großeinkauf drückt so nur die übrigen Tage dieser Woche; was eine Woche
  über- oder unterschreitet, verschiebt die folgenden Wochen.
- **Cockpit:** Budget und Stichtag (Standard 25.) einstellen; Kennzahlen, Wochenübersicht, Prognose fürs Periodenende,
  Verlauf ausgegeben vs. Plan, Ausgaben pro Tag, Kategorien, Vormonate, alle Ausgaben, Sicherung senden/laden.
- Am Stichtag beginnt automatisch ein neuer Zeitraum mit vollem Budget; ältere Zeiträume bleiben (ca. 13 Monate)
  für den Vergleich erhalten.
- Ohne Einrichtung bleibt alles **nur auf dem Handy** (localStorage). Funktioniert offline und lässt sich über
  „Zum Startbildschirm hinzufügen“ als App installieren.
- **Gemeinsam nutzen (optional):** Zwei oder mehr Handys teilen sich einen Topf über eine Google-Tabelle im eigenen
  Google-Konto – siehe unten.

## Gemeinsam nutzen

Die Ausgaben landen in einer Google-Tabelle in deinem Google Drive. Ein kleines Skript in der Tabelle
(`sync/Code.gs`) nimmt Änderungen entgegen und gibt den Stand an alle Handys zurück. Kostenlos, kein fremder Dienst.

**Einmalig einrichten (am besten am PC, ca. 10 Minuten):**

1. Auf [sheets.new](https://sheets.new) eine neue Google-Tabelle anlegen, z. B. „Budget“ nennen.
2. In der Tabelle **Erweiterungen → Apps Script** öffnen.
3. Den vorhandenen Code löschen und den Inhalt von [`sync/Code.gs`](sync/Code.gs) einfügen, speichern (💾).
4. Oben rechts **Bereitstellen → Neue Bereitstellung**, beim Zahnrad **Web-App** wählen:
   - Ausführen als: **Ich**
   - Zugriff: **Jeder**
5. **Bereitstellen**, Google fragt nach Berechtigungen → mit deinem Konto erlauben
   (bei „Google hat diese App nicht überprüft“: *Erweitert → Zu … wechseln*; es ist dein eigenes Skript).
6. Die **Web-App-URL** (endet auf `/exec`) kopieren. Zum Test im Browser öffnen: es muss „Budget-Sync läuft ✓“ erscheinen.
   (Steht darin `/macros/u/1/…`, korrigiert die App das selbst.)
7. In der Budget-App **Cockpit → Gemeinsam nutzen**: URL einfügen, deinen Namen eintragen, **Verbinden**.
   Deine bisherigen Einträge und Einstellungen werden hochgeladen.
8. Unter **Einladen** den Namen (z. B. Tetiana) eintragen und **Einladungslink senden** – z. B. per WhatsApp.
   Sie öffnet den Link auf ihrem Handy und ist sofort verbunden.

**Gut zu wissen:**

- Der Einladungslink enthält den geheimen Zugangsschlüssel – nur an die Person schicken, die mitmachen soll.
  Die Skript-URL allein reicht nicht, um Daten zu lesen.
- Abgleich beim Öffnen der App, nach jeder Eingabe und jede Minute. Ohne Netz wird weiter erfasst und später
  nachgereicht („offline · 1 Änderung wartet“).
- Budget und Stichtag gelten für alle; die zuletzt vorgenommene Änderung gewinnt.
- In der Tabelle lassen sich Beträge, Datum, Kategorie oder Notiz auch direkt korrigieren; die Handys übernehmen
  das beim nächsten Abgleich. Gelöschte Einträge bleiben dort mit „gelöscht = ja“ stehen.
- Neuen Schlüssel (z. B. nach versehentlichem Teilen): im Apps-Script-Editor unter *Projekteinstellungen →
  Skripteigenschaften* `KEY` löschen, dann in der App trennen und neu verbinden.
- Nach einer Änderung an `Code.gs` muss in Apps Script *Bereitstellen → Bereitstellungen verwalten → Bearbeiten →
  Version: Neue Version* gewählt werden, damit die URL gleich bleibt.

Veröffentlicht über GitHub Pages (Settings → Pages → Branch `main`, Ordner `/`).

Neue Version: Dateien ändern, in `index.html`/`sw.js` die `?v=` bzw. `CACHE` hochzählen.
