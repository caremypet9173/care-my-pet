# Instrukcje projektu Care My Pet

## Git przez Docker

W tym projekcie wszystkie operacje Git wykonuj przez `git-shell.ps1`, który
uruchamia Git w Dockerze z konfiguracją i uwierzytelnianiem projektu.
Nie używaj bezpośrednio hostowego `git.exe` ani nie zmieniaj jego `safe.directory`.

Przykłady w PowerShell (argumenty bez dodatkowego słowa `git`):

```powershell
.\git-shell.ps1 status --short
.\git-shell.ps1 diff
.\git-shell.ps1 add -- src/sciezka-do-pliku
.\git-shell.ps1 commit -m 'feat: opis zmiany'
.\git-shell.ps1 push origin main
```

Jeśli Docker jest niedostępny, zgłoś problem zamiast przechodzić na Git hosta.
Nie wypisuj adresów remote zawierających dane uwierzytelniające.

Pozostałe zasady projektu i odnośniki do dokumentacji znajdują się w `CLAUDE.md`.
