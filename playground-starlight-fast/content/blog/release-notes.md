---
title: Release Notes
date: 2026-01-10
description: What's new in this version of the Starlight recipe for Litro.
tags:
  - posts
  - release
---

## Starlight Recipe 0.1.0

The first release of the Starlight recipe for Litro. This scaffolds a fully static docs and blog site with Starlight's design system, implemented entirely as Lit web components.

### What's New

**Layout components**

- `<starlight-page>` — three-column grid layout (sidebar | content | TOC)
- `<starlight-header>` — top navigation with dark/light mode toggle
- `<starlight-sidebar>` — grouped navigation with active-item highlighting
- `<starlight-toc>` — table of contents extracted from headings

**UI components**

- `<sl-card>` and `<sl-card-grid>` — feature cards for the splash page
- `<sl-badge>` — inline color-coded chips (note, tip, caution, danger)
- `<sl-aside>` — callout boxes with icons and colored borders
- `<sl-tabs>` and `<sl-tab-item>` — tabbed content sections

**CSS design system**

All colors, fonts, and spacing are defined as `--sl-*` custom properties in `public/styles/starlight.css`. Override any token to customize the theme.

**Dark mode**

A FOUC-free theme toggle that reads/writes `localStorage` and sets `data-theme` on `<html>`. Implemented as a synchronous inline script in `<head>`.

**Content layer**

Docs and blog content live under `content/`. The Litro content layer scans Markdown files, parses frontmatter, renders HTML, and exposes everything via the `litro:content` virtual module.

### Breaking Changes

None — this is the initial release.
