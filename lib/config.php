<?php
// =============================================================================
// ToolHub Release Page — 설정
//
// 이 파일 하나만 고치면 배포 환경에 맞출 수 있습니다.
// =============================================================================
declare(strict_types=1);

// -----------------------------------------------------------------------------
// 데이터 디렉터리
//
// tools.json 과 변경 이력이 들어갑니다. 웹에서 직접 열리면 "누가 언제 무엇을
// 바꿨는지"가 그대로 노출되므로, 웹 루트 바깥 경로를 첫 번째로 시도합니다.
// 그 경로가 없으면 프로젝트 안의 data/ 를 쓰고, 이때는 data/.htaccess 가 접근을
// 막습니다(Apache 한정 — nginx 라면 아래 경로를 웹 루트 밖으로 옮기세요).
// -----------------------------------------------------------------------------
const DATA_DIR_EXTERNAL = '/var/toolhub-data';

define('DATA_DIR', is_dir(DATA_DIR_EXTERNAL) ? DATA_DIR_EXTERNAL : __DIR__ . '/../data');

define('TOOLS_JSON', DATA_DIR . '/tools.json');
define('TOOLS_LOCK', DATA_DIR . '/tools.json.lock');
define('TOOLS_HIST', DATA_DIR . '/tools.history.jsonl');
define('OBS_CACHE',  DATA_DIR . '/obs_cache.json');

// -----------------------------------------------------------------------------
// 외부 링크
// -----------------------------------------------------------------------------

// OBS 오브젝트 다운로드 URL 접두. obs_cache.json 의 key 가 뒤에 붙습니다.
const OBS_BASE_URL = 'http://obs.saaa.net/';

// 우측 상단 VOC / Feedback 버튼.
const VOC_URL = 'http://bbb.com';

// 표에서 도구를 찾지 못했을 때 안내하는 링크.
const FALLBACK_URL = 'https://aaa.com';

// -----------------------------------------------------------------------------
// 인증
//
//   'local' — 아래 계정으로 로그인합니다. SSO 연동 전까지 쓰는 임시 방식입니다.
//   'sso'   — 리버스 프록시가 넣어주는 SSO 헤더를 읽고, ADMIN_IDS 로 권한을 봅니다.
//
// 어느 쪽이든 "표 열람은 로그인 없이, 수정은 로그인 후"로 동작합니다.
// -----------------------------------------------------------------------------
const AUTH_MODE = 'local';

// AUTH_MODE = 'local' 일 때 쓰는 계정.
// 비밀번호는 평문 대신 해시로 둡니다. 바꾸려면 아래 명령의 출력을 붙여넣으세요.
//   php -r "echo password_hash('새비밀번호', PASSWORD_DEFAULT);"
const LOCAL_ADMIN_ID   = 'y_u.choi';
const LOCAL_ADMIN_NAME = '관리자';
const LOCAL_ADMIN_HASH = '$2y$12$L0SgF1MIQf2r5IWXVHW8lOiV4pbH3cQws/Cky0WYsInT0Yvmx3KJq'; // 123456

// AUTH_MODE = 'sso' 일 때 표를 수정할 수 있는 Knox ID 목록.
const ADMIN_IDS = [
    // 'y_u.choi',
];

// SSO 사용자 정보가 담겨 오는 헤더 이름. 프록시 설정에 맞게 고치세요.
const SSO_HEADER_ID   = 'HTTP_X_SSO_USER';
const SSO_HEADER_NAME = 'HTTP_X_SSO_NAME';

// 로그인 실패 시 지연(초). 무차별 대입을 늦춥니다.
const LOGIN_FAIL_DELAY = 1;

// -----------------------------------------------------------------------------
// 표시 옵션
// -----------------------------------------------------------------------------

// '이전 버전'을 펼쳤을 때 한 번에 보여줄 개수. 넘으면 '전체 보기'가 붙습니다.
const OLDER_VERSIONS_SHOWN = 5;

// 화면에 날짜를 찍을 때 쓰는 시간대. OBS 는 UTC 로 기록합니다.
const DISPLAY_TZ = 'Asia/Seoul';

// 개발 현황 선택지. 값은 코드로 저장하고 라벨만 언어별로 꺼내 씁니다.
const DEV_STATUSES = ['done', 'wip', 'hold', 'deprecated'];
