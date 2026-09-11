<?php
// =============================================================================
// ToolHub Release Page
// =============================================================================
declare(strict_types=1);

require __DIR__ . '/lib/config.php';
require __DIR__ . '/lib/util.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/obs.php';
require __DIR__ . '/lib/tools.php';

auth_start();

$lang    = current_lang();
$user    = auth_user();
$canEdit = auth_can_edit();

$toolsData = tools_load();
$obsData   = obs_load();
$rows      = build_rows($toolsData['tools'], $obsData['files']);

$alerts = array_values(array_filter([$toolsData['error'], $obsData['error']]));
?>
<!DOCTYPE html>
<html lang="<?= $lang === 'ko' ? 'ko' : 'en' ?>">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ToolHub <?= $lang === 'ko' ? '릴리즈 페이지' : 'Release Page' ?></title>
<link rel="stylesheet" href="assets/app.css">
<script>
// 첫 페인트 전에 테마를 적용해 흰 화면이 번쩍이지 않게 합니다.
try { document.documentElement.dataset.theme = localStorage.getItem('th_theme') || 'light'; } catch (e) {}
</script>
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
        <?php if ($user !== null): ?>
            <span class="who">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1"/></svg>
                <?= e($user['name']) ?>
            </span>
            <a class="hbtn" href="login.php?action=logout"><?= e(tr($lang, 'logout')) ?></a>
        <?php else: ?>
            <a class="hbtn" href="login.php"><?= e(tr($lang, 'signin')) ?></a>
        <?php endif; ?>
    </div>
</header>

