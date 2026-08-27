# Provenance

Vendored third-party skill. Not written here, and not a live dependency: this is a
pinned copy, so a change upstream cannot silently alter what the agent does.

| | |
| --- | --- |
| Source | https://github.com/Leonxlnx/taste-skill/tree/main/skills/taste-skill |
| Raw | https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/skills/taste-skill/SKILL.md |
| Upstream commit | [`3c7017d`](https://github.com/Leonxlnx/taste-skill/blob/3c7017d636c3a4aad378433ea6d0cfa6c921da4a/skills/taste-skill/SKILL.md) |
| Retrieved | 2026-08-22 |
| Verified against upstream | 2026-08-27, when `main` still pointed at the same bytes |
| sha256, upstream | `aa194351b246b8b4799099d4ed7b033d29eab6e6e3d58d8d2172978be7b3ec89` |
| sha256, this copy | `30987722d8fa1dd28daa9a1cec4ec172bb17ca9e268bda7835c1ac6b5cd4a580` |
| Bytes, upstream | 87253 |
| Bytes, this copy | 87658 |

`SKILL.md` is upstream plus an eight line `## Project override` section inserted
after the frontmatter. Nothing else differs, which the 405 byte delta accounts for.

The override says that for any file under `src/app/t/`, `src/features/` or
`src/ui/`, `DESIGN.md` at the repo root is dominant and overrides every rule below
it; that the rules govern the marketing page and the share view only; and that the hero
discipline rules and the marketing page ban list do not apply inside the app shell.

To refresh: re-download, re-apply the override, update the hashes above, and read the
diff before accepting, since these are standing instructions.

`.claude/skills/design-taste-frontend` is a symlink to this folder, which is how
Claude Code finds it.

## Scope warning

The skill declares itself for **landing pages, portfolios and redesigns, and says it is
not for dashboards, data tables or multi-step product UI**. plan2go is application UI
end to end and already has `DESIGN.md` as its source of truth. That is the conflict
the override exists to settle. Do not let this skill govern the app shell.
