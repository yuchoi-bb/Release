<?php
// =============================================================================
// 도구 저장 (수정 + 추가)
//
// id 가 비어 있으면 새 도구로 추가하고, 있으면 해당 행을 교체합니다.
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

$input = is_array($body['tool'] ?? null) ? $body['tool'] : [];
$id    = trim((string)($input['id'] ?? ''));

$current = tools_load();
if ($current['error'] !== null && !is_file(TOOLS_JSON)) {
    // 파일이 아직 없는 첫 저장이면 빈 목록에서 시작합니다.
    $current = ['tools' => [], 'error' => null, 'hash' => ''];
} elseif ($current['error'] !== null) {
    json_out(['ok' => false, 'error' => $current['error']], 500);
}

$tools = $current['tools'];

// 새 도구는 도구명에서 id 를 만들어 붙입니다. 기존 도구의 id 는 바뀌지 않습니다.
$isNew = ($id === '');
if ($isNew) {
    $input['id'] = tool_make_id((string)($input['tool'] ?? ''), $tools);
}

$tool  = tool_normalize($input);
$index = null;
foreach ($tools as $i => $t) {
    if ($t['id'] === $tool['id']) {
        $index = $i;
        break;
    }
}

if ($isNew) {
    $tools[] = $tool;
} elseif ($index === null) {
    json_out(['ok' => false, 'error' => 'not found'], 404);
} else {
    $tools[$index] = $tool;
}

$result = tools_save($tools, (string)($body['hash'] ?? ''), $user, $isNew ? 'create' : 'update');

if (!$result['ok']) {
    $status = match ($result['code'] ?? '') {
        'conflict' => 409,
        'invalid'  => 422,
        default    => 500,
    };
    json_out(['ok' => false, 'error' => $result['error'], 'code' => $result['code'] ?? ''], $status);
}

json_out(['ok' => true, 'hash' => $result['hash'], 'id' => $tool['id']]);
