====================================================================
 Septona information board  —  upload set for  https://skuytov.eu/ii
 Version 2.5.0
====================================================================

WHAT CHANGED IN THIS VERSION
  * NEW: a visual editor. You no longer need to edit any code to
    change what the panel shows. Open  editor.html  in a browser,
    type in normal form fields, and it produces the files for you.
  * The editor shows a live preview of the real 4K board and warns
    you BEFORE you upload if the text no longer fits on the screen.
  * It also regenerates manifest.json for you, which used to require
    running a Python script.

====================================================================
 HOW TO CHANGE THE BOARD TEXT
====================================================================

--------------------------------------------------------------------
 THE EASY WAY  —  the visual editor  (recommended)
--------------------------------------------------------------------
1. Open  https://skuytov.eu/ii/editor.html  in Chrome, Edge or
   Firefox on any PC. (It also works offline: copy this whole folder
   to a USB stick and double-click editor.html.)

2. Pick a section in the left-hand list: emergency numbers, driver
   rules, phone directory, training programme, inspections, cleaning
   schedule, waste, the safety committee, fire-safety certificates,
   the board title, or the footer.

3. Change the text. You can also
      +  add a row              ("+ Добави ред")
      X  delete a row
      up/down  reorder rows
   The panel on the right shows exactly how the board will look.

4. Watch the message under the preview:
      GREEN  "Всичко се побира"      -> good to upload
      ORANGE "текстът не се побира"   -> too much text; it names the
             section and how many pixels over it is. Shorten the text
             or remove a row until the message turns green.
   Ignoring an orange warning means text gets cut off on the panel.

5. Publish, either way:

   (a) "Публикувай на сървъра"  — one click, if save.php is on the
       server. Enter the publishing password. Done.

   (b) "Изтегли файловете"  — downloads  content.js  and
       manifest.json. Upload both to  /ii/  on the server,
       content.js first and manifest.json LAST.

6. Within 5 minutes the panel downloads the change and reloads by
   itself. Nothing needs to be done at the panel.

NOTES ON THE EDITOR
  * Your work is saved in the browser as you type, so closing the tab
    by accident does not lose it — it offers to restore on reopening.
  * It cannot produce a broken file. All the text is written out by
    the browser with correct quoting, so a typo can only ever be a
    wrong word, never a syntax error that blanks the panel.
  * "Отвори файл" loads an existing content.js — useful for going
    back to a previous version kept in /ii/backups/.

--------------------------------------------------------------------
 THE MANUAL WAY  —  editing content.js by hand
--------------------------------------------------------------------
Still supported, and unchanged:

1. Open  content.js  in a plain-text editor (Notepad++, VS Code).
2. Each section is commented in Bulgarian and English. Change the
   text between the quotes.
3. Keep every quote  "  and every comma  ,  exactly where they are.
   Use straight quotes, not the curly " " characters Word inserts.
   Do not rename the field names (bg, en, tel, date, ...).
4. Regenerate the manifest:   python3 tools/build-manifest.py
5. Upload content.js, then manifest.json LAST.

If the syntax is broken the panel shows a red error message naming
the problem rather than going blank — fix it and re-upload.

====================================================================
 ONE-CLICK PUBLISHING  (optional, set up once)
====================================================================
save.php  in this archive is what makes the "Публикувай на сървъра"
button work. To enable it:

1. Open save.php and change the line
        const PASSWORD_PLAIN = 'septona-tablo';
   to a password of your own.
2. Upload save.php to  /ii/  and make sure that folder is writable
   by the web server.

It can only ever write those two filenames in its own folder, it
refuses anything that does not look like valid board content, and it
keeps the last 20 versions of content.js in  /ii/backups/  so a bad
edit can be rolled back.

If you would rather not have a writable endpoint on the server, just
do not upload save.php — the "Изтегли файловете" route works without
it and nothing else depends on it.

====================================================================
 UPLOAD ORDER  (important)
====================================================================
Upload changed content/asset files FIRST, and manifest.json LAST.
The panel treats manifest.json as the signal that a new version is
ready; if it arrives first, the panel may fetch a file that is still
being uploaded.

====================================================================
 FILES IN THIS ARCHIVE  -> upload to /ii/ keeping the folder layout
====================================================================
 The board itself (this is what the panel loads):
  1.html            the board page — the URL the panel opens
  content.js        ALL BOARD TEXT
  render.js         draws the board from content.js
  app.js            clock, 15-min/30-s cycling, burn-in drift
  style.css         layout and typography
  sw.js             offline cache
  manifest.json     file list + checksums (upload LAST)
  assets/           fonts, logo, splash backgrounds

 The editor (the panel never loads these; for staff use in a browser):
  editor.html       open this one
  editor.css        its styling
  editor.js         its logic
  editor-schema.js  which fields exist in which section
  index.html        same page as 1.html, used by the editor preview
  save.php          optional one-click publishing (see above)

====================================================================
 CHECKING THE PANEL
====================================================================
Open  https://skuytov.eu/ii/1.html?diag=1  in a browser (or press "i"
on a keyboard plugged into the panel). The overlay reports the
viewport, 1rem size, whether the board rendered at 3840x2160, whether
content.js loaded, the current drift offset and the last sync result.

 PANEL SETTINGS (do this once, in the iiyama OSD menu)
  Picture mode / input label = PC
  Sharpness                  = 0
  Aspect / zoom              = 1:1 (full pixel, no overscan)
 The panel's own sharpening smears small text and cannot be
 compensated for in software.
