# 5 Metre Scrum — Weekly Blog Automation Workflow (Phase 3 Design)

Goal: one SEO-optimised article drafted and published automatically every
week, with the target keyword pulled from your keyword spreadsheet.

## ⚠️ Prerequisite (blocking)
The live Netlify site is currently a manual drag-and-drop upload,
**disconnected from the `azvoma/5m-Scrum` GitHub repo**. Automation can only
publish by committing to a repo that Netlify actually builds from. So before
any automation goes live: Netlify dashboard → your site → Site configuration
→ Build & deploy → Link repository → select `azvoma/5m-Scrum`. Once linked,
every commit deploys automatically — this also permanently fixes the stale-
deploy problem.

## Recommended platform: n8n
n8n (cloud from ~€20/mo, or free self-hosted) over Make/Zapier because it has
first-class Anthropic, GitHub and Google Sheets nodes, and handles the
multi-step logic (pick keyword → generate → validate → commit → mark done)
in one visual canvas.

## Data source
Move the keyword spreadsheet into a Google Sheet (one-off import of
`export_research_keyword_manager_276309_16_gbp.xlsx`) and add three columns:
`status` (empty / QUEUED / PUBLISHED), `article_url`, `published_date`.
Google Sheets beats the raw xlsx here because the workflow must *write back*
status after each run — much simpler than round-tripping an Excel file.

## The workflow, node by node

1. **Schedule Trigger** — Cron: every Monday 07:00 UK.
2. **Google Sheets: read rows** — filter `status is empty`, sort by
   Difficulty ascending (easiest wins first), take row 1. If no rows left →
   Slack/email "keyword list exhausted" and stop.
3. **Anthropic (Claude) node — outline pass** — prompt includes: target
   keyword, search intent column, the site's article HTML conventions
   (h2/h3, stat-callout, table.data, TOC block), internal-link menu (list of
   existing article URLs + scout board + onboarding), and the Yoast rules
   (keyphrase in title/H1/first paragraph, meta title ≤60 chars, meta
   description ≤156 chars, 1,500–2,500 words, keyphrase density 0.5–1.5%).
   Output: JSON outline + meta title + meta description.
4. **Anthropic (Claude) node — full draft** — takes the outline, writes the
   complete article body HTML including TOC, FAQ section, image-placeholder
   figures with final alt text, and internal links. Instructed to include
   NO fabricated statistics, reviews, or named individuals.
5. **Code node — template merge & validation** — injects the body into the
   blog article shell (same one used for all current articles), fills
   Article/BreadcrumbList/FAQPage JSON-LD, then validates: HTML parses,
   word count in range, keyword present in title/H1/first paragraph, meta
   lengths OK. Any failure → route to step 8b instead of publishing.
6. **GitHub node — commit** — creates `blog/<slug>.html`, updates
   `blog.html` (insert card at top of grid) and `sitemap.xml`, commits to
   `main` with message `auto: weekly article — <keyword>`.
7. **Netlify** — no node needed: the repo link from the prerequisite means
   the commit itself triggers the deploy.
8. **Google Sheets: update row** — set `status=PUBLISHED`, `article_url`,
   `published_date`.
   **8b (failure branch):** open a GitHub *pull request* instead of
   committing to main, and notify you for manual review.
9. **Notification** — email/Slack: "Published: <title> → <url>" with the
   meta title/description for a quick eyeball.

## Human-in-the-loop option (recommended for the first month)
Swap step 6 to always open a PR rather than commit to main. You review and
merge from your phone; Netlify deploys on merge. After a few weeks of clean
output, switch to direct commit.

## Keyword → article mapping for the current sheet
Already assigned (see conversation): the 16 keywords cover the 7 live
articles plus 9 future weekly slots (world rugby jobs, rugby union players,
rugby team numbers, male rugby player, world rugby careers, rugby player,
skills in rugby, rugby recruitment uk as a standalone UK piece, coach rugby
variant). At one per week the current sheet is ~9 weeks of runway; top up
the sheet and the automation keeps going without changes.

## Cost estimate per article
One outline + one draft call ≈ £0.15–£0.40 in API usage at current Sonnet
pricing; n8n cloud starter covers the volume comfortably. Total ≈ under
£25/month all-in.
