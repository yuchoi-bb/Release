<?php
// 편집 모달. 수정 권한이 있을 때만 index.php 가 include 합니다.
declare(strict_types=1);
?>
<div class="overlay" id="overlay" hidden>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
    <h3 id="modalTitle"></h3>
    <form id="toolForm" class="modal-body" autocomplete="off">
      <input type="hidden" name="id">

      <div class="fld">
        <label for="f-tool"><?= e(tr($lang, 'f_tool')) ?> *</label>
        <input id="f-tool" name="tool" required maxlength="80">
      </div>
      <div class="fld">
        <label for="f-prefix"><?= e(tr($lang, 'f_prefix')) ?> *</label>
        <input id="f-prefix" name="obs_prefix" required maxlength="80" spellcheck="false">
      </div>

      <div class="fld">
        <label for="f-os"><?= e(tr($lang, 'f_os')) ?></label>
        <textarea id="f-os" name="os_supported" rows="2" placeholder="<?= e(tr($lang, 'ph_multi')) ?>"></textarea>
      </div>
      <div class="fld">
        <label for="f-product"><?= e(tr($lang, 'f_product')) ?></label>
        <textarea id="f-product" name="product_supported" rows="2" placeholder="<?= e(tr($lang, 'ph_multi')) ?>"></textarea>
      </div>

      <div class="fld full">
        <label for="f-note"><?= e(tr($lang, 'f_rm_text')) ?></label>
        <input id="f-note" name="remarks_text" maxlength="120" placeholder="<?= e(tr($lang, 'ph_note')) ?>">
      </div>

      <div class="fld full">
        <label><?= e(tr($lang, 'f_manual')) ?></label>
        <div class="linkset" data-linkset="manual"></div>
        <button class="btn-add" type="button" data-add-link="manual"><?= e(tr($lang, 'add_row')) ?></button>
      </div>

      <div class="fld full">
        <label><?= e(tr($lang, 'f_rm_links')) ?></label>
        <div class="linkset" data-linkset="remarks_links"></div>
        <button class="btn-add" type="button" data-add-link="remarks_links"><?= e(tr($lang, 'add_row')) ?></button>
      </div>

      <div class="fld full">
        <label><?= e(tr($lang, 'f_locked')) ?></label>
        <div class="locked">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>
          <?= e(tr($lang, 'f_locked_desc')) ?>
        </div>
      </div>

      <p class="form-error" id="formError" hidden></p>
    </form>
    <div class="modal-foot">
      <button class="btn-ghost" type="button" data-close><?= e(tr($lang, 'cancel')) ?></button>
      <button class="btn-primary" type="submit" form="toolForm"><?= e(tr($lang, 'save')) ?></button>
    </div>
  </div>
</div>
<div class="toast" id="toast" hidden></div>
