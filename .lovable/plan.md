# PIN-Login: Mitarbeiter auswählen + PIN

Zweiter, zusätzlicher Anmeldeweg. Der bestehende E-Mail/Passwort-Login bleibt unverändert, es entsteht kein zweiter Benutzeraccount, `auth.uid()` bleibt identisch mit `profiles.id`.

## 1. Neues Datenmodell (minimal)

Eine neue Tabelle: `public.employee_logins`. Eine Zeile = dieser bestehende Benutzer darf sich zusätzlich per PIN anmelden.

| Feld | Typ | Zweck |
|---|---|---|
| `user_id` | uuid PK → `profiles.id` | die bestehende Identität |
| `pin_hash` | text | PBKDF2-Hash, nie Klartext |
| `pin_salt` | text | zufälliger Salt pro Nutzer |
| `pin_set_at` | timestamptz | wann zuletzt gesetzt |
| `pin_must_change` | boolean | nach Start-PIN/Reset `true` |
| `failed_attempts` | int | Zähler für Sperre |
| `locked_until` | timestamptz null | temporäre Sperre |
| `enabled` | boolean | PIN-Zugang aktiv/deaktiviert |
| `select_ref` | uuid unique | opake Auswahl-ID für den Client |
| `created_at` / `updated_at` | timestamptz | Standard |

Bewusst **nicht** enthalten: `last_name`, `first_name`, `last_name_norm`, `norm_name()`, Nachnamen-Suche, Lookup-Token, `PIN_LOOKUP_TOKEN_SECRET`, Duplicate-Logik. Namen kommen aus `profiles.full_name`.

`auth_email` wird **nicht** gespeichert: die E-Mail liegt bereits in `auth.users` und wird serverseitig über `supabaseAdmin.auth.admin.getUserById(user_id)` gelesen. Keine Redundanz, keine zweite Benutzerverwaltung.

Der Client sieht nur `select_ref` + Anzeigename — nie `user_id`, nie E-Mail, nie Rolle.

## 2. Unverändert

`profiles`, `machines`, `movements`, `reservations`, `defects`, `maintenance`, `sites`, `accessories`, `machine_photos`, `machine_categories` — keine Spalten, Enums, Trigger oder RLS-Änderungen. `is_admin()`, `handle_new_user()`, `useIdentity()`, Checkout/Return/Reservierungen bleiben wie sie sind.

## 3. `listPinEmployees()`

Öffentliche Server-Funktion (kein Auth), read-only, für die Login-Seite.

- Läuft serverseitig mit dem Service-Role-Client (Tabelle ist für `anon`/`authenticated` komplett gesperrt).
- Join `employee_logins` × `profiles`, gefiltert auf `enabled = true` und `profiles.active = true`.
- Rückgabe ausschließlich: `[{ ref: select_ref, name: full_name }]`, alphabetisch sortiert.
- Bei exakt gleichem Anzeigenamen wird ein neutraler Zusatz aus vorhandenen Daten ergänzt (`Name (2)` als reine Ordnungszahl) — keine E-Mail, keine Rolle, keine ID.
- Serverseitiges Caching/Limit, damit die Liste nicht als Scraping-Endpunkt missbraucht wird.

## 4. `pinLogin({ ref, pin })`

Öffentliche Server-Funktion, Ablauf:

1. `ref` (uuid) validieren, Zeile über `select_ref` laden. Unbekannt → generischer Fehler.
2. `enabled` und `profiles.active` prüfen.
3. `locked_until > now()` → generischer Fehler.
4. PIN gegen `pin_hash` prüfen (konstantzeitiger Vergleich).
5. Fehlschlag: `failed_attempts + 1`; ab 5 → `locked_until = now() + 15 min`, Zähler zurück auf 0.
6. Erfolg: Zähler/Sperre zurücksetzen, Session erzeugen (Abschnitt 5).
7. Rückgabe bei Erfolg: `{ ok: true, session, mustChangePin }`. Jeder Fehlerfall liefert exakt „Anmeldung nicht möglich." — keine Unterscheidung zwischen unbekannt, gesperrt, deaktiviert oder falscher PIN.

Zusätzlich eine IP-basierte Kurzzeit-Drossel serverseitig, damit ein Angreifer nicht parallel über viele `ref`s streut.

## 5. Wie die Supabase-Session entsteht

Kein eigenes JWT-Signieren. Mit supabase-js v2 (hier 2.112):

1. Server: E-Mail des Nutzers via `supabaseAdmin.auth.admin.getUserById(user_id)`.
2. Server: `supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email })` → liefert `properties.hashed_token`. Es wird **keine** E-Mail versendet, das Token wird nicht ausgeliefert an Dritte, sondern direkt an den Client zurückgegeben, der die PIN gerade korrekt bewiesen hat.
3. Client: `supabase.auth.verifyOtp({ type: 'magiclink', token_hash })` → echte, reguläre Supabase-Session inkl. Refresh-Token, in `localStorage` wie beim E-Mail-Login.

