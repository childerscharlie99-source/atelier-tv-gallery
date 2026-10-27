# APP-IDS — dock, All Apps, and input mappings

Atelier opens apps through LG's public application manager using the IDs below.
They are common US webOS IDs, not universal constants: a different model, region, or
firmware may use a different ID for the same service.

Edit `app/js/config.js` to change an ID, then rebuild. Never uninstall another app
to "fix" an ID.

## Dock (15 slots: 11 entertainment + 4 fixed system)

The order below is the **base priority** — what you see when no usage has been
recorded. At runtime the entertainment slots reorder by use; the four system items
never move.

| Label | App ID / action |
|---|---|
| Live TV | `com.webos.app.livetv` |
| HBO Max | `com.wbd.stream` |
| Disney+ | `com.disney.disneyplus-prod` |
| Netflix | `netflix` |
| Prime Video | `amazon` |
| Peacock | `com.peacock.tv` |
| Paramount+ | `com.cbs-all-access.webapp.prod` |
| Hulu | `hulu` |
| Apple TV | `com.apple.appletv` |
| YouTube | `youtube.leanback.v4` |
| Plex | `com.beb.plxnative` (fallback `cdp-30`) |
| Inputs | in-app input picker |
| All Apps | in-app library overlay |
| Display | in-app Atelier Display panel |
| Settings | `com.palm.app.settings` (fallback `com.webos.app.settings`) |

### Entertainment promotion pool

These seven apps are in All Apps and can rise into the bar once their recorded use
is strictly higher than the least-used bar app:

| Label | App ID |
|---|---|
| Apple Music | `com.apple.applemusic` |
| fuboTV | `com.fubotv.app` |
| LG Channels | `com.webos.app.lgchannels` |
| Spotify | `spotify-beehive` |
| TikTok | `com.tiktok.app.tv` |
| Tubi | `com.tubitv.ott.tubi` |
| VUDU | `vudu` |

When counts tie, the base-priority tail decides: Apple Music, fuboTV, LG Channels,
Spotify, TikTok, Tubi, VUDU. All Apps uses its own alphabetical order instead.

## All Apps library (26 items)

**Entertainment (18, alphabetical):**

1. Apple Music — `com.apple.applemusic`
2. Apple TV — `com.apple.appletv`
3. Disney+ — `com.disney.disneyplus-prod`
4. fuboTV — `com.fubotv.app`
5. HBO Max — `com.wbd.stream`
6. Hulu — `hulu`
7. LG Channels — `com.webos.app.lgchannels`
8. Live TV — `com.webos.app.livetv`
9. Netflix — `netflix`
10. Paramount+ — `com.cbs-all-access.webapp.prod`
11. Peacock — `com.peacock.tv`
12. Plex — `com.beb.plxnative` (fallback `cdp-30`)
13. Prime Video — `amazon`
14. Spotify — `spotify-beehive`
15. TikTok — `com.tiktok.app.tv`
16. Tubi — `com.tubitv.ott.tubi`
17. VUDU — `vudu`
18. YouTube — `youtube.leanback.v4`

**Utilities (8, configured order):**

19. Browser — `com.webos.app.browser`
20. LG Content Store — `com.webos.app.discovery`
21. Screen Share — `com.webos.app.miracast`
22. Game Optimizer — `com.webos.app.gameoptimizer`
23. Home Dashboard — `com.webos.app.homeconnect`
24. Inputs — in-app input picker
25. Atelier Display — in-app Display panel
26. LG Settings — `com.palm.app.settings` (fallback `com.webos.app.settings`)

Icons: the sixteen entertainment entries use 1024×1024 App Store artwork that
`tools/fetch-icons.js` downloads locally. LG Channels and the system entries use
Atelier's own wide SVG tiles. An app in both the dock and All Apps uses the same
icon file.

## Dock ranking and usage

- **Store:** `localStorage["atelier.dockUsage"]`, versioned as
  `{"v":1,"apps":{"appId":{"count":N,"last":epochMs}}}`. TV-local only. Removing or
  clearing the app resets it. There is no reset UI.
- **What counts:** a launch initiated from the dock, an All Apps tile, or Live TV in
  the Inputs list. The count increments before the launch attempt and rolls back if
  every attempt fails. Settings, Inputs/HDMI, Display, All Apps, and other utilities
  never count.
- **Keying:** the primary `appId` is recorded; a fallback ID resolves to the same
  record. Live TV counts whether opened from the dock or Inputs.
- **Ranking:** count descending, then base-priority ascending. The top 11
  entertainment entries occupy the bar.
- **Overflow:** an outside app must have a **strictly higher count** than the
  least-used bar app. Equal counts keep the incumbent. A displaced app remains in All
  Apps and can return later.
- **Refresh:** at boot, when Atelier becomes visible again, when waking from idle,
  about 1.5 s after a launch if Atelier stays visible, and every 60 s while visible.
  The bar rebuilds only if the order changed; focus is preserved by app identity.
- **Limit:** LG denies third-party apps `listApps`, `listLaunchPoints`, and
  `getForegroundAppInfo`. Atelier cannot see apps opened from the LG Home screen.

## Input picker

| Label | App ID |
|---|---|
| Live TV (Antenna) | `com.webos.app.livetv` |
| HDMI 1 | `com.webos.app.hdmi1` |
| HDMI 2 | `com.webos.app.hdmi2` |
| HDMI 3 | `com.webos.app.hdmi3` |
| HDMI 4 | `com.webos.app.hdmi4` |

## Launch behavior

For each item the app tries, in order:

1. `luna://com.webos.applicationManager` `launch` with `{ id }`.
2. `luna://com.webos.service.applicationmanager` `launch` with `{ id }`.
3. Any `fallbackAppIds` entries.

Per-item `params` are merged into `{ id }` when present. A toast appears only if
every attempt fails. While a launch is pending, further launch presses are ignored.

## Checking an ID on your TV

The application manager's public launch call is the only one a third-party app can
make reliably. From a paired computer:

```powershell
ares-launch -d <device> netflix
```

A working ID returns `Launched application netflix` (and the TV switches to it). An
unknown ID returns `not exist`. That is how to confirm an ID before editing
`config.js`. Remember that this launches the app on your TV. If you do not want to
launch it, compare against the TV's own app inventory if your firmware exposes it,
or try the fallback ID in the config.

## Plex

The Plex tile defaults to **PlxNative** (`com.beb.plxnative`), an unofficial,
separately maintained native Plex client, with `cdp-30` as a fallback. Neither is
bundled by this repository, and Atelier is not affiliated with Plex or PlxNative. If
your TV has a different Plex app, set its ID here. You sign in to Plex inside that
app; Atelier never sees your credentials.
