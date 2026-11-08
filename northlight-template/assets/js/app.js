/* ==========================================================================
   Northlight storefront — app.js
   Plain-JS behaviour, no framework, no build step.

   Contains:
     1. Demo data
     2. Small helpers
     3. Feed rendering (accordion list + "load more" paging)
     4. Announcement dismissal
     5. Dropdown menus — moved to menu.js (shared with other pages)
     6. Cart counter + detail dialog
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------ 1. Demo data ---------------------------- */

  // Every field here is invented placeholder content for the template.
  var DROPS = window.NL_DROPS || [
    {
      title: "Aurora UI Kit",
      creator: "studio-north",
      category: "Interface kit",
      formats: "Figma, Sketch, SVG",
      license: "Single team licence",
      refund: "14 days",
      price: 48,
      daysAgo: 0,
      time: "16:48",
      blurb:
        "A 180-component interface kit with light and dark themes, 12 page templates and a documented token set.",
    },
    {
      title: "Field Notes Icon Pack",
      creator: "inkwell",
      category: "Icons",
      formats: "SVG, PNG, IconJar",
      license: "Unlimited projects",
      refund: "7 days",
      price: 19,
      daysAgo: 0,
      time: "15:20",
      blurb:
        "620 hand-drawn line icons on a 24px grid, with editable strokes and an IconJar library.",
    },
    {
      title: "Meridian Type Family",
      creator: "typeworks",
      category: "Typefaces",
      formats: "OTF, WOFF2",
      license: "Desktop + web",
      refund: "14 days",
      price: 65,
      daysAgo: 0,
      time: "14:05",
      blurb:
        "A six-weight grotesque with matching italics, tabular figures and 400+ glyphs per style.",
    },
    {
      title: "Signal Dashboard Template",
      creator: "studio-north",
      category: "Templates",
      formats: "Figma, React",
      license: "Single team licence",
      refund: "14 days",
      price: 39,
      daysAgo: 0,
      time: "12:30",
      blurb:
        "Forty analytic screens \u2014 tables, charts, empty states and filters \u2014 wired to a mock data layer.",
    },
    {
      title: "Paper Workshop Textures",
      creator: "paper-co",
      category: "Textures",
      formats: "TIFF, PNG",
      license: "Commercial use",
      refund: "7 days",
      price: 12,
      daysAgo: 0,
      time: "11:02",
      blurb:
        "Sixty scanned paper surfaces at 6000px, from cold press to heavily grained kraft.",
    },
    {
      title: "Lo-fi Drum Sessions Vol. 2",
      creator: "lo-fi-lab",
      category: "Audio",
      formats: "WAV, Ableton",
      license: "Royalty-free",
      refund: "Not eligible",
      price: 24,
      daysAgo: 0,
      time: "10:15",
      blurb:
        "One hundred dusty drum loops and one-shots recorded to tape, tempo-tagged and key-labelled.",
    },
    {
      title: "Cartographer Maps Set",
      creator: "atlas-maps",
      category: "Print",
      formats: "AI, SVG, PDF",
      license: "Commercial use",
      refund: "14 days",
      price: 28,
      daysAgo: 0,
      time: "09:41",
      blurb:
        "Eighteen vintage-style map plates with editable coastlines, contour lines and graticules.",
    },
    {
      title: "Northlight Starter Bundle",
      creator: "northlight",
      category: "Bundles",
      formats: "Figma, SVG, OTF",
      license: "Single team licence",
      refund: "30 days",
      price: 89,
      daysAgo: 1,
      time: "18:22",
      blurb:
        "The best-selling kit, icon set and type family together, at roughly a third off buying them apart.",
    },
    {
      title: "Grid Systems Poster Set",
      creator: "monoprint",
      category: "Print",
      formats: "PDF, AI",
      license: "Personal + client",
      refund: "14 days",
      price: 22,
      daysAgo: 1,
      time: "17:05",
      blurb:
        "Twelve Swiss-inspired poster layouts on a 12-column grid, ready to print at A2.",
    },
    {
      title: "Verdant 3D Props",
      creator: "verdant",
      category: "3D assets",
      formats: "Blender, OBJ, GLB",
      license: "Commercial use",
      refund: "14 days",
      price: 34,
      daysAgo: 1,
      time: "15:48",
      blurb:
        "Ninety low-poly plants, pots and studio props with baked materials and clean UVs.",
    },
    {
      title: "Quiet Gradients",
      creator: "quiethours",
      category: "Presets",
      formats: "ASE, Sketch, Figma",
      license: "Unlimited projects",
      refund: "7 days",
      price: 9,
      daysAgo: 1,
      time: "13:12",
      blurb:
        "Two hundred and forty muted gradient swatches built for editorial layouts.",
    },
    {
      title: "Notebook Writing Template",
      creator: "paper-co",
      category: "Templates",
      formats: "Notion, Obsidian",
      license: "Personal use",
      refund: "Not eligible",
      price: 6,
      daysAgo: 1,
      time: "11:37",
      blurb:
        "A linked notes system for essays and research, with a reading queue and source tracker.",
    },
    {
      title: "Halftone Portrait Brushes",
      creator: "halftone",
      category: "Brushes",
      formats: "ABR, Procreate",
      license: "Commercial use",
      refund: "7 days",
      price: 15,
      daysAgo: 1,
      time: "10:04",
      blurb:
        "Forty-eight bitmap halftone and stipple brushes at print resolution.",
    },
    {
      title: "Ledger Finance Icons",
      creator: "inkwell",
      category: "Icons",
      formats: "SVG, IconJar",
      license: "Unlimited projects",
      refund: "7 days",
      price: 21,
      daysAgo: 1,
      time: "08:55",
      blurb:
        "Three hundred finance and fintech icons in outline, filled and duotone weights.",
    },
    {
      title: "Cassette Player Mockups",
      creator: "pixel-lab",
      category: "Mockups",
      formats: "PSD, Figma",
      license: "Commercial use",
      refund: "14 days",
      price: 18,
      daysAgo: 2,
      time: "19:30",
      blurb:
        "Six photoreal cassette and walkman mockups with editable labels and screen layers.",
    },
    {
      title: "Northlight Everything Pack",
      creator: "northlight",
      category: "Bundles",
      formats: "Figma, SVG, OTF, WAV",
      license: "Single team licence",
      refund: "30 days",
      price: 249,
      daysAgo: 2,
      time: "16:14",
      blurb:
        "The full catalogue, current and future, on one licence with priority support included.",
    },
    {
      title: "Slate Code Theme Pack",
      creator: "northfield",
      category: "Code",
      formats: "VS Code, Sublime",
      license: "Unlimited projects",
      refund: "Not eligible",
      price: 11,
      daysAgo: 2,
      time: "14:26",
      blurb:
        "Six low-contrast editor themes with matching terminal palettes and diff colours.",
    },
    {
      title: "Studio Lighting LUTs",
      creator: "quiethours",
      category: "Presets",
      formats: "CUBE, 3DL",
      license: "Commercial use",
      refund: "7 days",
      price: 16,
      daysAgo: 2,
      time: "12:02",
      blurb:
        "Thirty film-emulation LUTs balancing skin tones under tungsten, daylight and mixed light.",
    },
    {
      title: "Nordic Photo Set",
      creator: "atlas-maps",
      category: "Photos",
      formats: "JPG, RAW",
      license: "Editorial + commercial",
      refund: "14 days",
      price: 42,
      daysAgo: 2,
      time: "10:48",
      blurb:
        "One hundred and twenty landscape frames from the Norwegian coast, full-resolution RAW included.",
    },
    {
      title: "Chalk Line Font Duo",
      creator: "typeworks",
      category: "Typefaces",
      formats: "OTF, TTF",
      license: "Desktop + web",
      refund: "14 days",
      price: 38,
      daysAgo: 2,
      time: "09:15",
      blurb:
        "A hand-chalked display face paired with a clean supporting sans, 300 glyphs each.",
    },
    {
      title: "Motion Presets for After Effects",
      creator: "pixel-lab",
      category: "Presets",
      formats: "AEP, JSX",
      license: "Commercial use",
      refund: "14 days",
      price: 27,
      daysAgo: 3,
      time: "20:10",
      blurb:
        "Ninety drag-and-drop transitions, text reveals and camera moves with adjustable timing.",
    },
    {
      title: "Atlas Icon Suite",
      creator: "inkwell",
      category: "Icons",
      formats: "SVG, JSON",
      license: "Unlimited projects",
      refund: "7 days",
      price: 34,
      daysAgo: 3,
      time: "17:44",
      blurb:
        "One thousand six hundred icons across twelve categories, with a searchable JSON index.",
    },
    {
      title: "Editorial Layout Kit",
      creator: "monoprint",
      category: "Templates",
      formats: "InDesign, Figma",
      license: "Single team licence",
      refund: "14 days",
      price: 44,
      daysAgo: 3,
      time: "15:02",
      blurb:
        "Twenty-four magazine spreads with baseline grids, running heads and folio styles.",
    },
    {
      title: "Ambient Loop Library",
      creator: "lo-fi-lab",
      category: "Audio",
      formats: "WAV",
      license: "Royalty-free",
      refund: "Not eligible",
      price: 29,
      daysAgo: 3,
      time: "13:35",
      blurb:
        "Two hours of seamless ambient beds for video, podcasts and installations.",
    },
    {
      title: "Terrain Height Maps",
      creator: "verdant",
      category: "3D assets",
      formats: "EXR, PNG",
      license: "Commercial use",
      refund: "14 days",
      price: 37,
      daysAgo: 3,
      time: "11:20",
      blurb:
        "Sixteen 8K terrain height maps with matching normal and splat masks.",
    },
    {
      title: "Poster Grain Textures",
      creator: "paper-co",
      category: "Textures",
      formats: "PNG, TIFF",
      license: "Commercial use",
      refund: "7 days",
      price: 14,
      daysAgo: 3,
      time: "10:05",
      blurb:
        "Eighty risograph grain overlays that tile seamlessly at any scale.",
    },
    {
      title: "Wireframe Starter Kit",
      creator: "studio-north",
      category: "Interface kit",
      formats: "Figma",
      license: "Single team licence",
      refund: "14 days",
      price: 23,
      daysAgo: 3,
      time: "08:40",
      blurb:
        "A component-first wireframe library with auto-layout forms, tables and navigation blocks.",
    },
    {
      title: "Risograph Brush Pack",
      creator: "halftone",
      category: "Brushes",
      formats: "ABR, Procreate",
      license: "Commercial use",
      refund: "7 days",
      price: 17,
      daysAgo: 4,
      time: "18:52",
      blurb:
        "Misregistered ink brushes that mimic two-colour riso printing, with paper-noise tips.",
    },
    {
      title: "Wordmark Logos Vol. 1",
      creator: "northfield",
      category: "Templates",
      formats: "AI, SVG",
      license: "Commercial use",
      refund: "14 days",
      price: 31,
      daysAgo: 4,
      time: "16:30",
      blurb:
        "Sixty editable wordmark lockups with kerning pairs already dialled in.",
    },
    {
      title: "Soft Studio Mockups",
      creator: "pixel-lab",
      category: "Mockups",
      formats: "PSD, Figma",
      license: "Commercial use",
      refund: "14 days",
      price: 26,
      daysAgo: 4,
      time: "14:18",
      blurb:
        "Twelve fabric and paper mockups lit with softboxes, each with a smart-object workflow.",
    },
    {
      title: "Night Drive Synth Patches",
      creator: "lo-fi-lab",
      category: "Audio",
      formats: "WAV, Serum",
      license: "Royalty-free",
      refund: "Not eligible",
      price: 21,
      daysAgo: 4,
      time: "12:04",
      blurb:
        "Eighty warm synth patches and matching one-shots for Serum and any sampler.",
    },
    {
      title: "Minimal Calendar System",
      creator: "paper-co",
      category: "Templates",
      formats: "Notion, PDF",
      license: "Personal use",
      refund: "Not eligible",
      price: 8,
      daysAgo: 4,
      time: "10:22",
      blurb:
        "A weekly planning system with printable sheets and a matching Notion database.",
    },
    {
      title: "Long Shadow 3D Icons",
      creator: "inkwell",
      category: "Icons",
      formats: "SVG, PNG",
      license: "Unlimited projects",
      refund: "7 days",
      price: 25,
      daysAgo: 4,
      time: "09:10",
      blurb:
        "Four hundred dimensional icons rendered at 512px, with flat SVG fallbacks.",
    },
    {
      title: "Blender Material Library",
      creator: "verdant",
      category: "3D assets",
      formats: "Blend, GLB",
      license: "Commercial use",
      refund: "14 days",
      price: 46,
      daysAgo: 5,
      time: "19:44",
      blurb:
        "Two hundred procedural materials \u2014 wood, concrete, glass, fabric \u2014 with one-click setup.",
    },
    {
      title: "Retro Terminal Font",
      creator: "typeworks",
      category: "Typefaces",
      formats: "OTF, WOFF2",
      license: "Desktop + web",
      refund: "14 days",
      price: 33,
      daysAgo: 5,
      time: "17:12",
      blurb:
        "A monospaced display face with sharp corners, full case and a box-drawing set.",
    },
    {
      title: "Grid Overlay Pack",
      creator: "monoprint",
      category: "Print",
      formats: "SVG, PDF",
      license: "Personal + client",
      refund: "14 days",
      price: 13,
      daysAgo: 5,
      time: "15:35",
      blurb:
        "Layered baseline and column overlays for proofing layouts at any trim size.",
    },
    {
      title: "Drone Noise Textures",
      creator: "paper-co",
      category: "Textures",
      formats: "PNG, TIFF",
      license: "Commercial use",
      refund: "7 days",
      price: 16,
      daysAgo: 5,
      time: "13:04",
      blurb:
        "Forty soft noise fields generated from field recordings, seamless and tileable.",
    },
    {
      title: "Product Page UI Kit",
      creator: "studio-north",
      category: "Interface kit",
      formats: "Figma",
      license: "Single team licence",
      refund: "14 days",
      price: 41,
      daysAgo: 5,
      time: "11:26",
      blurb:
        "Sixteen e-commerce templates covering product, cart, checkout and confirmation screens.",
    },
    {
      title: "Hand Sketch Brushes",
      creator: "halftone",
      category: "Brushes",
      formats: "ABR, Procreate",
      license: "Commercial use",
      refund: "7 days",
      price: 12,
      daysAgo: 5,
      time: "10:12",
      blurb:
        "Thirty-two pencil, ink and marker brushes that scale smoothly at large canvas sizes.",
    },
    {
      title: "Field Recording Pack",
      creator: "lo-fi-lab",
      category: "Audio",
      formats: "WAV",
      license: "Royalty-free",
      refund: "Not eligible",
      price: 19,
      daysAgo: 5,
      time: "08:48",
      blurb:
        "Four hundred location recordings \u2014 rain, crowds, machinery \u2014 normalised and labelled.",
    },
    {
      title: "Editorial Icon Set",
      creator: "inkwell",
      category: "Icons",
      formats: "SVG, IconJar",
      license: "Unlimited projects",
      refund: "7 days",
      price: 22,
      daysAgo: 6,
      time: "18:30",
      blurb:
        "Two hundred and forty icons drawn for print, with a thinner 1.25px stroke variant.",
    },
    {
      title: "Vintage Label Templates",
      creator: "monoprint",
      category: "Templates",
      formats: "AI, PDF",
      license: "Commercial use",
      refund: "14 days",
      price: 27,
      daysAgo: 6,
      time: "16:06",
      blurb:
        "Forty packaging label layouts with editable ornaments and CMYK swatches.",
    },
    {
      title: "Isometric City Kit",
      creator: "verdant",
      category: "3D assets",
      formats: "Blend, OBJ",
      license: "Commercial use",
      refund: "14 days",
      price: 52,
      daysAgo: 6,
      time: "14:40",
      blurb:
        "Six hundred isometric building blocks, vehicles and street props with consistent scale.",
    },
    {
      title: "Serif Display Duo",
      creator: "typeworks",
      category: "Typefaces",
      formats: "OTF, TTF",
      license: "Desktop + web",
      refund: "14 days",
      price: 44,
      daysAgo: 6,
      time: "12:18",
      blurb:
        "A high-contrast display serif with a small caps companion for headings and covers.",
    },
    {
      title: "Film Emulation LUTs",
      creator: "quiethours",
      category: "Presets",
      formats: "CUBE",
      license: "Commercial use",
      refund: "7 days",
      price: 24,
      daysAgo: 6,
      time: "10:30",
      blurb:
        "Twenty-four LUTs matched to classic film stocks, with warm and cool variants.",
    },
    {
      title: "Studio Grid Template",
      creator: "studio-north",
      category: "Templates",
      formats: "Figma",
      license: "Single team licence",
      refund: "14 days",
      price: 36,
      daysAgo: 6,
      time: "08:22",
      blurb:
        "A flexible eight-column studio grid with responsive breakpoints and spacing tokens.",
    },
    {
      title: "Layered Paper Cutouts",
      creator: "paper-co",
      category: "Textures",
      formats: "PSD, TIFF",
      license: "Commercial use",
      refund: "7 days",
      price: 18,
      daysAgo: 4,
      time: "08:15",
      blurb:
        "Forty scanned paper cutouts on transparent layers, ready to stack into depth.",
    },
    {
      title: "Monospace Terminal Duo",
      creator: "northfield",
      category: "Typefaces",
      formats: "OTF, WOFF2",
      license: "Desktop + web",
      refund: "14 days",
      price: 29,
      daysAgo: 4,
      time: "07:20",
      blurb:
        "A two-weight monospace with coding ligatures and a hinted 12px master.",
    },
    {
      title: "Slate Mobile Kit",
      creator: "studio-north",
      category: "Interface kits",
      formats: "Figma, Sketch",
      license: "Single team licence",
      refund: "14 days",
      price: 52,
      daysAgo: 5,
      time: "07:55",
      blurb:
        "Ninety mobile screens across onboarding, checkout and account settings.",
    },
    {
      title: "Dust and Grain Frames",
      creator: "quiethours",
      category: "Presets",
      formats: "XMP, CUBE",
      license: "Commercial use",
      refund: "7 days",
      price: 14,
      daysAgo: 5,
      time: "06:40",
      blurb:
        "Eighteen film-grain and dust overlays tuned for high-ISO archive scans.",
    },
    {
      title: "Museum Label Templates",
      creator: "monoprint",
      category: "Templates",
      formats: "InDesign",
      license: "Single team licence",
      refund: "14 days",
      price: 24,
      daysAgo: 6,
      time: "07:35",
      blurb:
        "Exhibition label grids for wall cards, captions and catalogue spreads.",
    },
    {
      title: "Wet Ink Brush Library",
      creator: "halftone",
      category: "Brushes",
      formats: "ABR, PNG",
      license: "Commercial use",
      refund: "7 days",
      price: 17,
      daysAgo: 6,
      time: "06:50",
      blurb:
        "Sixty pressure-sensitive ink brushes with wet edges and dry-brush variants.",
    },
    {
      title: "Transit Sign Icons",
      creator: "inkwell",
      category: "Icons",
      formats: "SVG, PDF",
      license: "Unlimited projects",
      refund: "7 days",
      price: 23,
      daysAgo: 7,
      time: "20:10",
      blurb:
        "Two hundred and forty wayfinding icons on a 20px grid, stroke and solid.",
    },
    {
      title: "Aurora Motion Presets",
      creator: "pixel-lab",
      category: "Presets",
      formats: "AEP, JSX",
      license: "Commercial use",
      refund: "14 days",
      price: 31,
      daysAgo: 7,
      time: "18:40",
      blurb:
        "Camera pushes, parallax reveals and eased transitions for short-form video.",
    },
    {
      title: "Coastal Aerial Photos",
      creator: "atlas-maps",
      category: "Photos",
      formats: "JPG, RAW",
      license: "Editorial + commercial",
      refund: "14 days",
      price: 56,
      daysAgo: 7,
      time: "17:05",
      blurb:
        "Ninety aerial frames of coastline and harbour, corrected and catalogued.",
    },
    {
      title: "Brand Grid Workbook",
      creator: "studio-north",
      category: "Templates",
      formats: "Figma, PDF",
      license: "Single team licence",
      refund: "14 days",
      price: 34,
      daysAgo: 7,
      time: "15:30",
      blurb:
        "A workbook for laying out brand systems: grids, spacing scales and type ramps.",
    },
    {
      title: "Resin Print Textures",
      creator: "paper-co",
      category: "Textures",
      formats: "PNG",
      license: "Commercial use",
      refund: "7 days",
      price: 12,
      daysAgo: 7,
      time: "13:12",
      blurb:
        "Thirty-two resin and riso print textures at 6K, tileable where it matters.",
    },
    {
      title: "Findings Sans",
      creator: "typeworks",
      category: "Typefaces",
      formats: "OTF, TTF",
      license: "Desktop + web",
      refund: "14 days",
      price: 47,
      daysAgo: 7,
      time: "11:40",
      blurb:
        "A neutral grotesque in five weights with tabular figures and small caps.",
    },
    {
      title: "Drum Machine Sessions",
      creator: "lo-fi-lab",
      category: "Audio",
      formats: "WAV",
      license: "Royalty-free",
      refund: "Not eligible",
      price: 26,
      daysAgo: 7,
      time: "09:05",
      blurb:
        "One hundred and twenty one-bar drum loops across four tempos, dry and processed.",
    },
    {
      title: "Warehouse 3D Props",
      creator: "verdant",
      category: "3D assets",
      formats: "Blender",
      license: "Commercial use",
      refund: "14 days",
      price: 39,
      daysAgo: 8,
      time: "19:15",
      blurb:
        "Forty industrial props modelled to scale, with PBR materials and clean UVs.",
    },
    {
      title: "Dashboard Chart Kit",
      creator: "studio-north",
      category: "Interface kits",
      formats: "Figma",
      license: "Single team licence",
      refund: "14 days",
      price: 44,
      daysAgo: 8,
      time: "16:44",
      blurb:
        "Twelve chart types with light and dark states plus empty and loading variants.",
    },
    {
      title: "Poster Type Specimens",
      creator: "monoprint",
      category: "Print",
      formats: "PDF, InDesign",
      license: "Single team licence",
      refund: "14 days",
      price: 28,
      daysAgo: 8,
      time: "14:20",
      blurb:
        "Eighteen poster layouts built around specimen type, with crop marks ready.",
    },
    {
      title: "Quiet Room Impulses",
      creator: "lo-fi-lab",
      category: "Audio",
      formats: "WAV",
      license: "Royalty-free",
      refund: "Not eligible",
      price: 21,
      daysAgo: 8,
      time: "11:50",
      blurb:
        "Room and hall impulse responses for scoring, from a booth to a stone church.",
    },
    {
      title: "Field Guide Icons",
      creator: "inkwell",
      category: "Icons",
      formats: "SVG, IconJar",
      license: "Unlimited projects",
      refund: "7 days",
      price: 19,
      daysAgo: 8,
      time: "09:30",
      blurb:
        "Three hundred and ten nature and weather icons, drawn on a 24px grid.",
    },
    {
      title: "Studio Portrait LUTs",
      creator: "quiethours",
      category: "Presets",
      formats: "CUBE",
      license: "Commercial use",
      refund: "7 days",
      price: 22,
      daysAgo: 9,
      time: "18:05",
      blurb:
        "Twenty LUTs for skin tones under tungsten, softbox and window light.",
    },
    {
      title: "Clipboard Utility UI",
      creator: "northfield",
      category: "Code",
      formats: "React, CSS",
      license: "Commercial use",
      refund: "14 days",
      price: 33,
      daysAgo: 9,
      time: "15:38",
      blurb:
        "A copy-to-clipboard component set with tokens, stories and a dark theme.",
    },
    {
      title: "Paper Model Mockups",
      creator: "pixel-lab",
      category: "Mockups",
      formats: "PSD",
      license: "Commercial use",
      refund: "14 days",
      price: 27,
      daysAgo: 9,
      time: "13:02",
      blurb:
        "Packaging and print mockups on matte paper, with editable shadows.",
    },
    {
      title: "Harbour Photo Set",
      creator: "atlas-maps",
      category: "Photos",
      formats: "JPG",
      license: "Editorial + commercial",
      refund: "14 days",
      price: 38,
      daysAgo: 9,
      time: "10:26",
      blurb:
        "One hundred and ten harbour and dock frames shot at first light.",
    },
    {
      title: "Rounded Icon Starter",
      creator: "inkwell",
      category: "Icons",
      formats: "SVG, Sketch",
      license: "Unlimited projects",
      refund: "7 days",
      price: 15,
      daysAgo: 9,
      time: "08:12",
      blurb:
        "A rounded icon set of 280 glyphs with a matching favicon build.",
    },
    {
      title: "Editorial Type Slab",
      creator: "typeworks",
      category: "Typefaces",
      formats: "OTF",
      license: "Desktop + web",
      refund: "14 days",
      price: 41,
      daysAgo: 10,
      time: "19:22",
      blurb:
        "A slab serif in four weights with an extended display cut and alternates.",
    },
    {
      title: "Product Launch Deck",
      creator: "monoprint",
      category: "Templates",
      formats: "Keynote, PPTX",
      license: "Single team licence",
      refund: "14 days",
      price: 36,
      daysAgo: 10,
      time: "16:10",
      blurb:
        "Forty slide layouts for launch decks, with charts, tables and dividers.",
    },
    {
      title: "Vinyl Sleeve Mockups",
      creator: "pixel-lab",
      category: "Mockups",
      formats: "PSD, JPG",
      license: "Commercial use",
      refund: "14 days",
      price: 24,
      daysAgo: 10,
      time: "13:44",
      blurb:
        "Twelve record sleeve mockups with sleeve textures and shrink-wrap variants.",
    },
    {
      title: "Grid Poster Textures",
      creator: "paper-co",
      category: "Textures",
      formats: "TIFF",
      license: "Commercial use",
      refund: "7 days",
      price: 11,
      daysAgo: 10,
      time: "11:18",
      blurb:
        "Twenty-four scanned newsprint and grid overlays for measured print work.",
    },
    {
      title: "Foley Toolkit Vol. 1",
      creator: "lo-fi-lab",
      category: "Audio",
      formats: "WAV",
      license: "Royalty-free",
      refund: "Not eligible",
      price: 32,
      daysAgo: 10,
      time: "08:40",
      blurb:
        "Three hundred foley hits — cloth, glass, paper, metal — recorded at 96kHz.",
    },
    {
      title: "Orbit UI Add-ons",
      creator: "studio-north",
      category: "Interface kits",
      formats: "Figma",
      license: "Single team licence",
      refund: "14 days",
      price: 29,
      daysAgo: 11,
      time: "18:34",
      blurb:
        "Extras for the Orbital kit: command palette, toast stack and empty states.",
    },
    {
      title: "Sketchbook Brushes",
      creator: "halftone",
      category: "Brushes",
      formats: "ABR",
      license: "Commercial use",
      refund: "7 days",
      price: 13,
      daysAgo: 11,
      time: "15:12",
      blurb:
        "Forty pencil and graphite brushes tuned for sketch thumbnails.",
    },
    {
      title: "Static Site Starter",
      creator: "northfield",
      category: "Code",
      formats: "HTML, CSS, JS",
      license: "Commercial use",
      refund: "Not eligible",
      price: 25,
      daysAgo: 11,
      time: "12:48",
      blurb:
        "A dependency-free starter with accessible components and dark mode.",
    },
    {
      title: "Tide Pool Photos",
      creator: "atlas-maps",
      category: "Photos",
      formats: "JPG, RAW",
      license: "Editorial + commercial",
      refund: "14 days",
      price: 46,
      daysAgo: 11,
      time: "10:04",
      blurb:
        "Sixty macro frames of tide pools, focus-stacked and colour matched.",
    },
    {
      title: "Layered Shadow Icons",
      creator: "verdant",
      category: "Icons",
      formats: "SVG, Figma",
      license: "Unlimited projects",
      refund: "7 days",
      price: 20,
      daysAgo: 11,
      time: "08:26",
      blurb:
        "Two hundred layered icons with soft shadow variants and a toggle state.",
    },
    {
      title: "Archive Poster Set",
      creator: "monoprint",
      category: "Print",
      formats: "PDF",
      license: "Single team licence",
      refund: "14 days",
      price: 30,
      daysAgo: 11,
      time: "07:10",
      blurb:
        "Twenty archive-inspired poster layouts with gridded type and duotone blocks.",
    },
    {
      title: "Harbour Type Duo",
      creator: "southern-cross",
      category: "Typefaces",
      formats: "OTF, WOFF2",
      license: "Unlimited projects",
      refund: "14 days",
      price: 42,
      daysAgo: 1,
      time: "08:00",
      blurb:
        "Two friendly grotesques drawn for signage, with five weights each and a variable file.",
    },
    {
      title: "Coastal Colour Presets",
      creator: "southern-cross",
      category: "Presets",
      formats: "CUBE, XMP",
      license: "Single team licence",
      refund: "7 days",
      price: 18,
      daysAgo: 2,
      time: "09:07",
      blurb:
        "Twenty-four grade presets built from Sydney beach light, in Lightroom and Resolve formats.",
    },
    {
      title: "Transit Icon Set",
      creator: "southern-cross",
      category: "Icons",
      formats: "SVG, Figma",
      license: "Unlimited projects",
      refund: "14 days",
      price: 26,
      daysAgo: 3,
      time: "10:14",
      blurb:
        "340 wayfinding and transit icons on a 24px grid, with stroke and filled variants.",
    },
    {
      title: "Tide Pool Textures",
      creator: "reef-lab",
      category: "Textures",
      formats: "TIFF, PNG",
      license: "Single seat",
      refund: "7 days",
      price: 22,
      daysAgo: 4,
      time: "11:21",
      blurb:
        "Sixty scanned water and rock textures at 6K, tileable and colour-corrected.",
    },
    {
      title: "Marine UI Kit",
      creator: "reef-lab",
      category: "Interface kits",
      formats: "Figma",
      license: "Single team licence",
      refund: "30 days",
      price: 54,
      daysAgo: 5,
      time: "12:28",
      blurb:
        "An ocean-themed dashboard kit: 96 components, dark mode, charts and map cards.",
    },
    {
      title: "Field Recorder WAVs",
      creator: "reef-lab",
      category: "Audio",
      formats: "WAV",
      license: "Unlimited projects",
      refund: "14 days",
      price: 31,
      daysAgo: 6,
      time: "13:35",
      blurb:
        "Ninety minutes of surf, rain and harbour ambience recorded on a 32-bit field kit.",
    },
    {
      title: "Carnival Display Family",
      creator: "tropic-type",
      category: "Typefaces",
      formats: "OTF, TTF",
      license: "Single team licence",
      refund: "14 days",
      price: 58,
      daysAgo: 1,
      time: "14:42",
      blurb:
        "A high-contrast display face in six styles, with alternates built for posters.",
    },
    {
      title: "Samba Rhythm Loops",
      creator: "tropic-type",
      category: "Audio",
      formats: "WAV, REX",
      license: "Unlimited projects",
      refund: "7 days",
      price: 24,
      daysAgo: 2,
      time: "15:49",
      blurb:
        "180 percussion loops played live, tempo-labelled and pre-cut to the bar.",
    },
    {
      title: "São Paulo Grid Kit",
      creator: "tropic-type",
      category: "Templates",
      formats: "Figma, IDML",
      license: "Unlimited projects",
      refund: "30 days",
      price: 36,
      daysAgo: 3,
      time: "16:56",
      blurb:
        "Editorial grids for magazines and reports: 18 spreads, baseline grid included.",
    },
    {
      title: "Beach Poster Kit",
      creator: "viva-lab",
      category: "Print",
      formats: "PSD, PDF",
      license: "Single seat",
      refund: "14 days",
      price: 27,
      daysAgo: 4,
      time: "17:03",
      blurb:
        "Twelve layered poster comps at A2 with editable duotone and grain layers.",
    },
    {
      title: "Tropical Icon Library",
      creator: "viva-lab",
      category: "Icons",
      formats: "SVG, AI",
      license: "Unlimited projects",
      refund: "7 days",
      price: 19,
      daysAgo: 5,
      time: "18:10",
      blurb:
        "280 line icons for travel and food brands, drawn on a 2px stroke at 24px.",
    },
    {
      title: "Carioca Motion Pack",
      creator: "viva-lab",
      category: "Presets",
      formats: "AEP, MOGRT",
      license: "Single team licence",
      refund: "14 days",
      price: 44,
      daysAgo: 6,
      time: "08:17",
      blurb:
        "Thirty After Effects and Premiere transitions, all drives and durations exposed.",
    },
    {
      title: "Devanagari Type Pair",
      creator: "indigo-ink",
      category: "Typefaces",
      formats: "OTF, WOFF2",
      license: "Unlimited projects",
      refund: "14 days",
      price: 39,
      daysAgo: 1,
      time: "09:24",
      blurb:
        "A Latin and Devanagari pair with matched x-height and 6 weights, hinted for screen.",
    },
    {
      title: "Monsoon Photo Set",
      creator: "indigo-ink",
      category: "Photos",
      formats: "RAW, JPEG",
      license: "Single seat",
      refund: "7 days",
      price: 33,
      daysAgo: 2,
      time: "10:31",
      blurb:
        "120 licensed photographs of monsoon light, delivered in 45MP RAW with sRGB previews.",
    },
    {
      title: "Bazaar Pattern Tiles",
      creator: "indigo-ink",
      category: "Textures",
      formats: "SVG, PNG",
      license: "Unlimited projects",
      refund: "14 days",
      price: 21,
      daysAgo: 3,
      time: "11:38",
      blurb:
        "Pattern tiles inspired by block printing, seamless at any size and print-ready.",
    },
    {
      title: "SaaS Dashboard Kit",
      creator: "lumen-works",
      category: "Interface kits",
      formats: "Figma",
      license: "Single team licence",
      refund: "30 days",
      price: 64,
      daysAgo: 4,
      time: "12:45",
      blurb:
        "A 140-screen analytics kit with tokens, empty states and light and dark themes.",
    },
    {
      title: "Icon Motion Set",
      creator: "lumen-works",
      category: "Icons",
      formats: "Lottie, GIF",
      license: "Unlimited projects",
      refund: "14 days",
      price: 29,
      daysAgo: 5,
      time: "13:52",
      blurb:
        "Ninety animated micro-icons exported to Lottie, GIF and MP4 at three sizes.",
    },
    {
      title: "Mobile UI Wireframes",
      creator: "lumen-works",
      category: "Templates",
      formats: "Figma, Sketch",
      license: "Single team licence",
      refund: "7 days",
      price: 23,
      daysAgo: 6,
      time: "14:59",
      blurb:
        "Two hundred mobile wireframe blocks, ready for prototyping on a 375pt grid.",
    },
    {
      title: "Safari Colour Palettes",
      creator: "kalahari-kit",
      category: "Presets",
      formats: "ASE, CLR",
      license: "Single seat",
      refund: "7 days",
      price: 16,
      daysAgo: 1,
      time: "15:06",
      blurb:
        "Forty earth-tone palettes pulled from landscape photographs, as swatch files.",
    },
    {
      title: "Longform Report Kit",
      creator: "kalahari-kit",
      category: "Templates",
      formats: "InDesign",
      license: "Single team licence",
      refund: "14 days",
      price: 45,
      daysAgo: 2,
      time: "16:13",
      blurb:
        "A 40-page annual report template with tables, charts and a cover system.",
    },
    {
      title: "Bushveld Textures",
      creator: "kalahari-kit",
      category: "Textures",
      formats: "PNG, TIFF",
      license: "Unlimited projects",
      refund: "14 days",
      price: 25,
      daysAgo: 3,
      time: "17:20",
      blurb:
        "Seventy dry grass, rock and dust overlays at 4K, seamless where needed.",
    },
    {
      title: "Code Theme Collection",
      creator: "cape-code",
      category: "Code",
      formats: "VS Code, Sublime",
      license: "Unlimited projects",
      refund: "7 days",
      price: 14,
      daysAgo: 4,
      time: "18:27",
      blurb:
        "Eight editor themes, light and dark, with matched terminal colours and icons.",
    },
    {
      title: "Developer Portfolio Kit",
      creator: "cape-code",
      category: "Templates",
      formats: "Figma, HTML",
      license: "Single team licence",
      refund: "30 days",
      price: 38,
      daysAgo: 5,
      time: "08:34",
      blurb:
        "A portfolio template in Figma and static HTML, with case-study and CV layouts.",
    },
    {
      title: "Syntax Poster Set",
      creator: "cape-code",
      category: "Print",
      formats: "PDF, SVG",
      license: "Unlimited projects",
      refund: "14 days",
      price: 20,
      daysAgo: 6,
      time: "09:41",
      blurb:
        "Six typographic posters built from code snippets, A3 and A2, print-ready.",
    },
    {
      title: "Desert Light LUTs",
      creator: "dune-works",
      category: "Presets",
      formats: "CUBE",
      license: "Single seat",
      refund: "7 days",
      price: 28,
      daysAgo: 1,
      time: "10:48",
      blurb:
        "Thirty colour LUTs for aerial and landscape footage, Rec.709 and LOG variants.",
    },
    {
      title: "Luxury Brand Kit",
      creator: "dune-works",
      category: "Templates",
      formats: "Figma, AI",
      license: "Single team licence",
      refund: "14 days",
      price: 52,
      daysAgo: 2,
      time: "11:55",
      blurb:
        "Identity templates for premium brands: cards, menus, signage and packaging grids.",
    },
    {
      title: "Arabic UI Kit",
      creator: "dune-works",
      category: "Interface kits",
      formats: "Figma",
      license: "Unlimited projects",
      refund: "30 days",
      price: 61,
      daysAgo: 3,
      time: "12:02",
      blurb:
        "Ninety RTL-first components with Arabic and Latin type scales and mirroring rules.",
    },
    {
      title: "Skyline Photo Pack",
      creator: "gulf-grid",
      category: "Photos",
      formats: "RAW, JPEG",
      license: "Single seat",
      refund: "14 days",
      price: 40,
      daysAgo: 4,
      time: "13:09",
      blurb:
        "Eighty long-exposure skylines at dusk, 60MP RAW, fully licensed.",
    },
    {
      title: "Finance Chart Kit",
      creator: "gulf-grid",
      category: "Interface kits",
      formats: "Figma",
      license: "Single team licence",
      refund: "30 days",
      price: 47,
      daysAgo: 5,
      time: "14:16",
      blurb:
        "Thirty chart and table components with number formats, dark mode and states.",
    },
    {
      title: "Presentation Deck System",
      creator: "gulf-grid",
      category: "Templates",
      formats: "PowerPoint, Keynote",
      license: "Single team licence",
      refund: "14 days",
      price: 34,
      daysAgo: 6,
      time: "15:23",
      blurb:
        "A deck system with 60 slides, master grids and chart placeholders.",
    },
    {
      title: "Iberian Type Family",
      creator: "tinta-viva",
      category: "Typefaces",
      formats: "OTF, WOFF2",
      license: "Unlimited projects",
      refund: "14 days",
      price: 49,
      daysAgo: 1,
      time: "16:30",
      blurb:
        "A serif and sans pair in seven weights, with Spanish accents and small caps.",
    },
    {
      title: "Editorial Photo Set",
      creator: "tinta-viva",
      category: "Photos",
      formats: "RAW, JPEG",
      license: "Single seat",
      refund: "7 days",
      price: 30,
      daysAgo: 2,
      time: "17:37",
      blurb:
        "Ninety photographs of Madrid streets and interiors, 45MP RAW.",
    },
    {
      title: "Ink Wash Brushes",
      creator: "tinta-viva",
      category: "Brushes",
      formats: "ABR, PNG",
      license: "Unlimited projects",
      refund: "14 days",
      price: 17,
      daysAgo: 3,
      time: "18:44",
      blurb:
        "Forty ink and wash brushes plus stamp sets, pressure-tested in Photoshop.",
    },
    {
      title: "Mediterranean Gradients",
      creator: "sol-y-mar",
      category: "Presets",
      formats: "ASE, FIG",
      license: "Single seat",
      refund: "7 days",
      price: 12,
      daysAgo: 4,
      time: "08:51",
      blurb:
        "Sixty gradient presets in swatch and Figma styles, warm through cool.",
    },
    {
      title: "Restaurant Menu Kit",
      creator: "sol-y-mar",
      category: "Templates",
      formats: "InDesign, AI",
      license: "Single team licence",
      refund: "14 days",
      price: 32,
      daysAgo: 5,
      time: "09:58",
      blurb:
        "Menu layouts for six venues with price-alignment and print marks.",
    },
    {
      title: "Coastal Icon Set",
      creator: "sol-y-mar",
      category: "Icons",
      formats: "SVG, Figma",
      license: "Unlimited projects",
      refund: "14 days",
      price: 20,
      daysAgo: 6,
      time: "10:05",
      blurb:
        "220 coastal and travel icons on a 24px grid, stroke and outline versions.",
    },
  ];

  // Drops are grouped into day sections; one "load more" reveals this many days.
  var DAYS_PER_PAGE = 3;

  /* ----------------------------- 2. Helpers ------------------------------- */

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function money(value) {
    return "$" + value.toFixed(2);
  }

  var ui = {
    feed: $("#feed"),
    loadMore: $("#loadMore"),
    dropCount: $("#dropCount"),
    cartCount: $("#cartCount"),
    cartBtn: $("#cartBtn"),
    noticeStack: $("#noticeStack"),
    dialog: $("#dropDialog"),
    dialogTitle: $("#dialogTitle"),
    dialogBody: $("#dialogBody"),
    accountBtn: $("#accountBtn"),
    accountMenu: $("#accountMenu"),
  };

  var state = {
    rendered: 0, // how many drops are currently in the DOM
    dayIndex: 0, // how many day sections have been rendered
    dropIndex: 0, // running index, used for the panel / heading ids
  };

  /* ---- grouping helpers ------------------------------------------------- */

  var WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function dayDate(daysAgo) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return d;
  }

  function shortDate(d) {
    return d.getDate() + " " + MONTH[d.getMonth()] + " " + d.getFullYear();
  }

  // Heading for one day: "Today" / "Yesterday" / "Wednesday", plus the date.
  function dayLabel(daysAgo) {
    var d = dayDate(daysAgo);
    var title;
    if (daysAgo === 0) title = "Today";
    else if (daysAgo === 1) title = "Yesterday";
    else title = WEEKDAY[d.getDay()];
    return { title: title, date: shortDate(d), full: WEEKDAY[d.getDay()] + ", " + shortDate(d) };
  }

  // "Today, 14:05" / "27 Oct 2026, 11:05" — shown in the detail dialog.
  function addedLabel(item) {
    var label = dayLabel(item.daysAgo);
    var prefix = item.daysAgo === 0 ? "Today" : item.daysAgo === 1 ? "Yesterday" : label.date;
    return prefix + ", " + item.time;
  }

  // Each studio lists from one country — the same map search.js uses — so a
  // drop can say where it ships from instead of which category it sits in.
  var DROP_COUNTRY = {
    "studio-north": "US",
    "inkwell": "GB",
    "typeworks": "NL",
    "paper-co": "GH",
    "lo-fi-lab": "NG",
    "atlas-maps": "KW",
    "northlight": "US",
    "monoprint": "DE",
    "verdant": "KE",
    "quiethours": "IS",
    "halftone": "JP",
    "pixel-lab": "KR",
    "northfield": "CA",
    "southern-cross": "AU",
    "reef-lab": "AU",
    "tropic-type": "BR",
    "viva-lab": "BR",
    "indigo-ink": "IN",
    "lumen-works": "IN",
    "kalahari-kit": "ZA",
    "cape-code": "ZA",
    "dune-works": "AE",
    "gulf-grid": "AE",
    "tinta-viva": "ES",
    "sol-y-mar": "ES",
  };

  var COUNTRY_NAME = {
    US: "United States",
    GB: "United Kingdom",
    NL: "Netherlands",
    GH: "Ghana",
    NG: "Nigeria",
    KW: "Kuwait",
    DE: "Germany",
    KE: "Kenya",
    IS: "Iceland",
    JP: "Japan",
    KR: "South Korea",
    CA: "Canada",
    AU: "Australia",
    BR: "Brazil",
    IN: "India",
    ZA: "South Africa",
    AE: "United Arab Emirates",
    ES: "Spain",
  };

  // Drops grouped by the day they were added, newest day first.
  var DAY_GROUPS = (function () {
    var byDay = {};
    var order = [];

    DROPS.forEach(function (item) {
      item.added = addedLabel(item);
      item.country = DROP_COUNTRY[item.creator] || "US";
      item.countryName = COUNTRY_NAME[item.country] || item.country;
      if (!byDay[item.daysAgo]) {
        byDay[item.daysAgo] = [];
        order.push(item.daysAgo);
      }
      byDay[item.daysAgo].push(item);
    });

    order.sort(function (a, b) {
      return a - b;
    });

    return order.map(function (daysAgo) {
      return { daysAgo: daysAgo, items: byDay[daysAgo] };
    });
  })();

  // solid triangle, like the reference: points down when closed, up when open
  var CHEVRON_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 16.4 5.6 8.6h12.8z"/></svg>';

  /* --------------------- 3. Feed rendering + accordion -------------------- */

  // Mini flags for the countries the feed ships from. They are inline SVG so
  // they render offline and in the sandboxed preview — no image requests, no
  // emoji font needed. Drawn into one 30×21 box so every flag is the same size.
  var FLAGS = window.NL_FLAGS || {
    US:
      '<rect width="30" height="21" fill="#fff"/>' +
      '<g fill="#c8102e"><rect y="0" width="30" height="3"/><rect y="6" width="30" height="3"/>' +
      '<rect y="12" width="30" height="3"/><rect y="18" width="30" height="3"/></g>' +
      '<rect width="13" height="9" fill="#1f3a6e"/>',
    GB:
      '<rect width="30" height="21" fill="#012169"/>' +
      '<path d="M0 0 30 21M30 0 0 21" stroke="#fff" stroke-width="5"/>' +
      '<path d="M0 0 30 21M30 0 0 21" stroke="#c8102e" stroke-width="2"/>' +
      '<path d="M15 0V21M0 10.5H30" stroke="#fff" stroke-width="7"/>' +
      '<path d="M15 0V21M0 10.5H30" stroke="#c8102e" stroke-width="3.6"/>',
    NL:
      '<rect width="30" height="21" fill="#fff"/>' +
      '<rect width="30" height="7" fill="#ae1c28"/><rect y="14" width="30" height="7" fill="#21468b"/>',
    GH:
      '<rect width="30" height="7" fill="#ce1126"/><rect y="7" width="30" height="7" fill="#fcd116"/>' +
      '<rect y="14" width="30" height="7" fill="#006b3f"/>' +
      '<path d="M15 7.6 16.1 10.6 19.2 10.7 16.7 12.6 17.6 15.6 15 13.9 12.4 15.6 13.3 12.6 10.8 10.7 13.9 10.6z" fill="#000"/>',
    NG:
      '<rect width="30" height="21" fill="#fff"/>' +
      '<rect width="10" height="21" fill="#008751"/><rect x="20" width="10" height="21" fill="#008751"/>',
    KW:
      '<rect width="30" height="7" fill="#007a3d"/><rect y="7" width="30" height="7" fill="#fff"/>' +
      '<rect y="14" width="30" height="7" fill="#ce1126"/>' +
      '<path d="M0 0 9 5.4 9 15.6 0 21z" fill="#000"/>',
    DE:
      '<rect width="30" height="7" fill="#000"/><rect y="7" width="30" height="7" fill="#dd0000"/>' +
      '<rect y="14" width="30" height="7" fill="#ffce00"/>',
    KE:
      '<rect width="30" height="6" fill="#000"/><rect y="6" width="30" height="1.6" fill="#fff"/>' +
      '<rect y="7.6" width="30" height="6" fill="#bb0000"/>' +
      '<rect y="13.6" width="30" height="1.6" fill="#fff"/><rect y="15.2" width="30" height="5.8" fill="#006600"/>',
    IS:
      '<rect width="30" height="21" fill="#02529c"/>' +
      '<path d="M12 0V21M0 8.2H30" stroke="#fff" stroke-width="5"/>' +
      '<path d="M12 0V21M0 8.2H30" stroke="#d7282f" stroke-width="2.4"/>',
    JP:
      '<rect width="30" height="21" fill="#fff"/><circle cx="15" cy="10.5" r="5.6" fill="#bc002d"/>',
    KR:
      '<rect width="30" height="21" fill="#fff"/>' +
      '<path d="M8.8 10.5a6.2 6.2 0 0 1 12.4 0z" fill="#cd2e3a"/>' +
      '<path d="M21.2 10.5a6.2 6.2 0 0 1-12.4 0z" fill="#0047a0"/>' +
      '<g fill="#000"><rect x="4" y="4" width="5" height="1.3" transform="rotate(-33 6.5 4.6)"/>' +
      '<rect x="21" y="15" width="5" height="1.3" transform="rotate(-33 23.5 15.6)"/>' +
      '<rect x="21" y="4" width="5" height="1.3" transform="rotate(33 23.5 4.6)"/>' +
      '<rect x="4" y="15" width="5" height="1.3" transform="rotate(33 6.5 15.6)"/></g>',
    CA:
      '<rect width="30" height="21" fill="#fff"/><rect width="7" height="21" fill="#d52b1e"/>' +
      '<rect x="23" width="7" height="21" fill="#d52b1e"/>' +
      '<path d="M15 5.2l1.5 2.5 2.1-0.9-0.7 2.5 2.7 0.4-1.9 1.9 0.7 1.3-3.2-0.5 0.4 4.1h-3.2l0.4-4.1-3.2 0.5 0.7-1.3-1.9-1.9 2.7-0.4-0.7-2.5 2.1 0.9z" fill="#d52b1e"/>',
  };

  // Small rounded badge holding one flag; falls back to a plain globe mark for
  // a country that has no artwork yet.
  function flagEl(code) {
    var span = el("span", "flag");
    span.setAttribute("aria-hidden", "true");
    var art = FLAGS[code];
    span.innerHTML = art
      ? '<svg viewBox="0 0 30 21" focusable="false">' + art + "</svg>"
      : '<svg viewBox="0 0 30 21" focusable="false">' +
        '<rect width="30" height="21" fill="#e2e7f0"/>' +
        '<circle cx="15" cy="10.5" r="6" fill="none" stroke="#6e788c" stroke-width="1.4"/>' +
        '<path d="M9 10.5h12M15 4.5v12" stroke="#6e788c" stroke-width="1.4"/></svg>';
    return span;
  }

  function specRow(key, value, modifier, lead) {
    var tr = el("tr");
    tr.appendChild(el("td", "specs__key", key));
    var val = el("td", "specs__val" + (modifier ? " " + modifier : ""));
    if (lead) val.appendChild(lead);
    val.appendChild(document.createTextNode(value));
    tr.appendChild(val);
    return tr;
  }

  // "Valid rate" is a deterministic score out of 100 for the listing, so a
  // drop always reports the same figure.
  function validRate(item) {
    var seed = 0;
    for (var i = 0; i < item.title.length; i++) {
      seed = (seed * 31 + item.title.charCodeAt(i)) % 1000;
    }
    return 88 + (seed % 12); // 88 – 99 %
  }

  function isRefundable(item) {
    return item.refund !== "Not eligible";
  }

  function buildDrop(item, index) {
    var panelId = "drop-panel-" + index;
    var headId = "drop-head-" + index;

    var article = el("article", "drop");
    article.dataset.index = String(index);

    // --- header (the accordion trigger) ---
    var head = el("button", "drop__head");
    head.type = "button";
    head.id = headId;
    head.setAttribute("aria-expanded", "false");
    head.setAttribute("aria-controls", panelId);

    var title = el("span", "drop__title", item.title);
    var from = el("span", "drop__from");
    from.appendChild(document.createTextNode(" from "));
    var creator = el("b", null, item.creator);
    from.appendChild(creator);
    title.appendChild(from);

    var chev = el("span", "chevron");
    chev.innerHTML = CHEVRON_SVG;

    head.appendChild(title);
    head.appendChild(chev);

    // --- panel (collapsed by default) ---
    var panel = el("div", "drop__panel");
    panel.id = panelId;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-labelledby", headId);

    var inner = el("div", "drop__panelInner");
    var content = el("div", "drop__content");

    // Four facts only — country, details, valid rate, refundable — each one in
    // its own bordered cell, with the View goods button in a bordered footer.
    var specs = el("table", "specs specs--boxed");
    var tbody = el("tbody");
    tbody.appendChild(
      specRow("Country", item.countryName + " · " + item.country, "", flagEl(item.country))
    );
    tbody.appendChild(specRow("Details", item.blurb));
    tbody.appendChild(specRow("Valid rate", validRate(item) + "%", "specs__val--rate"));
    tbody.appendChild(
      specRow(
        "Refundable",
        isRefundable(item) ? "True" : "False",
        isRefundable(item) ? "specs__val--yes" : "specs__val--no"
      )
    );

    // "View goods" opens this listing's detail dialog; adding to the cart
    // happens there, where the price and licence are confirmed.
    var viewBtn = el("button", "btn btn--primary", "View goods");
    viewBtn.type = "button";
    viewBtn.addEventListener("click", function () {
      openDialog(item);
    });

    var actionRow = el("tr", "specs__actionRow");
    var actionCell = el("td");
    actionCell.colSpan = 2;
    actionCell.appendChild(viewBtn);
    actionRow.appendChild(actionCell);
    tbody.appendChild(actionRow);

    specs.appendChild(tbody);

    content.appendChild(specs);
    inner.appendChild(content);
    panel.appendChild(inner);

    article.appendChild(head);
    article.appendChild(panel);

    head.addEventListener("click", function () {
      var open = article.classList.toggle("is-open");
      head.setAttribute("aria-expanded", open ? "true" : "false");
    });

    return article;
  }

  // Builds one day section: a heading with the date and a count, then its rows.
  function buildDay(group) {
    var label = dayLabel(group.daysAgo);

    var section = el("section", "day");
    section.dataset.daysAgo = String(group.daysAgo);

    var head = el("header", "day__head");

    var title = el("h3", "day__title", label.title);
    head.appendChild(title);

    var date = el("span", "day__date", label.date);
    head.appendChild(date);

    var count = el(
      "span",
      "day__count",
      group.items.length + (group.items.length === 1 ? " drop" : " drops")
    );
    head.appendChild(count);

    var list = el("div", "day__list");
    group.items.forEach(function (item) {
      list.appendChild(buildDrop(item, state.dropIndex++));
    });

    section.appendChild(head);
    section.appendChild(list);
    return section;
  }

  function renderDays(count) {
    var next = DAY_GROUPS.slice(state.dayIndex, state.dayIndex + count);
    var frag = document.createDocumentFragment();

    next.forEach(function (group) {
      frag.appendChild(buildDay(group));
      state.rendered += group.items.length;
    });

    state.dayIndex += next.length;
    ui.feed.appendChild(frag);

    updateFeedChrome();
  }

  function updateFeedChrome() {
    ui.dropCount.textContent =
      "Showing " +
      state.rendered +
      " of " +
      DROPS.length +
      " drops \u00b7 " +
      state.dayIndex +
      " of " +
      DAY_GROUPS.length +
      " days";

    var done = state.dayIndex >= DAY_GROUPS.length;
    ui.loadMore.hidden = done;
    if (done) {
      ui.loadMore.textContent = "All " + DAY_GROUPS.length + " days loaded";
    }
  }

  renderDays(DAYS_PER_PAGE); // first two days on load

  ui.loadMore.addEventListener("click", function () {
    // keep focus useful: move to the first newly added day heading
    var before = ui.feed.querySelectorAll(".day__title").length;
    renderDays(DAYS_PER_PAGE);

    var titles = ui.feed.querySelectorAll(".day__title");
    var first = titles[before];
    if (first) {
      first.setAttribute("tabindex", "-1");
      first.focus({ preventScroll: true });
    }
  });

  /* --------------------- 4. Announcement dismissal ------------------------ */

  ui.noticeStack.addEventListener("click", function (event) {
    var closeBtn = event.target.closest(".notice__close");
    if (!closeBtn) return;

    var notice = closeBtn.closest(".notice");
    notice.classList.add("is-leaving");
    notice.addEventListener(
      "animationend",
      function () {
        notice.remove();
      },
      { once: true }
    );
  });

  /* Dropdown menus (account, Goods, Tools, Orders) live in menu.js, which every
     page with the top bar loads — see that file for the wiring. */

  /* --------------------- 6. Cart counter + detail dialog ------------------ */

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && ui.dialog.open) ui.dialog.close();
  });

  // The cart itself lives in cart.js — one store shared by every page, kept in
  // localStorage under "nl.cart.v1". Here we only hand the item over and let
  // the top-bar badge bounce so the change is visible.
  function cartKey(title) {
    return String(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function addToCart(item) {
    if (window.NLCart) {
      window.NLCart.add({
        key: cartKey(item.title),
        title: item.title,
        price: item.price,
        qty: 1,
      });
    }

    if (ui.cartBtn && ui.cartBtn.animate) {
      ui.cartBtn.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }],
        { duration: 260, easing: "ease-out" }
      );
    }

    if (ui.dialog.open) ui.dialog.close();
  }

  // The top-bar cart icon is a plain link to cart.html, so there is no click
  // handler here: the badge count, the store and the cart page all come from
  // cart.js.

  function openDialog(item) {
    ui.dialogTitle.textContent = item.title;

    var body = ui.dialogBody;
    body.innerHTML = "";

    var specs = el("table", "specs");
    var tbody = el("tbody");
    tbody.appendChild(specRow("Creator", item.creator));
    tbody.appendChild(
      specRow("Country", item.countryName + " · " + item.country, "", flagEl(item.country))
    );
    tbody.appendChild(specRow("Licence", item.license));
    tbody.appendChild(
      specRow(
        "Refund",
        item.refund,
        item.refund === "Not eligible" ? "specs__val--no" : "specs__val--yes"
      )
    );
    tbody.appendChild(specRow("Price", money(item.price)));
    tbody.appendChild(specRow("Listed", item.added));
    specs.appendChild(tbody);

    var note = el("p", "dialog__note", item.blurb);

    var actions = el("div", "dialog__actions");
    var closeBtn = el("button", "btn btn--ghost", "Close");
    closeBtn.type = "button";
    closeBtn.addEventListener("click", function () {
      ui.dialog.close();
    });

    var buyBtn = el("button", "btn btn--primary", "Add to cart");
    buyBtn.type = "button";
    buyBtn.addEventListener("click", function () {
      addToCart(item);
    });

    actions.appendChild(closeBtn);
    actions.appendChild(buyBtn);

    body.appendChild(specs);
    body.appendChild(note);
    body.appendChild(actions);

    if (typeof ui.dialog.showModal === "function") {
      ui.dialog.showModal();
    }
  }

  // Close buttons inside the dialog
  document.querySelectorAll("[data-close-dialog]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      ui.dialog.close();
    });
  });

})();
