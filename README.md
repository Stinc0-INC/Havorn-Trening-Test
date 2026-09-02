# Havørn Trening

Lokal, mobilvennlig prototype for oppmøte og nivåbaserte treningsgrupper.

## Starte appen

Åpne `index.html` i nettleseren. Excel-import bruker SheetJS fra CDN og trenger derfor nettilkobling. CSV kan senere gjøres helt lokal ved å pakke biblioteket sammen med appen.

## Første arbeidsflyt

1. Importer Excel/CSV fra Spond, eller kryss av manuelt.
2. Legg til eller fjern spillere etter opptelling.
3. Velg antall grupper; appen anbefaler omtrent seks per gruppe.
4. Appen lager nivågruppene.
5. Til avsluttende spill kombineres gruppe 1+2, gruppe 3+4 osv. og deles i to jevne lag.
6. Alternativt kan alle fremmøtte blandes og fordeles i jevne lag på tvers av alle nivågruppene.
7. Admin kan endre navn og rangering lokalt.

## Viktig før publisering

Denne versjonen lagrer data lokalt i nettleseren og er laget for funksjonstesting. Før flere trenere får tilgang må appen få ekte innlogging, roller, database, sikkerhetsregler og en avklart personvernløsning.

## Spillerliste

Spillerlisten inneholder 42 spillere i intern rangeringsrekkefølge. Håkon R er nummer 1 og Martin er nummer 42.
