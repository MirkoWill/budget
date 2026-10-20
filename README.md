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
(`sync/Code.gs`) nimmt Änderungen entgegen und gibt den Stand an alle Geräte zurück. Wer Zugriff hat, steuerst du
im Blatt **„Zugänge“**: pro Person eine Zeile mit eigenem Link, per Häkchen aktiv oder gesperrt.

**Einmalig einrichten (am PC, ca. 10 Minuten):**

1. Auf [sheets.new](https://sheets.new) eine neue Google-Tabelle anlegen, z. B. „Budget“ nennen.
2. **Erweiterungen → Apps Script** öffnen, vorhandenen Code löschen, den Inhalt von [`sync/Code.gs`](sync/Code.gs)
   einfügen und speichern (💾).
3. **Bereitstellen → Neue Bereitstellung**, beim Zahnrad **Web-App** wählen: Ausführen als **Ich**, Zugriff **Jeder**.
   **Bereitstellen**, Berechtigungen erlauben (bei „Google hat diese App nicht überprüft“: *Erweitert → Zu … wechseln*).
   Die **Web-App-URL** (endet auf `/exec`) kopieren.
4. Zurück in der Tabelle die Seite neu laden. Oben erscheint das Menü **Budget → Einrichten** – einmal ausführen
   (ggf. nochmal erlauben). Es entstehen die Blätter „Zugänge“ und „Ausgaben“.
5. Im Blatt „Zugänge“ die Web-App-URL in Zelle **B1** einfügen.
6. Ab Zeile 4 in Spalte A je einen Namen eintragen (z. B. Mirko, Tetiana). Schlüssel, Häkchen „Aktiv“ und der
   **Link zum Verschicken** erscheinen von selbst.
7. Den Link jeder Person schicken (Zelle kopieren, z. B. per WhatsApp). Antippen genügt – das Gerät ist verbunden.
   Alternativ in der App unter **Cockpit → Gemeinsam nutzen** einfügen.

**Verwalten:**

- **Sperren:** Häkchen „Aktiv“ entfernen – das Gerät zeigt „Zugang deaktiviert“. Häkchen wieder setzen = freigeben.
- **Neuer Link für eine Person:** Schlüssel-Zelle leeren und den Namen neu eintragen; der alte Link ist dann ungültig.
- **Zuletzt gesehen** zeigt, wann ein Zugang zuletzt abgeglichen hat.
- Der Name aus der Tabelle steht bei jeder Ausgabe in „Von“.

**Gut zu wissen:**

- Abgleich beim Öffnen der App, nach jeder Eingabe und jede Minute. Ohne Netz wird weiter erfasst und später
  nachgereicht.
- Beim ersten Verbinden kommen die bisherigen Einträge des Geräts in den gemeinsamen Topf. Budget und Stichtag
  kommen aus der Tabelle; nur wenn dort noch keine stehen, übernimmt sie die des Geräts.
- In „Ausgaben“ lassen sich Beträge, Datum, Kategorie oder Notiz direkt korrigieren; die Geräte übernehmen das beim
  nächsten Abgleich. Gelöschte Einträge bleiben mit „gelöscht = ja“ stehen.
- Den Link nur an die Person schicken, für die er gedacht ist – er ist ihr Schlüssel.
- Nach einer Änderung an `Code.gs`: *Bereitstellen → Bereitstellungen verwalten → Bearbeiten → Version: Neue Version*,
  damit die URL gleich bleibt.
- Öffnet man die Web-App-URL im Browser, sollte „Budget-Sync läuft ✓“ erscheinen. Sind im Browser mehrere
  Google-Konten angemeldet, zeigt Google dort oft eine Fehlerseite – das betrifft die App nicht (zum Prüfen ein
  Inkognito-Fenster nehmen).

Veröffentlicht über GitHub Pages (Settings → Pages → Branch `main`, Ordner `/`).

Neue Version: Dateien ändern, in `index.html`/`sw.js` die `?v=` bzw. `CACHE` hochzählen.
