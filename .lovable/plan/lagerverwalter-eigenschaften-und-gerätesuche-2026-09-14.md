# Lagerverwalter, Eigenschaften und Gerätesuche

## Datenmodell

- Die bestehende Rollenregel von `profiles.role` um den eindeutigen Wert `warehouse_manager` erweitern; bestehende Rollen und Nutzer bleiben unverändert.
- Eine wiederverwendbare Tabelle für Eigenschaften mit eindeutigem, von Groß-/Kleinschreibung unabhängigem Namen anlegen.
- Eine Zuordnungstabelle Gerät ↔ Eigenschaft mit eindeutiger Kombination und automatischer Bereinigung beim Löschen eines Geräts anlegen.
- Beide Tabellen nur für angemeldete Nutzer lesbar machen; Änderungen erfolgen ausschließlich über geprüfte Serverfunktionen.
- Die bestehende Spalte und historische Werte für Anschaffungspreise bleiben erhalten.

## Lagerverwalter

- „Lagerverwalter“ in Benutzeranlage, Benutzerbearbeitung, Rollenfilter, Rollenanzeige, Profil und Seitenleiste ergänzen.
- Serverseitige Rollenvalidierung auf `warehouse_manager` erweitern.
- Lagerverwalter darf Geräte anlegen sowie Gerätefotos, Standorte, Zubehör und Eigenschaften operativ verwalten.
- Admin-exklusive Funktionen wie Benutzerverwaltung, Etikettenverwaltung, Verantwortlichkeitskorrektur und vollständige Stammdatenbearbeitung bleiben Admin vorbehalten.
- Bestehende Bauleiter-, Mitarbeiter- und Adminrechte bleiben unverändert.

## Eigenschaften

- Eine vorhandene Eigenschaft auswählen oder direkt neu anlegen; Schreibweise wird normalisiert und vorhandene Werte werden ohne Duplikat wiederverwendet.
- Eigenschaften beim Anlegen eines Geräts mitspeichern und im Admin-Dialog zum Bearbeiten hinzufügen/entfernen.
- Auf dem Gerätepass alle Eigenschaften als kompakte Tags anzeigen.
- In der Geräteübersicht eine begrenzte Anzahl anzeigen und weitere Werte als „+N weitere“ zusammenfassen.
- Anschaffungspreis aus Geräteanzeige sowie Anlege-/Bearbeitungsoberfläche entfernen, ohne gespeicherte Werte zu löschen.

## Suche

- Die normale Gerätesuche weiterhin serverseitig über Supabase ausführen und um Eigenschaften erweitern.
- Zuerst passende Geräte-IDs über die Eigenschaften-Zuordnung ermitteln und diese zusammen mit Name, Gerätenummer, Seriennummer, Hersteller und Modell in derselben paginierten Suche berücksichtigen.
- Groß-/Kleinschreibung ignorieren und keinen sichtbaren Eigenschaftenfilter hinzufügen.

## Prüfung

- Migration und Rollenregel kontrollieren; kein doppelter Rollenwert und keine offenen Schreibrechte.
- Benutzer mit `warehouse_manager` anlegen/bearbeiten, Rolle nach Aktualisierung prüfen und Berechtigungsgrenzen testen.
- Eigenschaften an zwei Geräten anlegen, wiederverwenden, entfernen und auf Duplikatvermeidung prüfen.
- Normale Suche mit „SDS Max“ und „sds max“ prüfen; leere Suche stellt die vollständige Liste wieder her.
- Desktop- und Mobilansicht von Geräteliste, Gerätepass und Formularen prüfen; anschließend TypeScript-, Lint- und Sicherheitstest ausführen.
