# Produktionsbereinigung der Oberfläche

## Ziel
Asset Hunt zeigt nur Funktionen, die heute tatsächlich nutzbar sind, sowie hilfreiche Leerzustände für echte Datenbereiche.

## Umsetzung
- Alle Hauptseiten, rollenabhängigen Ansichten, Menüs, Dialoge, Hinweise und Hilfetexte nach Zukunftsankündigungen und Platzhaltern durchsuchen.
- Unfertige Karten, deaktivierte Zukunftsaktionen, Fake-Links und leere Platzhalterbereiche vollständig entfernen.
- Im Gerätepass den gesamten Bereich mit geplanten Modulen entfernen, einschließlich der nicht vorhandenen Handbuch-/Bedienungsanleitungsanzeige; echte QR-, Foto-, Zubehör-, Eigenschaften- und Verlaufsfunktionen bleiben bestehen.
- Begriffe wie „demnächst“ beibehalten, wenn sie einen echten Terminstatus beschreiben, etwa eine bald fällige Prüfung oder Reservierung.
- Nach der Entfernung Layouts ohne leere Überschriften, Trennlinien oder Lücken natürlich neu fließen lassen.

## Prüfung
- Quelltextweit erneut nach deutschen und englischen Zukunftsformulierungen sowie funktionslosen Bedienelementen suchen.
- Login, Dashboard, Geräte, Gerätepass, Standorte, Reservierungen/Kalender, Benutzer, Einstellungen und Etikettendruck auf Desktop und Mobil prüfen.
- Rollenabhängige Sichtbarkeit für Admin, Bauleiter, Lagerverwalter und Mitarbeiter anhand der vorhandenen Zugriffspfade prüfen; bestehende Berechtigungen und Abläufe nicht verändern.
- Relevante Qualitätsprüfungen ausführen und nur die bestehende Oberflächenbereinigung ausliefern.

## Technische Grenzen
- Keine Datenbank-, Daten-, Rollen-, RLS- oder Serverlogik ändern.
- Keine angekündigte Funktion neu bauen.
- Funktionierende Leerzustände und bestehende Arbeitsabläufe unverändert lassen.
