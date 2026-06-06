# shadcn/ui primitives

This folder holds shadcn/ui components. They are NOT in source control on
purpose — they're generated on first build and pinned by `components.json`.

After cloning, run:

```bash
bun install
bunx shadcn@latest add \
  accordion alert aspect-ratio avatar badge breadcrumb button calendar card \
  carousel checkbox collapsible command context-menu dialog drawer \
  dropdown-menu input label menubar navigation-menu progress radio-group \
  resizable scroll-area select separator sheet skeleton switch table textarea \
  toggle