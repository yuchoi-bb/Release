<?php
// =============================================================================
// 관리자 로그인 / 로그아웃
//
// AUTH_MODE 가 'sso' 면 이 화면은 쓰이지 않습니다. 사내 SSO 가 프록시 단에서
// 인증을 끝내고 헤더로 사용자를 넘겨주기 때문입니다.
// =============================================================================
declare(strict_types=1);

require __DIR__ . '/lib/config.php';
require __DIR__ . '/lib/util.php';
require __DIR__ . '/lib/auth.php';

auth_start();
$lang = current_lang();

if (($_GET['action'] ?? '') === 'logout') {
    auth_logout();
    header('Location: index.php');
    exit;
}

if (AUTH_MODE !== 'local' || auth_user() !== null) {
    header('Location: index.php');
    exit;
}

$failed = false;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (auth_login(trim((string)($_POST['id'] ?? '')), (string)($_POST['password'] ?? ''))) {
        header('Location: index.php');
        exit;
    }
    $failed = true;
}
?>
<!DOCTYPE html>
<html lang="<?= $lang === 'ko' ? 'ko' : 'en' ?>">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ToolHub — <?= e(tr($lang, 'login_title')) ?></title>
<link rel="stylesheet" href="assets/app.css">
<script>try { document.documentElement.dataset.theme = localStorage.getItem('th_theme') || 'light'; } catch (e) {}</script>
</head>
<body>

<header class="site-header">
    <div class="brand">
        <span class="logo" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="1"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg></span>
        <span>Tool<b>Hub</b> Portal</span>
    </div>
    <div class="header-right">
        <a class="hbtn voc" href="<?= e(VOC_URL) ?>" target="_blank" rel="noopener">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 01-9 8.4 8.9 8.9 0 01-3.9-.9L3 21l1.9-5a8.4 8.4 0 01-.9-3.8 8.4 8.4 0 018.4-8.4h.5a8.4 8.4 0 018.1 8.1z"/></svg>
            VOC / Feedback
        </a>
        <button class="hbtn" id="themeBtn" type="button">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>
            <span id="themeLabel"><?= e(tr($lang, 'theme_light')) ?></span>
        </button>
        <a class="hbtn" href="?lang=<?= $lang === 'ko' ? 'en' : 'ko' ?>"><?= e(tr($lang, 'lang_btn')) ?></a>
    </div>
</header>

<div class="login-wrap">
  <form class="login-card" method="post">
    <h1><?= e(tr($lang, 'login_title')) ?></h1>
    <p class="sub"><?= e(tr($lang, 'login_sub')) ?></p>

    <?php if ($failed): ?>
      <p class="login-error"><?= e(tr($lang, 'login_failed')) ?></p>
    <?php endif; ?>

    <div class="fld"><label for="l-id">ID</label>
      <input id="l-id" name="id" required autofocus autocomplete="username"></div>
    <div class="fld"><label for="l-pw">Password</label>
      <input id="l-pw" name="password" type="password" required autocomplete="current-password"></div>

    <button class="btn-login" type="submit"><?= e(tr($lang, 'login_btn')) ?></button>
    <a class="back" href="index.php"><?= e(tr($lang, 'login_back')) ?></a>
    <p class="hint"><?= e(tr($lang, 'login_hint')) ?></p>
  </form>
</div>

<footer class="site-footer"><span><?= e(tr($lang, 'footer')) ?></span><span></span></footer>
<script src="assets/app.js"></script>
</body>
</html>
