<?php
/* ============================================================================
 *  save.php — optional one-click publishing endpoint for editor.html
 *
 *  Upload this to /ii/ on skuytov.eu and the editor's "Публикувай на сървъра"
 *  button will write content.js and manifest.json directly, so nobody needs an
 *  FTP client to change a phone number.
 *
 *  ---------------------------------------------------------------------------
 *  SETUP — do these two things before uploading
 *  ---------------------------------------------------------------------------
 *  1. Set a password below. Generate the hash by opening a PHP prompt, or
 *     simply put a plain password in PASSWORD_PLAIN and leave PASSWORD_HASH
 *     empty — the hash is preferable but the plain form is honest about what
 *     it is rather than pretending to be secure.
 *
 *  2. Make sure the /ii/ directory is writable by the web server
 *     (usually chmod 755 is enough on shared hosting where PHP runs as you).
 *
 *  ---------------------------------------------------------------------------
 *  WHY THIS IS SAFE ENOUGH, AND WHERE ITS LIMITS ARE
 *  ---------------------------------------------------------------------------
 *  It can only ever write two fixed filenames in its own directory, and it
 *  rejects anything that does not look like the expected file. It cannot be
 *  used to upload arbitrary files or paths.
 *
 *  It is still a password in a form over HTTPS, so treat it as "keeps the
 *  public out", not "resists a determined attacker". If you would rather not
 *  have a write endpoint on the server at all, simply do not upload this file:
 *  the editor's "Изтегли файловете" flow works without it.
 * ========================================================================== */

declare(strict_types=1);

// ---- CONFIGURE ME ---------------------------------------------------------
// Either set a bcrypt hash (preferred) ...
const PASSWORD_HASH  = '';
// ... or a plain password (simpler; change it from the default!).
const PASSWORD_PLAIN = 'septona-tablo';
// ---------------------------------------------------------------------------

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function fail(string $msg, int $code = 400): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail('Очаква се POST заявка.', 405);
}

$raw = file_get_contents('php://input');
if ($raw === false || $raw === '') fail('Празна заявка.');
if (strlen($raw) > 2_000_000)      fail('Заявката е прекалено голяма.');

$in = json_decode($raw, true);
if (!is_array($in)) fail('Невалиден JSON.');

// ---- authenticate ---------------------------------------------------------
$given = (string)($in['password'] ?? '');
$ok = PASSWORD_HASH !== ''
    ? password_verify($given, PASSWORD_HASH)
    : hash_equals(PASSWORD_PLAIN, $given);
if (!$ok) {
    usleep(400_000);                       // slow down guessing a little
    fail('Грешна парола.', 403);
}

// ---- validate the payload -------------------------------------------------
$content  = (string)($in['content.js']    ?? '');
$manifest = (string)($in['manifest.json'] ?? '');

if ($content === '' || $manifest === '') fail('Липсва content.js или manifest.json.');

// content.js must actually be the board content, not something else entirely.
if (!str_contains($content, 'window.BOARD')) {
    fail('content.js не изглежда правилен (липсва window.BOARD).');
}
if (strlen($content) < 2000) {
    fail('content.js изглежда прекалено малък — отказвам да презапиша таблото.');
}

$man = json_decode($manifest, true);
if (!is_array($man) || empty($man['version']) || empty($man['files'])) {
    fail('manifest.json не е валиден.');
}

// ---- write, keeping a backup and committing atomically --------------------
$dir = __DIR__;
if (!is_writable($dir)) fail('Папката не е достъпна за запис на сървъра.', 500);

// Keep the previous content.js so a bad edit can be rolled back by hand.
$backups = $dir . '/backups';
if (!is_dir($backups)) @mkdir($backups, 0755);
if (is_dir($backups) && is_file($dir . '/content.js')) {
    @copy($dir . '/content.js', $backups . '/content-' . date('Ymd-His') . '.js');
    // Keep the 20 most recent backups only.
    $old = glob($backups . '/content-*.js') ?: [];
    if (count($old) > 20) {
        sort($old);
        foreach (array_slice($old, 0, count($old) - 20) as $f) @unlink($f);
    }
}

/**
 * Write via a temp file + rename so a reader (the panel) never sees a
 * half-written file. rename() is atomic within the same filesystem.
 */
function put_atomic(string $path, string $data): bool {
    $tmp = $path . '.tmp' . bin2hex(random_bytes(4));
    if (file_put_contents($tmp, $data) === false) return false;
    @chmod($tmp, 0644);
    if (!rename($tmp, $path)) { @unlink($tmp); return false; }
    return true;
}

// content.js first, manifest.json last: the panel treats a changed manifest as
// the signal that new files are ready, so it must never arrive first.
if (!put_atomic($dir . '/content.js', $content))     fail('Неуспешен запис на content.js.', 500);
if (!put_atomic($dir . '/manifest.json', $manifest)) fail('Неуспешен запис на manifest.json.', 500);

echo json_encode([
    'ok'      => true,
    'version' => $man['version'],
    'written' => ['content.js', 'manifest.json'],
    'at'      => date('c'),
], JSON_UNESCAPED_UNICODE);
