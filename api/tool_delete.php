<?php
// =============================================================================
// 도구 삭제
//
// 지워진 내용은 tools.history.jsonl 에 통째로 남으므로, 그 줄을 되돌려 쓰면
// 복구할 수 있습니다.
// =============================================================================
declare(strict_types=1);

require __DIR__ . '/../lib/config.php';
require __DIR__ . '/../lib/util.php';
require __DIR__ . '/../lib/auth.php';
require __DIR__ . '/../lib/tools.php';

auth_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['ok' => false, 'error' => 'method not allowed'], 405);
}

$user = auth_require_edit();

$body = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($body)) {
    json_out(['ok' => false, 'error' => 'bad request'], 400);
}
if (!csrf_check($body['csrf'] ?? null)) {
    json_out(['ok' => false, 'error' => 'csrf'], 403);
}

$id = trim((string)($body['id'] ?? ''));
if ($id === '') {
    json_out(['ok' => false, 'error' => 'bad request'], 400);
}

$current = tools_load();
if ($current['error'] !== null) {
    json_out(['ok' => false, 'error' => $current['error']], 500);
}

$remaining = array_values(array_filter($current['tools'], static fn($t) => $t['id'] !== $id));
if (count($remaining) === count($current['tools'])) {
    json_out(['ok' => false, 'error' => 'not found'], 404);
}

$result = tools_save($remaining, (string)($body['hash'] ?? ''), $user, 'delete');

if (!$result['ok']) {
    $status = ($result['code'] ?? '') === 'conflict' ? 409 : 500;
    json_out(['ok' => false, 'error' => $result['error'], 'code' => $result['code'] ?? ''], $status);
}

json_out(['ok' => true, 'hash' => $result['hash']]);
