# Facebook Page publishing (CreatorOS marketing)

`marketing/publisher/facebook.mjs` posts the content-factory videos to the
CreatorOS Facebook Page (Reels for 9:16 cuts, page video for the rest) and can
schedule them from `content-calendar.csv`. This doc covers getting a token and
the day-to-day commands.

## What you need

- Admin access to the Facebook Page (`61595342349784` — Ridhyansh Tech Infra).
- A Meta app (free) at <https://developers.facebook.com/apps>.

## 1. Create the app

1. <https://developers.facebook.com/apps> → **Create app** → use case
   **Other** → type **Business**.
2. Give it a name (e.g. "CreatorOS Publisher") and pick the business portfolio.
3. In **App settings → Basic**, note nothing yet; you only need the app to mint
   long-lived page tokens.

## 2. Grant permissions in the Graph API Explorer

1. Open <https://developers.facebook.com/tools/explorer/>.
2. Top-right **Meta App** → select the app you just made.
3. **Permissions** → add all of these:
   - `pages_show_list`
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `pages_read_user_content`
4. **Generate Access Token** → log in and allow the page.
5. Copy the short user token.

## 3. Exchange for a long-lived Page token

Short user tokens die in ~1 hour. Do this once in a browser (replace
`<KEY>`, `<SECRET>`, `<USER_TOKEN>` — app key/secret are in App settings → Basic):

1. Long-lived user token:
   ```
   https://graph.facebook.com/v23.0/oauth/access_token?grant_type=fb_exchange_token&client_id=<KEY>&client_secret=<SECRET>&fb_exchange_token=<USER_TOKEN>
   ```
   → copy `access_token`.
2. Page token from the long-lived user token:
   ```
   https://graph.facebook.com/v23.0/me/accounts?access_token=<LONG_LIVED_USER_TOKEN>
   ```
   → find the page with `"id": "61595342349784"` and copy its `access_token`.
   This Page token does not expire (it only dies if you change the password,
   revoke the app, or the underlying user token is invalidated).

## 4. Store it

Put both values in `marketing/publisher/.env` (gitignored):

```
FB_PAGE_ID=61595342349784
FB_PAGE_TOKEN=EAAG...
# FB_GRAPH_VERSION=v23.0   (optional)
```

## 5. Verify

```bash
node marketing/publisher/facebook.mjs whoami
```
Should print the page name, id, followers and the Graph version.

## Commands

| Command | What it does |
|---|---|
| `plan` | List the calendar's Facebook slots and whether each is posted |
| `whoami` | Confirm the token/page |
| `upload --next [--state draft]` | Post the next pending slot's video |
| `upload --date 2026-10-22` | Post a specific day's slots |
| `upload --all` | Post every pending slot |
| `upload --all --schedule` | Create each as a scheduled post at its calendar date/time |
| `upload --file <mp4> [--kind video] [--caption "..."]` | Post a single file |
| `test --file creatoros-hook-9x16.mp4` | One-off check upload |
| `post --message "..." [--link <url>]` | Plain text/link post |
| `delete --id <postId[,id]>` \| `--all` | Remove posts (also forgets them in `.fb-uploads.json`) |
| `stats` | Page followers + last 10 posts |

Add `--dry` to any `upload`/`delete` to preview.

## Scheduling rules

- `--schedule` uses the calendar's `date`/`time` (local time → Unix) as
  `scheduled_publish_time`. Meta requires it to be **10 minutes to 75 days** in
  the future, otherwise the API rejects the post.
- `--state draft` keeps the post unpublished (visible only to page admins).
- Default (no flags) publishes immediately.

## Notes

- Posts are recorded in `marketing/publisher/.fb-uploads.json` (gitignored) so
  `plan` can show what's already gone out.
- A Reel upload is two Graph calls plus the binary upload; the feed path is a
  single multipart POST.
- Verify baked posts appear under the page's **Reels** tab/timeline; a Reel can
  take a minute to finish processing.
