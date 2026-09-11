/* =============================================================================
   ToolHub Release Page — 클라이언트 동작
   테마 전환, 검색, 이전 버전 펼침은 로그인 없이도 동작합니다.
   편집 기능은 window.TH 가 있을 때(= 수정 권한이 있을 때)만 붙습니다.
   ========================================================================== */
(function () {
    'use strict';

    /* -- 테마 ------------------------------------------------------------- */
    var themeBtn = document.getElementById('themeBtn');
    var themeLabel = document.getElementById('themeLabel');
    var LABELS = { light: themeLabel ? themeLabel.textContent : 'Light', dark: null };

    function applyTheme(theme) {
        document.documentElement.dataset.theme = theme;
        if (themeLabel) {
            // 라벨은 서버가 넣어준 현재 언어의 'Light' 문구를 기준으로 짝을 맞춥니다.
            themeLabel.textContent = theme === 'dark'
                ? (LABELS.dark || (LABELS.light === '라이트' ? '다크' : 'Dark'))
                : LABELS.light;
        }
        try { localStorage.setItem('th_theme', theme); } catch (e) {}
    }

    if (themeBtn) {
        applyTheme(document.documentElement.dataset.theme || 'light');
        themeBtn.addEventListener('click', function () {
            applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
        });
    }

    /* -- 이전 버전 펼침 ---------------------------------------------------- */
    document.addEventListener('click', function (ev) {
        var btn = ev.target.closest('.older-toggle');
        if (!btn) return;
        var list = btn.nextElementSibling;
        if (!list) return;
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        list.hidden = open;
    });

    /* -- 검색 -------------------------------------------------------------- */
    var searchInput = document.getElementById('searchInput');
    var tableBody = document.getElementById('tableBody');
    var noMatch = document.getElementById('noMatch');

    if (searchInput && tableBody) {
        searchInput.addEventListener('input', function () {
            var q = searchInput.value.trim().toLowerCase();
            var shown = 0;
            Array.prototype.forEach.call(tableBody.rows, function (row) {
                var hit = q === '' || row.textContent.toLowerCase().indexOf(q) !== -1;
                row.hidden = !hit;
                if (hit) shown++;
            });
            if (noMatch) noMatch.hidden = shown !== 0 || tableBody.rows.length === 0;
        });
    }

    /* -- 여기서부터는 편집 권한이 있을 때만 ------------------------------- */
    if (!window.TH) return;

    var dataEl = document.getElementById('toolsData');
    var tools = dataEl ? JSON.parse(dataEl.textContent) : [];
    var overlay = document.getElementById('overlay');
    var form = document.getElementById('toolForm');
    var title = document.getElementById('modalTitle');
    var formError = document.getElementById('formError');
    var toastEl = document.getElementById('toast');
    var toastTimer;

    function toast(msg) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
    }

    function findTool(id) {
        for (var i = 0; i < tools.length; i++) {
            if (tools[i].id === id) return tools[i];
        }
        return null;
    }

    /* -- 링크 입력 행 ------------------------------------------------------ */
    function linkRow(label, url) {
        var row = document.createElement('div');
        row.className = 'linkrow';

        var l = document.createElement('input');
        l.placeholder = window.TH.text.ph_label;
        l.value = label || '';
        l.dataset.k = 'label';

        var u = document.createElement('input');
        u.placeholder = window.TH.text.ph_url;
        u.value = url || '';
        u.dataset.k = 'url';
        u.type = 'url';

        var rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'rm';
        rm.textContent = '×';
        rm.addEventListener('click', function () { row.remove(); });

        row.append(l, u, rm);
        return row;
    }

    function fillLinkset(name, links) {
        var box = form.querySelector('[data-linkset="' + name + '"]');
        box.textContent = '';
        (links || []).forEach(function (l) { box.appendChild(linkRow(l.label, l.url)); });
    }

    function readLinkset(name) {
        var box = form.querySelector('[data-linkset="' + name + '"]');
        return Array.prototype.map.call(box.querySelectorAll('.linkrow'), function (row) {
            return {
                label: row.querySelector('[data-k="label"]').value.trim(),
                url: row.querySelector('[data-k="url"]').value.trim()
            };
        }).filter(function (l) { return l.label !== '' || l.url !== ''; });
    }

    form.querySelectorAll('[data-add-link]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            form.querySelector('[data-linkset="' + btn.dataset.addLink + '"]').appendChild(linkRow('', ''));
        });
    });

    /* -- 모달 -------------------------------------------------------------- */
    function openModal(tool) {
        formError.hidden = true;
        form.elements.id.value = tool ? tool.id : '';
        form.elements.tool.value = tool ? tool.tool : '';
        form.elements.obs_prefix.value = tool ? tool.obs_prefix : '';
        form.elements.os_supported.value = tool ? (tool.os_supported || []).join('\n') : '';
        form.elements.product_supported.value = tool ? (tool.product_supported || []).join('\n') : '';
        form.elements.remarks_text.value = tool ? (tool.remarks_text || '') : '';
        form.elements.dev_status.value = tool ? tool.dev_status : 'done';
        fillLinkset('manual', tool ? tool.manual : []);
        fillLinkset('remarks_links', tool ? tool.remarks_links : []);

        title.textContent = tool
            ? window.TH.text.modal_edit.replace('%s', tool.tool)
            : window.TH.text.modal_add;

        overlay.hidden = false;
        form.elements.tool.focus();
    }

    function closeModal() { overlay.hidden = true; }

    overlay.addEventListener('click', function (ev) {
        if (ev.target === overlay || ev.target.closest('[data-close]')) closeModal();
    });
    document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && !overlay.hidden) closeModal();
    });

    document.addEventListener('click', function (ev) {
        var add = ev.target.closest('[data-add]');
        if (add) { openModal(null); return; }

        var edit = ev.target.closest('[data-edit]');
        if (edit) { openModal(findTool(edit.dataset.edit)); return; }

        var del = ev.target.closest('[data-del]');
        if (del) { removeTool(del.dataset.del); }
    });

    /* -- 서버 호출 --------------------------------------------------------- */
    function post(url, payload) {
        payload.csrf = window.TH.csrf;
        payload.hash = window.TH.hash;
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function (res) {
            return res.json().catch(function () { return { ok: false, error: 'HTTP ' + res.status }; });
        });
    }

    function handleFailure(data) {
        var msg = data.code === 'conflict' ? window.TH.text.conflict : (data.error || 'error');
        formError.textContent = msg;
        formError.hidden = false;
    }

    form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        formError.hidden = true;

        var payload = {
            tool: {
                id: form.elements.id.value,
                tool: form.elements.tool.value.trim(),
                obs_prefix: form.elements.obs_prefix.value.trim(),
                os_supported: splitLines(form.elements.os_supported.value),
                product_supported: splitLines(form.elements.product_supported.value),
                remarks_text: form.elements.remarks_text.value.trim(),
                dev_status: form.elements.dev_status.value,
                manual: readLinkset('manual'),
                remarks_links: readLinkset('remarks_links')
            }
        };

        post('api/tool_save.php', payload).then(function (data) {
            if (!data.ok) { handleFailure(data); return; }
            // 저장된 내용을 그대로 다시 그리기 위해 새로고침합니다.
            // OBS 매칭 결과가 prefix 변경에 따라 달라질 수 있기 때문입니다.
            sessionStorage.setItem('th_toast', window.TH.text.saved);
            location.reload();
        });
    });

    function removeTool(id) {
        var tool = findTool(id);
        if (!tool) return;
        if (!confirm(window.TH.text.confirm_del.replace('%s', tool.tool))) return;

        post('api/tool_delete.php', { id: id }).then(function (data) {
            if (!data.ok) {
                toast(data.code === 'conflict' ? window.TH.text.conflict : (data.error || 'error'));
                return;
            }
            sessionStorage.setItem('th_toast', window.TH.text.deleted);
            location.reload();
        });
    }

    function splitLines(value) {
        return value.split('\n').map(function (s) { return s.trim(); })
            .filter(function (s) { return s !== ''; });
    }

    /* 새로고침 뒤에 결과 문구를 한 번 띄웁니다. */
    var pending = sessionStorage.getItem('th_toast');
    if (pending) {
        sessionStorage.removeItem('th_toast');
        toast(pending);
    }
})();
