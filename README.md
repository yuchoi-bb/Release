# ToolHub Release Page

`tools.json` 에 적어둔 도구 정보와, OBS 에 올라간 산출물을 `obs_prefix` 로 매칭해
한 표로 보여줍니다. 관리자는 화면에서 바로 표를 고칠 수 있습니다.

빌드 도구·composer·npm·DB 를 쓰지 않습니다. **폴더째 복사하면 동작합니다.**
외부 CDN 도 쓰지 않아 폐쇄망에서 그대로 렌더됩니다.

## 요구사항

- PHP 8.0 이상 (`str_starts_with`, `match`, enum 아닌 문법만 사용)
- `data/` 디렉터리에 웹서버 계정의 쓰기 권한 — 없으면 표는 보이지만 저장이 실패합니다

## 배포

```bash
# 예: https://toolhub.samsungds.net/release/ 로 서비스하는 경우
rsync -av ./ user@server:/var/www/html/release/
```

경로는 전부 상대경로라 어떤 하위 경로에 두어도 동작합니다.
세션 쿠키도 그 하위 경로로 제한됩니다.

### `data/` 를 웹에서 막기 — 중요

`data/tools.history.jsonl` 에는 **누가 언제 무엇을 바꿨는지**가 전부 들어갑니다.
웹에서 그대로 열리면 안 됩니다. 두 가지 방법 중 하나를 쓰세요.

**1. 웹 루트 바깥에 두기 (권장, 서버 설정 불필요)**

```bash
mkdir -p /var/toolhub-data
mv data/tools.json data/obs_cache.json /var/toolhub-data/
chown www-data:www-data /var/toolhub-data
```

`lib/config.php` 의 `DATA_DIR_EXTERNAL` 이 가리키는 경로가 존재하면 자동으로
그쪽을 씁니다. 기본값은 `/var/toolhub-data` 입니다.

**2. 웹 루트 안에 두고 차단**

`data/.htaccess` 가 함께 들어 있습니다. **Apache 에서만 동작합니다.**
nginx 라면 서버 설정에 아래를 추가하거나, 1번 방법을 쓰세요.

```nginx
location ~ ^/release/data/ { deny all; }
```

## 설정 — `lib/config.php`

| 상수 | 설명 |
|---|---|
| `DATA_DIR_EXTERNAL` | 웹 루트 바깥 데이터 경로. 존재하면 이쪽을 씁니다 |
| `OBS_BASE_URL` | OBS 다운로드 URL 접두. `obs_cache.json` 의 `key` 가 뒤에 붙습니다 |
| `VOC_URL` | 우측 상단 VOC / Feedback 버튼 |
| `FALLBACK_URL` | 표 아래 "도구를 찾을 수 없다면" 안내 링크 |
| `AUTH_MODE` | `local` (설정 계정) 또는 `sso` (사내 SSO) |
| `OLDER_VERSIONS_SHOWN` | 이전 버전을 펼쳤을 때 한 번에 보여줄 개수 |
| `DISPLAY_TZ` | 날짜 표시 시간대. OBS 는 UTC 로 기록합니다 |

### 로그인

표 **열람은 로그인 없이** 되고, **수정·추가·삭제에만** 로그인이 필요합니다.

현재는 `AUTH_MODE = 'local'` 이라 설정 파일의 계정으로 로그인합니다.

```
ID        y_u.choi
Password  123456
```

비밀번호는 평문이 아니라 해시로 저장됩니다. 바꾸려면:

```bash
php -r "echo password_hash('새비밀번호', PASSWORD_DEFAULT);"
```

출력을 `LOCAL_ADMIN_HASH` 에 붙여넣으세요.
`123456` 은 약한 비밀번호입니다. 외부에서 닿는 경로가 생기기 전에 바꾸세요.

### SSO 로 전환

1. `AUTH_MODE` 를 `'sso'` 로 바꿉니다
2. `ADMIN_IDS` 에 수정 권한을 줄 Knox ID 를 넣습니다
3. `SSO_HEADER_ID` / `SSO_HEADER_NAME` 을 프록시가 넣어주는 헤더 이름에 맞춥니다

로그인 화면과 로컬 계정은 자동으로 쓰이지 않게 됩니다. 고칠 코드는 없습니다.

## 데이터

### `tools.json` — 사람이 관리

```json
{
  "schema_version": 1,
  "tools": [
    {
      "id": "nwin",
      "tool": "NWin",
      "obs_prefix": "NWin_",
      "os_supported": ["Windows (x64, x86, arm64)"],
      "product_supported": ["PM1743"],
      "manual":        [{ "label": "Manual", "url": "http://..." }],
      "remarks_text":  "Emergency Fix",
      "remarks_links": [{ "label": "Git Repo", "url": "https://..." }],
      "dev_status": "done"
    }
  ]
}
```

- `id` 는 이력 추적용 불변 키입니다. 도구명이 바뀌어도 그대로 둡니다
- `dev_status` 는 `done` / `wip` / `hold` / `deprecated`
- `remarks_text` 는 짧은 문구, `remarks_links` 는 링크 목록입니다 — 화면에서는
  같은 "비고" 칸에 위아래로 쌓여 보입니다

### `obs_cache.json` — 배치가 생성

**이 페이지는 OBS 를 직접 호출하지 않습니다.** 별도 배치가 OBS 를 훑어 아래
형식으로 만들어 두면 읽기만 합니다. 파일이 없어도 페이지는 뜨고, OBS 에서
오는 열만 비워집니다.

```json
{
  "updated_at": "2026-05-15T02:10:01Z",
  "files": [
    { "key": "release/NWin_x64_v2.1.10.zip",
      "filename": "NWin_x64_v2.1.10.zip",
      "last_modified": "2026-05-14T10:29:08Z",
      "size": 12927610 }
  ]
}
```

## 매칭 규칙

| 항목 | 규칙 |
|---|---|
| 도구 귀속 | `filename` 이 `obs_prefix` 로 시작. 여러 개 걸리면 **가장 긴 프리픽스**가 이깁니다 |
| 검증 리포트 | 파일명에 `report` / `verif` 가 있거나 확장자가 `.pdf` |
| 버전 | `_v1.0.63` 과 `_ver2.35` 를 모두 인식 |
| 최신 판별 | 버전을 자리별 숫자로 비교합니다 (`v1.10.0` > `v1.9.0`) |
| 버전이 없으면 | 히스토리 없이 `last_modified` 순으로만 세웁니다 |

파일명에 버전 표기가 없어도 페이지는 깨지지 않습니다. 나중에 버전 규칙이
생기면 코드 수정 없이 이전 버전 목록이 살아납니다.

## 동시 편집과 이력

- 저장할 때 **편집을 시작한 시점의 파일 해시**를 함께 보냅니다. 그 사이 다른
  사람이 저장했으면 덮어쓰지 않고 거절하고, 화면에 새로고침을 안내합니다
- 쓰기는 `flock` 으로 직렬화하고, 임시 파일에 쓴 뒤 바꿔치기합니다
- 모든 변경은 `data/tools.history.jsonl` 에 한 줄씩 쌓입니다. 각 줄에 저장
  직전·직후 전체 내용이 들어 있어, 그 줄을 `tools.json` 으로 되돌려 쓰면 복구됩니다

## 로컬에서 띄우기

```bash
php -S 127.0.0.1:8000
```
