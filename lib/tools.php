<?php
// =============================================================================
// tools.json 로드 / 검증 / 저장
// =============================================================================
declare(strict_types=1);

const TOOL_TEXT_FIELDS = ['tool', 'obs_prefix', 'remarks_text'];
const TOOL_LIST_FIELDS = ['os_supported', 'product_supported'];
const TOOL_LINK_FIELDS = ['manual', 'remarks_links'];

/**
 * @return array{tools: array<int,array>, error: ?string, hash: string}
 */
function tools_load(): array
{
    if (!is_file(TOOLS_JSON)) {
        return ['tools' => [], 'error' => 'tools.json 이 없습니다.', 'hash' => ''];
    }
    $raw = @file_get_contents(TOOLS_JSON);
    if ($raw === false) {
        return ['tools' => [], 'error' => 'tools.json 을 읽을 수 없습니다.', 'hash' => ''];
    }
    $data = json_decode($raw, true);
    if (!is_array($data) || !is_array($data['tools'] ?? null)) {
        return ['tools' => [], 'error' => 'tools.json 형식이 올바르지 않습니다.', 'hash' => ''];
    }
    return [
        'tools' => array_values(array_map('tool_normalize', $data['tools'])),
        'error' => null,
        'hash'  => hash('sha256', $raw),
    ];
}

/** 필드가 빠져 있어도 화면이 깨지지 않도록 기본값으로 채우고 공백을 다듬습니다. */
function tool_normalize(array $t): array
{
    $out = ['id' => trim((string)($t['id'] ?? ''))];

    foreach (TOOL_TEXT_FIELDS as $f) {
        $out[$f] = trim((string)($t[$f] ?? ''));
    }
    foreach (TOOL_LIST_FIELDS as $f) {
        $vals = is_array($t[$f] ?? null) ? $t[$f] : [];
        $out[$f] = array_values(array_filter(
            array_map(static fn($v) => trim((string)$v), $vals),
            static fn($v) => $v !== ''
        ));
    }
    foreach (TOOL_LINK_FIELDS as $f) {
        $links = [];
        foreach (is_array($t[$f] ?? null) ? $t[$f] : [] as $l) {
            if (!is_array($l)) {
                continue;
            }
            $label = trim((string)($l['label'] ?? ''));
            $url   = trim((string)($l['url'] ?? ''));
            if ($label !== '' || $url !== '') {
                $links[] = ['label' => $label, 'url' => $url];
            }
        }
        $out[$f] = $links;
    }

    return $out;
}

/** 도구명에서 id 후보를 만듭니다. 새 도구를 추가할 때만 씁니다. */
function tool_make_id(string $name, array $existing): string
{
    $base = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $name) ?? '');
    $base = trim($base, '-');
    if ($base === '') {
        $base = 'tool';
    }
    $id = $base;
    $n  = 2;
    $taken = array_column($existing, 'id');
    while (in_array($id, $taken, true)) {
        $id = $base . '-' . $n++;
    }
    return $id;
}

/**
 * 저장 전 검증. 사람이 읽을 수 있는 오류 문자열 배열을 돌려주고,
 * 비어 있으면 통과입니다.
 */
function tools_validate(array $tools): array
{
    $errors   = [];
    $seenId   = [];
    $prefixes = [];

    foreach ($tools as $i => $t) {
        $where = ($t['tool'] !== '' ? $t['tool'] : sprintf('%d행', $i + 1));

        if ($t['tool'] === '') {
            $errors[] = sprintf('%d행: 도구명은 필수입니다.', $i + 1);
        }
        if ($t['id'] === '') {
            $errors[] = "$where: id 가 비어 있습니다.";
        } elseif (!preg_match('/^[a-z0-9_-]+$/i', $t['id'])) {
            $errors[] = "$where: id 는 영문·숫자·_·- 만 쓸 수 있습니다.";
        } elseif (isset($seenId[$t['id']])) {
            $errors[] = "$where: id '{$t['id']}' 가 중복입니다.";
        } else {
            $seenId[$t['id']] = true;
        }

        if ($t['obs_prefix'] !== '') {
            $prefixes[$t['obs_prefix']][] = $where;
        }

        foreach (TOOL_LINK_FIELDS as $f) {
            foreach ($t[$f] as $l) {
                if ($l['url'] !== '' && safe_url($l['url']) === null) {
                    $errors[] = "$where: '{$l['label']}' 의 URL 은 http 또는 https 로 시작해야 합니다.";
                }
            }
        }
    }

    foreach ($prefixes as $p => $owners) {
        if (count($owners) > 1) {
            $errors[] = "obs_prefix '$p' 를 " . implode(', ', $owners) . ' 가 함께 씁니다. 산출물이 섞입니다.';
        }
    }

    return $errors;
}

/**
 * tools.json 저장.
 *
 * $expectedHash 는 편집을 시작한 시점의 파일 해시입니다. 그 사이에 다른 사람이
 * 저장했다면 덮어쓰지 않고 거절합니다.
 *
 * @return array{ok: bool, error?: string, code?: string, hash?: string}
 */
function tools_save(array $tools, string $expectedHash, array $user, string $action): array
{
    $errors = tools_validate($tools);
    if ($errors) {
        return ['ok' => false, 'error' => implode("\n", $errors), 'code' => 'invalid'];
    }

    if (!is_dir(DATA_DIR) && !@mkdir(DATA_DIR, 0775, true)) {
        return ['ok' => false, 'error' => '데이터 디렉터리를 만들 수 없습니다.', 'code' => 'write'];
    }

    $lock = @fopen(TOOLS_LOCK, 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        return ['ok' => false, 'error' => '잠금 파일을 열 수 없습니다. 디렉터리 권한을 확인하세요.', 'code' => 'lock'];
    }

    try {
        $before     = is_file(TOOLS_JSON) ? (string)file_get_contents(TOOLS_JSON) : '';
        if ($expectedHash !== '' && hash('sha256', $before) !== $expectedHash) {
            return ['ok' => false, 'error' => 'conflict', 'code' => 'conflict'];
        }

        $json = json_encode(
            ['schema_version' => 1, 'updated_at' => gmdate('c'), 'tools' => array_values($tools)],
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );
        if ($json === false) {
            return ['ok' => false, 'error' => 'JSON 직렬화에 실패했습니다.', 'code' => 'encode'];
        }

        // 임시 파일에 쓰고 바꿔치기합니다. 쓰다가 중단돼도 원본이 남습니다.
        $tmp = TOOLS_JSON . '.tmp';
        if (@file_put_contents($tmp, $json) === false || !@rename($tmp, TOOLS_JSON)) {
            @unlink($tmp);
            return ['ok' => false, 'error' => 'tools.json 에 쓸 수 없습니다. 파일 권한을 확인하세요.', 'code' => 'write'];
        }

        history_append($user, $action, $before, $json);
        return ['ok' => true, 'hash' => hash('sha256', $json)];
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

/**
 * 변경 이력을 한 줄씩 덧붙입니다. 되돌릴 때의 근거가 됩니다.
 * 저장 직전 파일 전체를 담으므로, 이 줄만 tools.json 에 되돌려 쓰면 복구됩니다.
 */
function history_append(array $user, string $action, string $before, string $after): void
{
    $line = json_encode([
        'ts'     => gmdate('c'),
        'user'   => $user['id'] ?? '?',
        'action' => $action,
        'before' => $before === '' ? null : json_decode($before, true),
        'after'  => json_decode($after, true),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    if ($line !== false) {
        @file_put_contents(TOOLS_HIST, $line . "\n", FILE_APPEND | LOCK_EX);
    }
}
