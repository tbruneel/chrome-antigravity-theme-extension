# Git Identity Guidelines

When executing Git operations that create history (such as `commit`, `merge`, `rebase`, `cherry-pick`, or annotated `tag`):
- Override the author name with `Tuur Bruneel (w/ Antigravity)` and append the co-author trailer `antigravity <bruneel.tuur+antigravity@gmail.com>`.
- Use multiple `-m` flags to attach the trailer cleanly without shell-specific newline escapes.
- Retain the user's primary email address (`bruneel.tuur+github@gmail.com`) so contributions count toward their GitHub activity graph.
- Do not commit purely under `Tuur Bruneel` unless explicitly instructed.

### Example
```powershell
git -c user.name="Tuur Bruneel (w/ Antigravity)" commit -m "<title>" -m "Co-authored-by: antigravity <bruneel.tuur+antigravity@gmail.com>"
```
