# Atelier on the TV — user guide

This guide covers Atelier **1.3.1**. For installation, see `README.md`.

## Open it

Open **Atelier** from the TV's app list, or from a paired computer:

```powershell
ares-launch -d <device> com.atelier.gallery
```

Atelier is a normal app. It does not replace the LG Home screen.

## The gallery

After 45 seconds without input, every icon, label, clock, caption, plaque, and
scrim disappears. In Full Screen the painting fills the screen; in Framed the
painting stays inside its white frame. Each painting holds for a full minute, then
dissolves into the next over about two and a half seconds. The next painting is
decoded before the dissolve starts, so there is no black screen or flash between
paintings.

The picture is never panned, zoomed, tinted, or filtered. Only the change from one
painting to the next animates.

## The remote

| Button | What happens |
|---|---|
| **Up** on the home screen | Start the gallery immediately |
| **Enter** on the artwork | Start the gallery |
| **Left / Right** on the artwork | Previous / next painting |
| **Up** in the gallery | Hold the painting in view; press Up again to resume |
| **Left / Right** in the gallery | Change paintings and stay in the gallery |
| **Down** in the gallery | Bring the home screen and dock back, with the dock focused |
| **Another key** in the gallery | Leave the gallery and resume the slideshow |
| **Down** on the home screen | Move focus to the dock |
| **Enter** on the dock | Open that app, or the input list |
| **Arrows** in Display | Choose Full Screen or Framed; Right on Framed opens the finish tile |
| **Enter** in Display | Apply the chosen mode or finish |
| **Back** | Close a panel, or step back to the dock |
| **1 9 1 1** | Show a small diagnostics card |

Up holding the picture cancels the next automatic change and its preload. A second
Up resumes the one-minute slideshow from that painting with a fresh interval. Any
other key wakes the interface and also resumes rotation. Holding Up down does not
toggle the hold repeatedly.

## The dock

The dock has **11 entertainment slots on the left**, a thin divider, then
**Inputs, All Apps, Display, and Settings** on the far right.

With no usage recorded, the entertainment slots are Live TV, HBO Max, Disney+,
Netflix, Prime Video, Peacock, Paramount+, Hulu, Apple TV, YouTube, and Plex. As you
open entertainment apps from Atelier, the bar rearranges so the most-used app is
furthest left. An app outside the bar replaces the least-used bar app only once its
count is strictly higher; the displaced app stays in All Apps and can return.

**Usage is counted only when you open an app from Atelier** — the dock, All Apps, or
Live TV through Inputs. LG does not let a third-party app see launches from the TV's
own Home screen, so those launches do not affect the bar. The usage record is kept
on the TV, is never sent over the network, and is erased if Atelier is removed or its
data is cleared. There is no account or profile attached to it.

All Apps holds **26 entries**: 18 entertainment apps in alphabetical order, then
Browser, LG Content Store, Screen Share, Game Optimizer, Home Dashboard, Inputs,
Atelier Display, and LG Settings. Seven more entertainment apps — Apple Music,
fuboTV, LG Channels, Spotify, TikTok, Tubi, and VUDU — are available there and can
rise into the bar.

Inputs opens a list for Live TV and HDMI 1–4. **Plex** points at the separately
installed PlxNative client by default; this repository does not install it. See
`README.md` and `APP-IDS.md` if your Plex app has a different ID. If a dock app does
not open, its ID may differ on your TV.

## Display

Open the **Display** gear on the dock (or **Atelier Display** in All Apps). This is
Atelier's own setting, not LG Settings.

- **Full Screen** — the art fills the screen. Default on a fresh install.
- **Framed** — one wide, seamless white frame around the painting. Press Right on
  the Framed row to preview **Modern White**; press Enter to apply it. Because the
  frame opening is slightly wider than 16:9, a few percent of the top and bottom is
  trimmed so the art reaches the frame on every side. Switching modes does not
  restart the slideshow.
- **Restore Stock LG TV** — a two-step request to open the LG Home. It does not
  uninstall apps or change TV settings.

Mode and finish are remembered across panel closes, reloads, and app restarts.

The frame finish is painted on screen, not a physical bezel. It is a CSS recreation
of the look of Samsung's Modern White add-on frame; the TV's own black bezel remains
underneath, and the color will differ slightly from real hardware. Samsung has not
reviewed, sponsored, or endorsed Atelier.

## Look and feel

The dock and the Inputs, All Apps, and Display panels use a translucent
liquid-glass material: the painting behind them shows through, softly blurred and
warmed, with a bright edge like real glass. When the app goes idle, all chrome
disappears; Full Screen shows the bare painting and Framed keeps the painting and
its frame.

## Honest limits

- LG's app surface is 1080p even on a 4K TV. The paintings are stored at 4K and the
  TV scales them; some plates come from scans narrower than 4K and were enlarged,
  so they cannot contain detail the original scan did not have.
- Developer Mode expires after a while. Atelier keeps working; only reinstalling or
  debugging needs a fresh pairing.
- The dock learns only from Atelier launches.
- Plex is supplied by a separate, unofficial client, if you choose to install one.
  This project is not affiliated with Plex, PlxNative, LG, Samsung, or any streaming
  service.
- Atelier cannot be the TV's Home screen. That would require unsupported
  modifications, which are not part of this project.

## If something looks wrong

- **Artwork stays black** — wait a few seconds; there is a recovery timeout. If it
  persists, reopen Atelier.
- **A dock app does not open** — the app ID may differ on your TV. Nothing is
  damaged; see `APP-IDS.md`.
- **Art looks soft** — that plate came from a smaller source scan. See
  `ART-CREDITS.md`.
- **Nothing responds** — press Back to exit, then reopen Atelier. If needed,
  power-cycle the TV with the remote.

## Remove Atelier

```powershell
ares-install -r com.atelier.gallery -d <device>
```

That removes the app and its local data. To close developer access too, use the TV's
**Developer Mode** app after removing Atelier. Do not factory reset the TV.
