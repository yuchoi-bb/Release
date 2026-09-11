<?php
// =============================================================================
// 인증 — local(설정 계정) / sso(사내 헤더) 두 방식을 같은 인터페이스로 감쌉니다.
//
// 화면을 보는 데는 로그인이 필요 없고, 표를 바꾸는 데만 필요합니다.
// =============================================================================
declare(strict_types=1);

function auth_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_set_cookie_params([
        'path'     => base_path(),
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    ]);
    session_start();
}

/**
 * 현재 사용자. 로그인하지 않았으면 null.
 * @return array{id: string, name: string}|null
 */
function auth_user(): ?array
{
    if (AUTH_MODE === 'sso') {
        $id = (string)($_SERVER[SSO_HEADER_ID] ?? '');
        if ($id === '') {
            return null;
        }
        return ['id' => $id, 'name' => (string)($_SERVER[SSO_HEADER_NAME] ?? $id)];
    }

    $u = $_SESSION['user'] ?? null;
    return is_array($u) ? $u : null;
}

/** 표를 수정할 수 있는 사용자인지. */
function auth_can_edit(): bool
{
    $user = auth_user();
    if ($user === null) {
        return false;
    }
    // local 모드에서는 로그인에 성공한 사람이 곧 관리자입니다.
    // sso 모드에서는 화이트리스트에 있어야 합니다.
    return AUTH_MODE === 'local' || in_array($user['id'], ADMIN_IDS, true);
}

/** 수정 권한이 없으면 API 를 여기서 끊습니다. 버튼 숨김은 보안이 아닙니다. */
function auth_require_edit(): array
{
    $user = auth_user();
    if (!auth_can_edit()) {
        json_out(['ok' => false, 'error' => 'forbidden'], 403);
    }
    return $user;
}

/** ID/비밀번호 확인. 성공하면 세션에 사용자를 넣습니다. */
function auth_login(string $id, string $password): bool
{
    if (AUTH_MODE !== 'local') {
        return false;
    }
    // 아이디가 틀려도 해시 검증을 수행해, 응답 시간으로 아이디 존재 여부가
    // 드러나지 않게 합니다.
    $known = hash_equals(LOCAL_ADMIN_ID, $id);
    $valid = password_verify($password, LOCAL_ADMIN_HASH);

    if ($known && $valid) {
        session_regenerate_id(true);
        $_SESSION['user'] = ['id' => LOCAL_ADMIN_ID, 'name' => LOCAL_ADMIN_NAME];
        return true;
    }
    sleep(LOGIN_FAIL_DELAY);
    return false;
}

function auth_logout(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

// -----------------------------------------------------------------------------
// CSRF — 저장·삭제 요청이 다른 사이트에서 위조되지 않도록 합니다.
// -----------------------------------------------------------------------------

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_check(?string $token): bool
{
    return is_string($token) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $token);
}
