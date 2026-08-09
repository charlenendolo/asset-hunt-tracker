# AssetHunt – Operationaler Ausbau

Analyse ist erfolgt: Reservierungen, Defekte, Fotos, QR und Standorte lassen sich fast vollständig
mit dem bestehenden Schema umsetzen. Nur der Foto-Upload braucht eine Freigabe.

## Was ohne Schemaänderung geht

- `reservations.start_at/end_at` bleiben `timestamptz` — Werte werden auf Tagesgrenzen normalisiert
  (Start 00:00, Ende 23:59:59 lokal). Keine Migration nötig.
- `defects` hat bereits `status`, `resolved_at`, `resolved_by` — Abschluss-Workflow direkt möglich.
- `sites.location_type` ist vorhanden und im UI bereits verdrahtet.
- `machine_photos` (storage_path, is_primary) existiert.

## 1. Reservierungen (höchste Priorität)

- Formular nur noch `Von` / `Bis` als Datumsfelder, Anzeige überall ohne Uhrzeit.
- Serverseitig direkt vor dem Speichern:
  - Statussperre: `defective`/`defect` → „Dieses Gerät ist aktuell defekt …“,
    `maintenance` → „… in Wartung …“, `retired` → „… nicht mehr verfügbar.“
  - Tagesgenaue Überschneidungsprüfung inkl. Anzeige des belegten Zeitraums.
  - Aktuell ausgeliehen: Reservierung ab einem Tag nach `expected_return_at` erlaubt;
    ohne `expected_return_at` Hinweis „Aktuell ausgeliehen – zukünftige Verfügbarkeit unklar.“
- Status: Enum-Wert `confirmed` bleibt unverändert, UI-Label wird **„Eingeplant“**
  (statt „Bestätigt“, das eine Genehmigung suggeriert).

## 2. Defekt abschließen

- Button „Defekt abschließen“ im Gerätepass für admin und site_manager.
- Dialog: offener Defekt auswählen, Reparatur-/Prüfkommentar (Pflicht).
- Server: `status='resolved'`, `resolved_at`, `resolved_by`, Kommentar an Beschreibung angehängt;
  Maschine auf `available`, wenn kein weiterer offener Defekt und keine Wartung/Ausleihe.

## 3. Kalender → Ressourcen-Timeline

Primäransicht wird eine maschinenorientierte Wochen-Timeline (Zeile = Maschine, Spalte = Tag)
statt Monatsraster — für „welches Gerät ist wann belegt“ deutlich schneller lesbar.

- Ganztagesblöcke, keine Uhrzeiten, Maschinenname prominent, Gerätenummer sekundär.
- Farbcodierung: Reservierung (grün), Ausleihe (blau/neutral), Wartung (amber), Defekt (rot).
- Heute hervorgehoben, Woche vor/zurück, „Heute“-Sprung.
- Mobil: horizontal scrollbare Tagesspalten mit fixierter Maschinenspalte.
- Keine Kalender-Bibliothek, reines CSS-Grid.

## 4. Standorte

Bereits umgesetzt (Combobox, Gruppierung, „+ Neuen Standort hinzufügen“, Filter).
Wird nur noch auf die neuen Formulare (Maschine anlegen/bearbeiten, Inventur) ausgerollt.

## 5. QR-Codes

Neue Route `/qr-codes` für admin und site_manager: Liste mit Name, Gerätenummer, Status, QR,
Mehrfachauswahl und Druckansicht (Etikett: AssetHunt, QR, Gerätenummer, Name).
Ziel-URL bleibt `/maschine/{machineId}`.

## 6. Maschinenverwaltung

„Maschine hinzufügen“ und „Bearbeiten“ über Server-Funktionen (Rollenprüfung serverseitig),
nur bestehende Spalten. Pflicht: Gerätenummer, Bezeichnung. Standort über die Combobox.

## 7. Fotos — Freigabe nötig

Es existiert noch kein Storage-Bucket. Vorschlag:

- Bucket `machine-photos`, **privat**, Zugriff über signierte URLs.
- Policies auf `storage.objects` (Migration, wird vorher gezeigt):
  - `authenticated` darf Objekte im Bucket lesen,
  - `authenticated` darf hochladen,
  - löschen nur admin/site_manager.

Upload im Gerätepass (Kamera auf Mobil + Datei), mehrere Fotos, primäres Bild setzbar.

## 8. Inventurmodus

Mobiler Erfassungsflow `/inventur`: Gerätenummer + Bezeichnung Pflicht, restliche Felder direkt
darunter, Foto optional, nach dem Speichern großer CTA „Nächste Maschine erfassen“
mit übernommenem Standort. Keine neue Rolle.

## 9. PIN-Login

`listPinEmployees()` wird durch `searchPinEmployees({ query })` ersetzt (serverseitig, min. 2 Zeichen,
max. 10 Treffer, nur Vor-/Nachname). Hashing-, Sperr- und Session-Logik bleibt unangetastet.

## 10–13. Meine Geräte, Checkout/Rückgabe, Dashboard, Rollen

Bestehende Logik bleibt; nach Checkout/Rückgabe werden die relevanten Queries invalidiert,
sodass „Meine Geräte“ sofort aktualisiert. Dashboard erhält eine Sektion
„Was braucht heute Aufmerksamkeit?“ und feinere Jungle-Green-Akzente.

## 14. Abschluss

Typecheck, Produktions-Build, Prüfung der Auth-, PIN-, Checkout-, Reservierungs- und
Kalender-Flows, danach Pilot-Test-Checkliste. Keine Domain-/DNS-Änderung.

## Freizugeben

Nur eine Änderung: der Storage-Bucket `machine-photos` samt Policies (Punkt 7).
Alles andere kommt ohne Schema-, RLS- oder Enum-Änderung aus.
Ohne diese Freigabe setze ich Punkt 7 nicht um und liefere den Rest.
