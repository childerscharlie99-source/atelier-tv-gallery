/*
 * Atelier — local configuration.
 *
 * Everything here is editable in a text editor. To change the dock, edit the
 * objects below and rebuild with `ares-package`; nothing on the TV is modified
 * except the Atelier app itself.
 *
 * App IDs are the LG webOS IDs. The defaults below are the common US app IDs;
 * if an app has a different ID on this TV, replace it here and rebuild.
 */
window.ATELIER_CONFIG = {
  version: "1.3.1",

  // Art rotation while the screen is in use, and while it is idle. Each plate
  // holds for a full minute, then dissolves into the next over 2.5 seconds.
  // The next plate is decoded four seconds before the dissolve begins.
  rotateSeconds: 60,
  crossfadeMs: 2500,
  preloadLeadMs: 4000,
  idleAfterSeconds: 45,
  coverHoldMs: 900,
  startIndex: 0,

  // Atelier's own display mode, separate from the LG Settings app.
  displayDefault: "full",

  // Picture-frame finish for Framed mode. The CSS geometry and material for
  // each id live in css/frames.css; keep the ids in step with that file.
  frameDefault: "modern-white",
  frames: [
    { id: "modern-white", label: "Modern White", note: "Satin white · The Frame" }
  ],

  plates: [
    { slug: "among-the-sierra-nevada", title: "Among the Sierra Nevada, California", artist: "Albert Bierstadt", year: "1868" },
    { slug: "looking-down-yosemite-valley", title: "Looking Down Yosemite Valley, California", artist: "Albert Bierstadt", year: "1865" },
    { slug: "storm-in-the-rocky-mountains-mt-rosalie", title: "A Storm in the Rocky Mountains, Mt. Rosalie", artist: "Albert Bierstadt", year: "1866" },
    { slug: "mount-corcoran", title: "Mount Corcoran", artist: "Albert Bierstadt", year: "c. 1876-1877" },
    { slug: "valley-of-the-yosemite", title: "Valley of the Yosemite", artist: "Albert Bierstadt", year: "1864" },
    { slug: "merced-river-yosemite-valley", title: "Merced River, Yosemite Valley", artist: "Albert Bierstadt", year: "1866" },
    { slug: "yosemite-valley-glacier-point-trail", title: "Yosemite Valley, Glacier Point Trail", artist: "Albert Bierstadt", year: "c. 1873" },
    { slug: "sunrise-yosemite-valley", title: "Sunrise, Yosemite Valley", artist: "Albert Bierstadt", year: "c. 1870" },
    { slug: "the-rocky-mountains-landers-peak", title: "The Rocky Mountains, Lander's Peak", artist: "Albert Bierstadt", year: "1863" },
    { slug: "the-coming-storm", title: "The Coming Storm", artist: "Albert Bierstadt", year: "1869" },
    { slug: "valley-of-the-catawissa-in-autumn", title: "Valley of the Catawissa in Autumn", artist: "Thomas Moran", year: "c. 1862" },
    { slug: "the-golden-hour", title: "The Golden Hour", artist: "Thomas Moran", year: "1875" },
    { slug: "the-three-tetons", title: "The Three Tetons", artist: "Thomas Moran", year: "1895" },
    { slug: "emerald-bay-lake-tahoe", title: "Emerald Bay, Lake Tahoe", artist: "Thomas Hill", year: "1864" },
    { slug: "crawford-notch", title: "Crawford Notch", artist: "Thomas Hill", year: "1872" },
    { slug: "mount-tallac-from-lake-tahoe", title: "Mount Tallac from Lake Tahoe", artist: "Thomas Hill", year: "1880" },
    { slug: "twilight-in-the-wilderness", title: "Twilight in the Wilderness", artist: "Frederic Edwin Church", year: "1860" },
    { slug: "lower-falls-rochester", title: "Lower Falls, Rochester", artist: "Frederic Edwin Church", year: "1849" },
    { slug: "mt-jefferson-pinkham-notch", title: "Mt. Jefferson, Pinkham Notch, White Mountains", artist: "Jasper Francis Cropsey", year: "1857" },
    { slug: "sunset-after-a-storm-catskills", title: "Sunset after a Storm in the Catskill Mountains", artist: "Jasper Francis Cropsey", year: "c. 1860" },
    { slug: "lake-george", title: "Lake George", artist: "John Frederick Kensett", year: "1869" },
    { slug: "waterfall-and-rocks-near-lake-george", title: "Waterfall and Rocks Near Lake George", artist: "John Frederick Kensett", year: "1872" },
    { slug: "notch-of-the-white-mountains", title: "A View of the Mountain Pass Called the Notch of the White Mountains (Crawford Notch)", artist: "Thomas Cole", year: "1839" },
    { slug: "the-hunters-return", title: "The Hunter's Return", artist: "Thomas Cole", year: "1845" },
    { slug: "forest-scene-in-the-catskills", title: "Forest Scene in the Catskills", artist: "Asher Brown Durand", year: "1855" },
    { slug: "wilderness", title: "Wilderness", artist: "Sanford Robinson Gifford", year: "1860" },
    { slug: "delaware-water-gap", title: "Delaware Water Gap", artist: "George Inness", year: "1857" },
    { slug: "sentinel-rock-yosemite", title: "Sentinel Rock, Yosemite", artist: "William Keith", year: "1872" },
    { slug: "trout-brook-in-the-catskills", title: "Trout Brook in the Catskills", artist: "Worthington Whittredge", year: "1875" },
    { slug: "adirondack-lake", title: "Adirondack Lake", artist: "Alexander Helwig Wyant", year: "c. 1869" }
  ],

  // The 11 entertainment tiles set the zero-usage bar order.  The 4 system
  // tiles stay fixed on the right.  Runtime usage can replace entertainment
  // tiles but never the system group.
  dock: [
    {
      label: "Live TV",
      icon: "assets/icons/live-tv.svg",
      appId: "com.webos.app.livetv",
      group: "entertainment"
    },
    {
      label: "HBO Max",
      icon: "assets/icons/ios/hbo.png",
      iconStyle: "ios",
      appId: "com.wbd.stream",
      group: "entertainment"
    },
    {
      label: "Disney+",
      icon: "assets/icons/ios/disney-plus.png",
      iconStyle: "ios",
      appId: "com.disney.disneyplus-prod",
      group: "entertainment"
    },
    {
      label: "Netflix",
      icon: "assets/icons/ios/netflix.png",
      iconStyle: "ios",
      appId: "netflix",
      group: "entertainment"
    },
    {
      label: "Prime Video",
      icon: "assets/icons/ios/prime-video.png",
      iconStyle: "ios",
      appId: "amazon",
      group: "entertainment"
    },
    {
      label: "Peacock",
      icon: "assets/icons/ios/peacock.png",
      iconStyle: "ios",
      appId: "com.peacock.tv",
      group: "entertainment"
    },
    {
      label: "Paramount+",
      icon: "assets/icons/ios/paramount-plus.png",
      iconStyle: "ios",
      appId: "com.cbs-all-access.webapp.prod",
      group: "entertainment"
    },
    {
      label: "Hulu",
      icon: "assets/icons/ios/hulu.png",
      iconStyle: "ios",
      appId: "hulu",
      group: "entertainment"
    },
    {
      label: "Apple TV",
      icon: "assets/icons/ios/apple-tv.png",
      iconStyle: "ios",
      appId: "com.apple.appletv",
      group: "entertainment"
    },
    {
      label: "YouTube",
      icon: "assets/icons/ios/youtube.png",
      iconStyle: "ios",
      appId: "youtube.leanback.v4",
      group: "entertainment"
    },
    {
      label: "Plex",
      icon: "assets/icons/ios/plex.png",
      iconStyle: "ios",
      appId: "com.beb.plxnative",
      fallbackAppIds: ["cdp-30"],
      group: "entertainment"
    },
    {
      label: "Inputs",
      icon: "assets/icons/inputs.svg",
      action: "inputs",
      group: "system"
    },
    {
      label: "All Apps",
      icon: "assets/icons/all-apps.svg",
      action: "allapps",
      group: "system"
    },
    {
      label: "Display",
      icon: "assets/icons/display.svg",
      action: "display",
      group: "system"
    },
    {
      label: "Settings",
      icon: "assets/icons/settings.svg",
      appId: "com.palm.app.settings",
      fallbackAppIds: ["com.webos.app.settings"],
      group: "system"
    }
  ],

  // The catalog holds 26 entries.  The first 18 are entertainment in dock
  // base-priority order (the current 11, then the seven overflow candidates);
  // All Apps displays those 18 alphabetically, then the 8 utilities below in
  // this order.  `entertainment: true` marks a tile that can occupy the dock.
  // Only IDs already established for this TV are listed; no IDs are invented.
  catalog: [
    {
      label: "Live TV",
      icon: "assets/icons/live-tv.svg",
      appId: "com.webos.app.livetv",
      entertainment: true
    },
    {
      label: "HBO Max",
      icon: "assets/icons/ios/hbo.png",
      iconStyle: "ios",
      appId: "com.wbd.stream",
      entertainment: true
    },
    {
      label: "Disney+",
      icon: "assets/icons/ios/disney-plus.png",
      iconStyle: "ios",
      appId: "com.disney.disneyplus-prod",
      entertainment: true
    },
    {
      label: "Netflix",
      icon: "assets/icons/ios/netflix.png",
      iconStyle: "ios",
      appId: "netflix",
      entertainment: true
    },
    {
      label: "Prime Video",
      icon: "assets/icons/ios/prime-video.png",
      iconStyle: "ios",
      appId: "amazon",
      entertainment: true
    },
    {
      label: "Peacock",
      icon: "assets/icons/ios/peacock.png",
      iconStyle: "ios",
      appId: "com.peacock.tv",
      entertainment: true
    },
    {
      label: "Paramount+",
      icon: "assets/icons/ios/paramount-plus.png",
      iconStyle: "ios",
      appId: "com.cbs-all-access.webapp.prod",
      entertainment: true
    },
    {
      label: "Hulu",
      icon: "assets/icons/ios/hulu.png",
      iconStyle: "ios",
      appId: "hulu",
      entertainment: true
    },
    {
      label: "Apple TV",
      icon: "assets/icons/ios/apple-tv.png",
      iconStyle: "ios",
      appId: "com.apple.appletv",
      entertainment: true
    },
    {
      label: "YouTube",
      icon: "assets/icons/ios/youtube.png",
      iconStyle: "ios",
      appId: "youtube.leanback.v4",
      entertainment: true
    },
    {
      label: "Plex",
      icon: "assets/icons/ios/plex.png",
      iconStyle: "ios",
      appId: "com.beb.plxnative",
      fallbackAppIds: ["cdp-30"],
      entertainment: true
    },
    {
      label: "Apple Music",
      icon: "assets/icons/ios/apple-music.png",
      iconStyle: "ios",
      appId: "com.apple.applemusic",
      entertainment: true
    },
    {
      label: "fuboTV",
      icon: "assets/icons/ios/fubotv.png",
      iconStyle: "ios",
      appId: "com.fubotv.app",
      entertainment: true
    },
    {
      label: "LG Channels",
      icon: "assets/icons/lg-channels.svg",
      appId: "com.webos.app.lgchannels",
      entertainment: true
    },
    {
      label: "Spotify",
      icon: "assets/icons/ios/spotify.png",
      iconStyle: "ios",
      appId: "spotify-beehive",
      entertainment: true
    },
    {
      label: "TikTok",
      icon: "assets/icons/ios/tiktok.png",
      iconStyle: "ios",
      appId: "com.tiktok.app.tv",
      entertainment: true
    },
    {
      label: "Tubi",
      icon: "assets/icons/ios/tubi.png",
      iconStyle: "ios",
      appId: "com.tubitv.ott.tubi",
      entertainment: true
    },
    {
      label: "VUDU",
      icon: "assets/icons/ios/vudu.png",
      iconStyle: "ios",
      appId: "vudu",
      entertainment: true
    },
    {
      label: "Browser",
      icon: "assets/icons/browser.svg",
      appId: "com.webos.app.browser"
    },
    {
      label: "LG Content Store",
      icon: "assets/icons/content-store.svg",
      appId: "com.webos.app.discovery"
    },
    {
      label: "Screen Share",
      icon: "assets/icons/screen-share.svg",
      appId: "com.webos.app.miracast"
    },
    {
      label: "Game Optimizer",
      icon: "assets/icons/game-optimizer.svg",
      appId: "com.webos.app.gameoptimizer"
    },
    {
      label: "Home Dashboard",
      icon: "assets/icons/home-dashboard.svg",
      appId: "com.webos.app.homeconnect"
    },
    {
      label: "Inputs",
      icon: "assets/icons/inputs.svg",
      action: "inputs"
    },
    {
      label: "Atelier Display",
      icon: "assets/icons/display.svg",
      action: "display"
    },
    {
      label: "LG Settings",
      icon: "assets/icons/settings.svg",
      appId: "com.palm.app.settings",
      fallbackAppIds: ["com.webos.app.settings"]
    }
  ],

  inputs: [
    { label: "Live TV", detail: "Antenna", appId: "com.webos.app.livetv" },
    { label: "HDMI 1",  detail: "Input",  appId: "com.webos.app.hdmi1" },
    { label: "HDMI 2",  detail: "Input",  appId: "com.webos.app.hdmi2" },
    { label: "HDMI 3",  detail: "Input",  appId: "com.webos.app.hdmi3" },
    { label: "HDMI 4",  detail: "Input",  appId: "com.webos.app.hdmi4" }
  ],

  // Used only by the in-app verification card. LG's applicationManager can
  // drift between the camel-case and lower-case service names.
  applicationManagerUris: [
    "luna://com.webos.applicationManager",
    "luna://com.webos.service.applicationmanager"
  ],

  // Type 1911 while the gallery is showing to open the verification card.
  diagnosticsSequence: "1911"
};