Damit gilt danach exakt dieselbe Identität: `auth.uid() = profiles.id`, RLS greift unverändert, `requireSupabaseAuth` und der Bearer-Attacher funktionieren ohne Änderung. Logout = `supabase.auth.signOut()` wie bisher; Session-Refresh übernimmt der Supabase-Client automatisch.

Vor der Umsetzung wird `generateLink` einmal gegen das verbundene Projekt geprüft (Rückgabeform `hashed_token` und Ablaufzeit), bevor der Flow verdrahtet wird.

## 6. PIN-Verwaltung durch Admin

Im bestehenden Benutzerbereich, alle Aktionen als Server-Funktionen mit `requireSupabaseAuth` + serverseitiger `is_admin()`-Prüfung über den *eigenen* Client des Aufrufers, erst danach Service-Role:

- `enablePinAccess(userId)` → Zeile anlegen, Start-PIN (6 Ziffern, kryptografisch zufällig, keine Trivialfolgen) erzeugen, `pin_must_change = true`. Der Klartext wird **genau einmal** in der Antwort zurückgegeben und nur im Dialog angezeigt.
- `resetPin(userId)` → neue Start-PIN, `pin_must_change = true`, Sperre und Zähler zurückgesetzt.
- `disablePinAccess(userId)` → `enabled = false`.
- `unlockPin(userId)` → `locked_until = null`, `failed_attempts = 0`.
- `changeOwnPin({ oldPin, newPin })` unter `requireSupabaseAuth` für den Mitarbeiter selbst; setzt `pin_must_change = false`.

Es gibt keinen Endpunkt, der einen bestehenden PIN oder `pin_hash` ausliefert.

## 7. Secrets

- `PIN_PEPPER` — serverseitiger Zusatzschlüssel, der in die Hash-Berechnung einfließt. Wird generiert (64 Zeichen), nie angezeigt, nur in Server-Funktionen gelesen.
- Bereits vorhanden und ausreichend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`.
- Kein `PIN_LOOKUP_TOKEN_SECRET` mehr.

## 8. RLS & Grants für `employee_logins`

- `ENABLE ROW LEVEL SECURITY`, **keine** Policy für `anon` oder `authenticated`.
- `GRANT ALL ON public.employee_logins TO service_role;` — sonst keine Grants.
- Zugriff ausschließlich über Server-Funktionen. Damit ist `pin_hash` über die Data API grundsätzlich nicht erreichbar.

## 9. Sicherheitsrisiken und Gegenmaßnahmen

| Risiko | Maßnahme |
|---|---|
| 6-stellige PIN = nur 1 Mio. Kombinationen | Sperre nach 5 Fehlversuchen (15 Min), serverseitige Drossel, Trivial-PINs ausgeschlossen |
| Offline-Angriff bei DB-Leak | PBKDF2-SHA256 mit hoher Iterationszahl, Salt pro Nutzer **und** serverseitigem Pepper, der nicht in der DB liegt |
| Mitarbeiterliste ist öffentlich | Bewusst akzeptiert; nur Anzeigename + opake `select_ref`, kein Rückschluss auf `user_id`, E-Mail oder Rolle |
| Missbrauch des Magic-Link-Tokens | Token wird nur nach erfolgreicher PIN-Prüfung ausgegeben, ist einmalig und kurzlebig, wird sofort im selben Request-Zyklus eingelöst |
| Enumeration von Konten | Einheitliche Fehlermeldung „Anmeldung nicht möglich." und konstante Antwortzeit |
| Service-Role-Leak | `client.server` wird nur innerhalb der Handler geladen, nie im Modul-Scope einer `.functions.ts` |

Bewusst offen: Ein 6-stelliger PIN bleibt schwächer als ein Passwort. Für Baustellen-Geräte ist das der gewollte Kompromiss, abgesichert über Sperre und Pepper.

## 10. Geplante Migration (nur Anzeige, wird nicht ausgeführt)

```sql
create table public.employee_logins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  select_ref uuid not null unique default gen_random_uuid(),
  pin_hash text not null,
  pin_salt text not null,
  pin_set_at timestamptz not null default now(),
  pin_must_change boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nur der Server darf diese Tabelle sehen. Kein anon, kein authenticated.
grant all on public.employee_logins to service_role;

alter table public.employee_logins enable row level security;
-- Absichtlich keine Policy: alle Zugriffe laufen über service_role in Server-Funktionen.

create trigger employee_logins_set_updated_at
  before update on public.employee_logins
  for each row execute function public.set_updated_at();
```

## 11. UI

Login-Seite bekommt zwei Tabs: „Büro / Admin" (E-Mail + Passwort, unverändert) und „Mitarbeiter" (suchbare Combobox mit `Vorname Nachname` + 6-stelliges PIN-Feld, CTA „Anmelden"). Nach Login mit `pin_must_change = true` erscheint einmalig der Dialog „PIN ändern".

Die Komfortfunktion „zuletzt gewählte Person vorausgewählt" wird in Version 1 **nicht** implementiert, um den ersten Wurf schlank zu halten; die Combobox ist so gebaut, dass sie später ohne Umbau ergänzt werden kann.
