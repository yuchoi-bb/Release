# ToolHub Release

ToolHub의 연장선에서, **검증된 바이너리**를 공유하기 위한 정적 릴리스 페이지입니다.
`tools.json` 하나가 카탈로그의 유일한 원본이고, 페이지는 이 파일을 읽어 렌더링합니다.

```
tools.json                 카탈로그 (유일한 원본 데이터)
schema/tools.schema.json   JSON Schema
scripts/validate.mjs       검증기 (의존성 없음, Node 18+)
index.html                 릴리스 페이지
assets/style.css           스타일 (라이트/다크 자동)
assets/app.js              렌더링 + 검색/필터
.github/workflows/         tools.json 검증 · GitHub Pages 배포
```

## tools.json 포맷

```jsonc
{
  "schema_version": "1.0.0",
  "hub": {
    "name": "ToolHub Release",
    "tagline": "...",
    "description": "...",
    "download_base": "https://github.com/yuchoi-bb/Release/releases/download",
    "updated_at": "2026-09-11"
  },
  "tools": [
    {
      "tool": "NWin",                                 // 도구 이름 (고유)
      "obs_prefix": "NWin_",                          // 릴리스 파일명 접두사
      "os_supported": ["Windows (x64, x86, arm64)"],  // 표시용 문자열
      "summary": "Windows 환경용 네트워크 진단 도구",
      "category": "network",
      "maintainer": "yuchoi-bb",
      "repo_url": "", "docs_url": "",
      "tags": ["network", "windows"],

      "releases": [
        {
          "version": "1.0.0",
          "channel": "stable",            // stable | rc | beta | alpha
          "released_at": "2026-09-01",    // YYYY-MM-DD
          "notes": "최초 검증 릴리스.",
          "notes_url": "",

          "verification": {
            "status": "verified",         // verified | pending | unverified
            "verified_at": "2026-09-01",
            "verified_by": "yuchoi-bb",
            "method": "sha256",
            "ticket": ""
          },

          "assets": [
            {
              "file": "NWin_1.0.0_windows_x64.zip",   // obs_prefix로 시작해야 함
              "os": "windows",                        // windows | linux | macos
              "arch": "x64",                          // x64 | x86 | arm64 | arm | universal
              "size": 12345678,                       // bytes
              "sha256": "<64 hex>",
              "url": "",                              // 비우면 download_base에서 자동 생성
              "sig_url": ""
            }
          ]
        }
      ]
    }
  ]
}
```

### 필드가 실제로 하는 일

| 필드 | 역할 |
| --- | --- |
| `obs_prefix` | 에셋 파일명 규칙. 검증기가 모든 `assets[].file`이 이 접두사로 시작하는지 확인합니다. |
| `os_supported` | 표시용 문자열이지만, `"OS (arch, arch)"` 형태로 파싱되어 OS 필터와 플랫폼 커버리지 검사에 쓰입니다. |
| `verification.status` | 페이지의 검증 배지와 "검증 완료만" 필터를 결정합니다. |
| `sha256` | 페이지에 복사 버튼과 `Get-FileHash` / `shasum` 검증 명령으로 노출됩니다. |
| `url` | 비어 있으면 `{download_base}/{tool}-{version}/{file}`로 자동 생성됩니다. |

`releases`는 정렬해 둘 필요가 없습니다. 페이지가 `released_at` → `version` 순으로
내림차순 정렬하므로 항상 최신 릴리스가 맨 위에 펼쳐진 상태로 표시됩니다.

## 릴리스 추가하기

1. 바이너리를 GitHub Release에 업로드합니다 (태그: `{tool}-{version}`, 예: `NWin-1.0.0`).
2. 체크섬을 계산합니다.
   ```bash
   sha256sum NWin_1.0.0_windows_x64.zip
   ```
3. `tools.json`의 해당 도구 `releases` 배열에 항목을 추가합니다.
4. 검증합니다.
   ```bash
   node scripts/validate.mjs
   ```
5. 커밋 & 푸시하면 Pages 워크플로가 자동 배포합니다.

검증기는 **error**(빌드 실패)와 **warn**(통과하지만 확인 필요)을 구분합니다.

- error: 중복 이름/버전, `obs_prefix` 불일치, 잘못된 SHA-256, `os_supported`에 없는 플랫폼의 에셋
- warn: 자리표시자 체크섬, `size: 0`, `os_supported`에 있는데 에셋이 없는 플랫폼, `"Window"` 오타

## 로컬에서 보기

```bash
python3 -m http.server 8000
# http://localhost:8000
```

`file://`로 직접 열면 `fetch('./tools.json')`이 CORS로 막히므로 HTTP 서버가 필요합니다.

## 사용자용 검증 안내

```powershell
# Windows
Get-FileHash -Algorithm SHA256 .\NWin_1.0.0_windows_x64.zip
```
```bash
# macOS / Linux
shasum -a 256 NWin_1.0.0_windows_x64.zip
```

출력값이 페이지의 SHA-256과 다르면 **실행하지 마세요.**
