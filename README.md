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
- Alles bleibt **nur auf dem Handy** (localStorage) – kein Server, kein Konto. Funktioniert offline und lässt sich
  über „Zum Startbildschirm hinzufügen“ als App installieren.

Veröffentlicht über GitHub Pages (Settings → Pages → Branch `main`, Ordner `/`).

Neue Version: Dateien ändern, in `index.html`/`sw.js` die `?v=` bzw. `CACHE` hochzählen.
