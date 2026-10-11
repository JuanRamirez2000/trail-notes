# Brief for the next design round

Written 2026-10-10 for a Claude Design session in the project `87e465cf-146d-4327-9930-d7562360f28b`, at the owner's request: "new designs for me to look into ... as small as theme changes to a full on design system rework to new layouts", to choose from before V1. Paste everything below the line into the session.

---

You're working in the Trailnotes design project. Read these files first, they are the
current design and all of it is built and live at https://trail-notes-amber.vercel.app:

- Trailnotes Design System.dc.html   (the "Fresh Green" palette, type, tokens)
- Trailnotes Landing.dc.html         (landing page)
- Trail Guide Branded.dc.html        (gallery, guide page, editor)
- Trailnotes Components Selected.dc.html  (the look of each guide block)

WHAT TRAILNOTES IS
A site of photo-by-photo hiking guides. Each guide follows one hike with a photo at every
point where the trail changes, pinned on a map where it was taken. The route comes from a
GPS recording. People read a guide at home to plan, and again on their phone at the
trailhead, often in bright sun with poor signal. There are two guides today and it will
stay small and personal: a handful of careful guides, not a directory.

WHAT I WANT FROM THIS SESSION
New design directions to choose from before I call this V1. I'm open to anything from a
theme change to a full rework, so give me three clearly different directions:

  A. Evolve    Same structure and components. Change theme only: colour, type, spacing,
               corner radius, borders vs. shadows, photo treatment.
  B. Rework    A new design system: new type scale and grid, a new idea for how blocks are
               framed, how pins and maps are styled, how density changes from desktop to
               phone. Layouts may shift but the pages stay recognisable.
  C. Rethink   New layouts. Question the basics: does a guide have to be a long scroll with
               a side rail? Could the map be the page and the guide a panel? Could a guide
               read like a field notebook, a trip report, a set of cards you swipe?

For each direction show the same four things so I can compare them side by side:
  1. Landing page
  2. Gallery of hikes
  3. A guide page, at desktop width AND at phone width (the phone view matters most)
  4. A component sheet: route map, elevation profile, step-by-step, photo card,
     "Before you go" card, safety points, minimap

Then tell me which one you'd pick and why, and what you'd steal from the other two.

USE REAL CONTENT, NOT LOREM IPSUM
Strawberry Peak, Angeles National Forest. 7.3 mi out-and-back, 1,830 ft of climbing, hard,
about 4 hours. Six steps: Start at Red Box (0.0 mi) · The climb eases and the trail wraps
around the mountain (1.1) · Cross the saddle (2.4) · The rocky climb begins (2.8) ·
Steepest pitch: loose rock underfoot (3.4) · Reach the summit and turn around (3.6).
Before you go: Adventure Pass to park, no water on the route, loose rock on the last mile.
Photos are portrait phone photos of chaparral ridges and a rocky summit.

WHAT HAS TO SURVIVE ANY DIRECTION
- Pin types keep their meaning and stay tellable apart without colour alone: trailhead,
  turn, note, viewpoint, landmark, water, ranger station, bail-out. Water, ranger and
  bail-out are "safety" pins and must stand out from the rest.
- Selecting a step anywhere (map, list, elevation profile, photo) selects it everywhere.
- Text contrast of at least 4.5:1, touch targets of at least 24 px, readable outdoors.
- It's a reading experience first. No dark patterns, no sign-up prompts: visitors have no
  accounts.
- Tokens stay few and named, so a theme is a change of values, not of components.

DESIGN FOR WHAT'S COMING, NOT JUST WHAT EXISTS
- A byline: "Guide by <name>", because invited guests will write some guides.
- The date the hike was walked, shown clearly, since trail conditions go stale.
- Sun and shade: a band on the elevation profile showing where you'd be in sun or shade
  for a chosen date and start time. Later, a map layer that animates through the day.
- Several photos at one pin (both branches of a fork, a look around a summit).
- A 360° photo viewer with a compass.
- A GPX download.

WHAT I THINK IS WEAK TODAY (push on these)
- Everything is a bordered white card; the page can feel like a stack of boxes.
- The guide's hero is a photo with a card on it; it doesn't feel like the start of a trip.
- The phone view is the desktop view squeezed, with a bar pinned to the top for the map.
- The landing page explains the product but doesn't make you want to go on the hike.
- The palette is pleasant but generic; it could be any outdoors brand.

THE EDITOR (lower priority, desktop only)
Signed-in writers use an editor with five views: Write, Details, Pins, Advanced, History.
It doesn't need a phone layout. If a direction changes the design system, show how the
editor's top bar, a settings column and the hike list would look in it; otherwise leave it.

HOW TO DELIVER
- One file per direction, named "Trailnotes V1 - A Evolve", "- B Rework", "- C Rethink",
  plus an index file that shows the three side by side with a one-paragraph rationale each.
- State the tokens each direction uses (colours, type, radii, spacing) in a table.
- Say plainly what each direction would cost to build: which existing pages or components
  change, and which stay as they are.
- If you make a choice I didn't ask for, say so, so I can tell decisions from defaults.
