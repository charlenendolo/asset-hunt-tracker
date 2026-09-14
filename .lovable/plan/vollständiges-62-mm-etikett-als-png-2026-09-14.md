# Vollständiges 62-mm-Etikett als PNG

## Ziel
Der PNG-Download wird zu einer druckfertigen digitalen Kopie des bestehenden 62 × 24-mm-Etiketts. Vorschau, Direktdruck und PNG verwenden dieselben Maße, Inhalte und Layoutwerte.

## Umsetzung
- Die bestehende Etikettenbeschreibung in `qr-labels` als kanonische Vorlage beibehalten: QR-Code, Gerätename, Gerätenummer und „Repenning · Geräte“ bleiben unverändert.
- Gemeinsame Maß- und Typografieparameter für HTML-Druck und hochauflösenden Canvas-Export verwenden, statt ein zweites unabhängiges Download-Layout zu pflegen.
- Das vollständige Etikett mit 62 × 24 mm bei mindestens 300 DPI als verlustfreies PNG rendern; den QR-Code nativ hochauflösend und ohne Interpolation einsetzen.
- Den bisherigen Roh-QR-Download durch „Etikett als PNG herunterladen“ ersetzen und den Dateinamen auf `<Gerätenummer>_<Gerätename>_Etikett.png` umstellen.
- Einzel- und vorhandene Stapel-/Druckfunktionen sowie QR-Ziel-URLs unverändert lassen.

## Prüfung
- Maße und Seitenverhältnis der PNG-Datei kontrollieren.
- Vorschau und PNG mit demselben Testgerät visuell vergleichen.
- QR-Inhalt aus der erzeugten PNG prüfen, soweit lokal verfügbare Decoder dies erlauben.
- Typprüfung und gezielte Codeprüfung ausführen.

## Technische Details
- Exportgröße aus Millimetern und DPI berechnen, nicht nachträglich hochskalieren.
- Canvas verwendet die zentralen Etikettenparameter; QR-Rendering bleibt verlustfreies PNG mit ausreichender Quiet Zone.
- Kein Datenbank-, Rollen-, Routing- oder Authentifizierungsumbau.
