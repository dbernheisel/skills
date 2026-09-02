# WebM export and GitHub attachment

Use this workflow when the user asks for a video of an SVG animation or wants
animation evidence attached to a pull request.

## Render a WebM

The renderer records the SVG in Chromium, then trims the capture to one
animation cycle:

```bash
./scripts/render-webm.mjs animation.svg animation.webm
```

It estimates duration from finite SMIL timing and CSS animations. Pass an
explicit duration for infinite loops, event-driven sequences, or JavaScript
whose end cannot be inferred:

```bash
./scripts/render-webm.mjs animation.svg animation.webm --duration 4
```

Options:

- `--duration SECONDS`: recording duration; overrides detection.
- `--width PIXELS` and `--height PIXELS`: video dimensions; defaults to
  1280×720.
- `--force`: overwrite an existing output file.

Requirements:

- Node.js
- FFmpeg on `PATH`
- The local Playwright dependency and Chromium browser:

```bash
npm install --prefix /path/to/visualize-svg
npx --prefix /path/to/visualize-svg playwright install chromium
```

Keep WebM rendering optional. Do not install dependencies unless the user asks
for video export and installing them is authorized.

## Attach to a GitHub pull request

Uploading changes external state. Only attach after the user has requested or
approved the upload. Confirm the selected repository and PR before acting.

First verify that the installed GitHub CLI exposes attachment support:

```bash
gh pr edit --help | grep -- --attach
gh pr comment --help | grep -- --attach
```

Append the video to the PR description without replacing its existing body:

```bash
gh pr edit PR_NUMBER --attach ./animation.webm
```

Attach it to a new review comment:

```bash
gh pr comment PR_NUMBER --body "Animation preview" --attach ./animation.webm
```

Use `--repo OWNER/REPO` when the current directory does not unambiguously select
the intended repository. If `--attach` is unavailable, report that the installed
`gh` release is too old; do not substitute an undocumented upload endpoint.

After uploading, return the PR URL and say whether the video was added to the
description or to a comment. A partial attachment failure may still update the
PR; inspect the command output before retrying so the same video is not attached
twice.
