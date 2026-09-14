# QR-Etiketten auf PNG und 62 mm umstellen

## Umsetzung

- Die bestehende permanente Geräte-URL bleibt unverändert.
- Eine zentrale QR-Hilfe erzeugt verlustfreie, schwarz-weiße PNGs mit ausreichender Auflösung für mindestens 300 DPI bei der vorgesehenen Druckgröße.
- Etikettenvorschau, Einzel- und Stapeldruck verwenden dieselben PNG-Daten; gedruckt wird erst, wenn alle Bilder geladen sind.
- Das Standardetikett bleibt physisch `62 mm × 24 mm` und wird in der Auswahl eindeutig als 62-mm-Format benannt.
- Der kompakte Altmodus wird aus dem primären Ablauf entfernt, A4-Druck bleibt erhalten.
- Der Einzel-Download wird auf PNG reduziert; Dateinamen bleiben bereinigt.
- Fehlerhafte QR-Erzeugungen werden pro Gerät sichtbar gemeldet und nie als leere Etiketten gedruckt.

## Prüfung

- QR-Inhalt entspricht weiterhin exakt `/maschine/{machine.id}` und enthält keine weiteren Daten.
- Vorschau und Druck-Markup enthalten PNG-Bilder statt SVG.
- Einzel- und Stapeldruck warten auf fertig geladene PNGs.
- Auswahl, A4-Modus und bestehende Berechtigungen bleiben unverändert.
- TypeScript-Prüfung sowie Browserprüfung der Etikettenansicht auf Desktop und Mobil.

Keine Datenbank-, Maschinen-, Rollen- oder Workflow-Änderungen.
