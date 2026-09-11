<?php
// =============================================================================
// OBS 캐시 로드 및 obs_prefix 매칭
//
// obs_cache.json 은 이 페이지가 만들지 않습니다. 별도 배치가 OBS 를 훑어
// 만들어 두면 여기서 읽기만 합니다. 파일이 없어도 페이지는 정상 동작하고,
// OBS 에서 오는 열만 비워집니다.
// =============================================================================
declare(strict_types=1);

/**
 * @return array{files: array<int,array>, error: ?string, updated_at: ?string}
 */
function obs_load(): array
{
    $none = ['files' => [], 'error' => null, 'updated_at' => null];

    if (!is_file(OBS_CACHE)) {
        return $none;
    }
    $raw = @file_get_contents(OBS_CACHE);
    if ($raw === false) {
        return ['files' => [], 'error' => 'OBS 캐시 파일을 읽을 수 없습니다.', 'updated_at' => null];
    }
    $data = json_decode($raw, true);
    if (!is_array($data) || !is_array($data['files'] ?? null)) {
        return ['files' => [], 'error' => 'OBS 캐시 형식이 올바르지 않습니다.', 'updated_at' => null];
    }
    return [
        'files'      => $data['files'],
        'error'      => null,
        'updated_at' => isset($data['updated_at']) ? (string)$data['updated_at'] : null,
    ];
}

/**
 * 파일명에서 버전을 뽑습니다. `_v1.0.63` 과 `_ver2.35` 를 모두 인식하고,
 * 버전 표기가 없는 파일명(덮어쓰기 방식)이면 null 을 돌려줍니다.
 */
function parse_version(string $filename): ?string
{
    return preg_match('/_v(?:er)?(\d+(?:\.\d+)*)/i', $filename, $m) ? $m[1] : null;
}

/**
 * 점으로 구분된 버전을 자리별 숫자로 비교합니다.
 * 문자열 정렬을 쓰면 v1.9.0 이 v1.10.0 보다 최신으로 잡히기 때문에 필요합니다.
 */
function version_cmp(string $a, string $b): int
{
    $pa = explode('.', $a);
    $pb = explode('.', $b);
    for ($i = 0, $n = max(count($pa), count($pb)); $i < $n; $i++) {
        $cmp = (int)($pa[$i] ?? 0) <=> (int)($pb[$i] ?? 0);
        if ($cmp !== 0) {
            return $cmp;
        }
    }
    return 0;
}

/** 검증 리포트로 볼 파일인지. 그 외는 모두 도구 본체로 봅니다. */
function is_report_file(string $filename): bool
{
    return (bool)preg_match('/(report|verif)/i', $filename)
        || strtolower((string)pathinfo($filename, PATHINFO_EXTENSION)) === 'pdf';
}

/**
 * OBS 파일을 도구에 귀속시킵니다.
 * 프리픽스가 여러 개 걸리면 가장 긴 것이 이깁니다. 그래야 `NWin_` 과 `NWin_Pro_`
 * 가 함께 있을 때 `NWin_Pro_x64.zip` 이 양쪽에 중복으로 잡히지 않습니다.
 *
 * @return array<string,array<int,array>> 도구 id => 파일 목록
 */
function obs_match(array $tools, array $files): array
{
    $prefixes = [];
    foreach ($tools as $t) {
        if (($t['obs_prefix'] ?? '') !== '') {
            $prefixes[$t['id']] = $t['obs_prefix'];
        }
    }

    $byTool = array_fill_keys(array_column($tools, 'id'), []);
    foreach ($files as $f) {
        $name = (string)($f['filename'] ?? '');
        if ($name === '') {
            continue;
        }
        $bestId  = null;
        $bestLen = 0;
        foreach ($prefixes as $id => $prefix) {
            $len = strlen($prefix);
            if ($len > $bestLen && str_starts_with($name, $prefix)) {
                $bestId  = $id;
                $bestLen = $len;
            }
        }
        if ($bestId !== null) {
            $byTool[$bestId][] = $f;
        }
    }
    return $byTool;
}

/**
 * 한 도구의 파일들을 화면에 필요한 형태로 정리합니다.
 * 파일명에 버전이 없으면 히스토리를 만들 수 없으므로 업로드 시각 순으로만 세웁니다.
 *
 * @return array{latest: ?array, older: array<int,array>, report: ?array, updated: ?string}
 */
function obs_summarize(array $files): array
{
    $binaries = [];
    $reports  = [];
    foreach ($files as $f) {
        $f['version'] = parse_version((string)($f['filename'] ?? ''));
        if (is_report_file((string)($f['filename'] ?? ''))) {
            $reports[] = $f;
        } else {
            $binaries[] = $f;
        }
    }

    // 버전이 있으면 버전 우선, 없으면 업로드 시각으로. 최신이 앞으로 옵니다.
    $newestFirst = static function (array $a, array $b): int {
        if ($a['version'] !== null && $b['version'] !== null) {
            $cmp = version_cmp($b['version'], $a['version']);
            if ($cmp !== 0) {
                return $cmp;
            }
        }
        return strcmp((string)($b['last_modified'] ?? ''), (string)($a['last_modified'] ?? ''));
    };
    usort($binaries, $newestFirst);
    usort($reports, $newestFirst);

    return [
        'latest'  => $binaries[0] ?? null,
        'older'   => array_slice($binaries, 1),
        'report'  => $reports[0] ?? null,
        'updated' => $binaries[0]['last_modified'] ?? null,
    ];
}

/** 도구 목록과 OBS 파일을 합쳐 표에 그릴 행을 만듭니다. */
function build_rows(array $tools, array $files): array
{
    $byTool = obs_match($tools, $files);
    $rows   = [];
    foreach ($tools as $t) {
        $rows[] = ['tool' => $t] + obs_summarize($byTool[$t['id']] ?? []);
    }
    return $rows;
}