<main>
    <div class="toprow">
        <div>
            <h2><?= e(tr($lang, 'inventory', count($rows))) ?></h2>
            <div class="cache">
                <?php if ($obsData['updated_at']): ?>
                    <span class="dot"></span><?= e(tr($lang, 'cache_ok', fmt_date($obsData['updated_at'], 'Y-m-d H:i'))) ?>
                <?php else: ?>
                    <span class="dot warn"></span><?= e(tr($lang, 'cache_none')) ?>
                <?php endif; ?>
            </div>
        </div>
        <div class="toprow-right">
            <div class="search">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                <input type="search" id="searchInput" placeholder="<?= e(tr($lang, 'search_ph')) ?>" autocomplete="off">
            </div>
            <?php if ($canEdit): ?>
                <button class="btn-primary" type="button" data-add>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    <?= e(tr($lang, 'add_tool')) ?>
                </button>
            <?php endif; ?>
        </div>
    </div>

    <?php foreach ($alerts as $msg): ?>
        <div class="banner banner-err">
            <span class="ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg></span>
            <span><?= e($msg) ?></span>
        </div>
    <?php endforeach; ?>

    <?php if (AUTH_MODE === 'local'): ?>
        <div class="banner banner-warn">
            <span class="ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg></span>
            <span><?= tr($lang, 'auth_off') /* 고정 문구이며 태그를 포함합니다 */ ?></span>
        </div>
    <?php endif; ?>

    <div class="table-wrap">
    <table>
        <thead><tr>
            <?php foreach (I18N[$lang]['headers'] as $h): ?><th><?= e($h) ?></th><?php endforeach; ?>
            <?php if ($canEdit): ?><th></th><?php endif; ?>
        </tr></thead>
        <tbody id="tableBody">
        <?php foreach ($rows as $row):
            $t = $row['tool'];
            $olderShown = array_slice($row['older'], 0, OLDER_VERSIONS_SHOWN);
        ?>
            <tr data-id="<?= e($t['id']) ?>">
                <td><span class="tool-name"><?= e($t['tool']) ?></span></td>

                <td class="dim"><?= $row['updated'] ? e(fmt_date($row['updated'])) : '<span class="empty">—</span>' ?></td>

                <td><?= $t['os_supported'] ? e(implode(', ', $t['os_supported'])) : '<span class="empty">—</span>' ?></td>

                <td>
                    <?php if ($t['product_supported']): ?>
                        <?php foreach ($t['product_supported'] as $p): ?><span class="tag"><?= e($p) ?></span><?php endforeach; ?>
                    <?php else: ?><span class="empty">—</span><?php endif; ?>
                </td>

                <!-- 도구 링크: 최신본 + 이전 버전 -->
                <td>
                    <?php if ($row['latest']): ?>
                        <div class="filelink">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>
                            <a href="<?= e(obs_url($row['latest']['key'])) ?>"><?= e($row['latest']['filename']) ?></a>
                            <span class="badge-latest"><?= e(tr($lang, 'latest')) ?></span>
                        </div>
                        <?php if ($row['older']): ?>
                            <button class="older-toggle" type="button" aria-expanded="false">
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M10 17l5-5-5-5z"/></svg>
                                <?= e(tr($lang, 'older', count($row['older']))) ?>
                            </button>
                            <div class="older-list" hidden>
                                <?php foreach ($olderShown as $o): ?>
                                    <a href="<?= e(obs_url($o['key'])) ?>"><?= e($o['filename']) ?>
                                        <span class="dim"><?= e(human_size((int)($o['size'] ?? 0))) ?> · <?= e(fmt_date($o['last_modified'] ?? null)) ?></span>
                                    </a>
                                <?php endforeach; ?>
                                <?php if (count($row['older']) > OLDER_VERSIONS_SHOWN): ?>
                                    <a class="view-all" href="<?= e(OBS_BASE_URL) ?>" target="_blank" rel="noopener"><?= e(tr($lang, 'view_all', count($row['older']))) ?></a>
                                <?php endif; ?>
                            </div>
                        <?php endif; ?>
                    <?php else: ?>
                        <span class="empty">— <span class="dim">(<?= e(tr($lang, 'no_artifact')) ?>)</span></span>
                    <?php endif; ?>
                </td>

                <td>
                    <?php if ($row['report']): ?>
                        <a href="<?= e(obs_url($row['report']['key'])) ?>"><?= e($row['report']['filename']) ?></a>
                    <?php else: ?><span class="empty">—</span><?php endif; ?>
                </td>

                <td>
                    <?php $links = array_filter($t['manual'], static fn($l) => safe_url($l['url']) !== null); ?>
                    <?php if ($links): ?>
                        <?php foreach ($links as $l): ?>
                            <a class="block" href="<?= e(safe_url($l['url'])) ?>" target="_blank" rel="noopener"><?= e($l['label'] !== '' ? $l['label'] : $l['url']) ?></a>
                        <?php endforeach; ?>
                    <?php else: ?><span class="empty">—</span><?php endif; ?>
                </td>

                <!-- 비고: 자유 문구 + 링크 목록 -->
                <td>
                    <?php $rl = array_filter($t['remarks_links'], static fn($l) => safe_url($l['url']) !== null); ?>
                    <?php if ($t['remarks_text'] === '' && !$rl): ?>
                        <span class="empty">—</span>
                    <?php else: ?>
                        <?php if ($t['remarks_text'] !== ''): ?>
                            <div class="rm-text"><?= e($t['remarks_text']) ?></div>
                        <?php endif; ?>
                        <?php foreach ($rl as $l): ?>
                            <a class="block" href="<?= e(safe_url($l['url'])) ?>" target="_blank" rel="noopener">▸ <?= e($l['label'] !== '' ? $l['label'] : $l['url']) ?></a>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </td>

                <?php if ($canEdit): ?>
                    <td class="actions">
                        <button class="row-btn" type="button" data-edit="<?= e($t['id']) ?>"><?= e(tr($lang, 'edit')) ?></button>
                        <button class="row-btn del" type="button" data-del="<?= e($t['id']) ?>"><?= e(tr($lang, 'delete')) ?></button>
                    </td>
                <?php endif; ?>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php if (!$rows): ?><p class="table-empty"><?= e(tr($lang, 'no_tools')) ?></p><?php endif; ?>
    <p class="table-empty" id="noMatch" hidden><?= e(tr($lang, 'no_match')) ?></p>
    </div>

    <div class="notice">
        <span class="ic"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></span>
        <span><?= e(tr($lang, 'not_found_msg')) ?>
            <a href="<?= e(FALLBACK_URL) ?>" target="_blank" rel="noopener"><?= e(FALLBACK_URL) ?></a>
        </span>
    </div>
</main>

<footer class="site-footer">
    <span><?= e(tr($lang, 'footer')) ?></span>
    <span><?= e(tr($lang, 'generated', fmt_date(gmdate('c'), 'Y-m-d H:i:s'))) ?></span>
</footer>

<?php if ($canEdit): ?>
<?php require __DIR__ . '/partials/modal.php'; ?>
<script id="toolsData" type="application/json"><?=
    json_encode($toolsData['tools'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE)
?></script>
<script>
window.TH = {
    csrf: <?= json_encode(csrf_token()) ?>,
    hash: <?= json_encode($toolsData['hash']) ?>,
    lang: <?= json_encode($lang) ?>,
    text: <?= json_encode([
        'confirm_del' => tr($lang, 'confirm_del'),
        'conflict'    => tr($lang, 'conflict'),
        'saved'       => tr($lang, 'saved'),
        'deleted'     => tr($lang, 'deleted'),
        'modal_edit'  => tr($lang, 'modal_edit'),
        'modal_add'   => tr($lang, 'modal_add'),
        'ph_label'    => tr($lang, 'ph_label'),
        'ph_url'      => tr($lang, 'ph_url'),
        'add_row'     => tr($lang, 'add_row'),
    ], JSON_UNESCAPED_UNICODE) ?>
};
</script>
<?php endif; ?>
<script src="assets/app.js"></script>
</body>
</html>
