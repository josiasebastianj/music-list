# Shared agent skills

Copies of the skills used while building this repository, so any AI model or coding agent can follow the same working rules. Each skill is a folder with a `SKILL.md` (instructions, with a `name` and `description` in its frontmatter) and optional supporting files.

| Folder | Source (version) | Use it for |
|--------|------------------|------------|
| `ponytail/` | ponytail 4.10.0 | Default coding style: the laziest solution that works, no speculative code. Skills: `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help` |
| `superpowers/` | superpowers 7.0.0 | Process: brainstorming, plans, TDD, debugging, code review, verification before claiming done |
| `modern-web-guidance/` | modern-web-guidance 0.0.194 | Current HTML/CSS/browser-API practices (also `chrome-extensions`) |
| `ui-ux-pro-max/` | ui-ux-pro-max 2.13.0 | UI/UX design, design systems, styling, banners, slides |
| `caveman/` | caveman-mode-short-answers 1.3.2 | Short, direct answers on request |

## How to use them

- **Claude Code:** copy or symlink a folder's skill directories into `.claude/skills/` (project) or `~/.claude/skills/` (user). They are normally installed as plugins instead.
- **Any other agent:** before a task, read the `SKILL.md` that matches it (start with `ponytail/ponytail/SKILL.md`, then `superpowers/using-superpowers/SKILL.md`) and follow it. Paths inside a skill are relative to that skill's folder.
- Tool names in the skills (e.g. `Skill`, `Agent`) are Claude Code's; map them to your agent's equivalents.

Each folder keeps its upstream `LICENSE`. To update a skill, re-copy it from the plugin and bump the version in the table.
