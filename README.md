# CobbleRouge 작물 위키

서버 작물 56종, 성장 촉진제, 전용 나무 8종, 목재 세트와 장식 블록을 모두 찾아볼 수 있는 한국어 정적 위키입니다. 최신 3D 렌더 PNG와 씨앗·묘목의 평면 아이콘을 합해 683장을 담았으며, 성장 단계, 심는 환경, 가격, 조합법을 포함합니다.

## Vercel에 배포하기

1. Vercel의 **Add New → Project**에서 `Cobblemon-Rogelike-Server/cobblerouge-wiki`를 가져옵니다.
2. **Framework Preset: Other**, **Root Directory: 저장소 루트**로 둡니다.
3. 저장소의 `vercel.json`이 **Build Command: `python3 scripts/build.py`**, **Output Directory: `dist`**를 지정합니다. Install Command는 비워 둡니다.
4. **Deploy**를 누릅니다. 환경 변수, 토큰, 데이터베이스는 필요하지 않습니다.
5. 사용자 도메인은 배포 후 **Project Settings → Domains**에서 추가합니다. 클라이언트의 위키 버튼에는 확정된 사이트 주소를 기본 브라우저로 여는 동작을 연결하면 됩니다.

Vercel Git 연동 후 `main`의 변경 사항은 자동으로 배포됩니다. GitHub Pages 배포 워크플로는 포함하지 않습니다.

## 로컬에서 확인하기

Python 3.10 이상만 있으면 됩니다. 외부 패키지나 비공개 저장소 인증은 필요하지 않습니다.

```sh
python3 scripts/build.py
python3 -m http.server 8000 --directory dist
```

http://localhost:8000 에서 확인합니다. 상대 주소와 해시 라우팅을 사용해 항목 링크를 새로고침해도 유지합니다.

## 내용 수정하기

- `content/guides/`: 재배와 섬 꾸미기 안내. 한국어 Markdown 파일을 추가하면 길라잡이 목록에 들어갑니다.
- `content/작물.md`: 재배 환경별 작물 56종과 성장 촉진제. `###` 제목이 개별 작물입니다.
- `content/전용_나무.md`: 나무 크기, 열매, 원목·목재·판자·잎·묘목.
- `content/목재_세트.md`: 계단·반 블록·울타리·울타리 문·문·다락문·압력판·버튼·표지판·매다는 표지판의 조합법.
- `content/장식_블럭.md`: 더미·초가지붕·버섯 갓·화분·등·꽃잎·연잎·바구니·말림 장식.
- `assets/images-*.json`: 문서에 쓰이는 원본 PNG 683장을 Base64로 손실 없이 저장한 이미지 묶음. 빌드 시 `dist/images/`에 원래 파일 그대로 복원합니다. 3D 렌더는 PNG이며 회전 가능한 3D 뷰어는 아닙니다. 게임에서 평면인 씨앗·묘목은 평면 그림으로 표시합니다.
- `scripts/build.py`: 문서를 HTML과 검색 데이터로 변환하고, 작물 수·항목 ID·이미지 참조를 검증합니다.
- `app.js`, `styles.css`, `index.html`: 이름·아이템 ID·본문 검색, 재배 환경 필터, 모바일 메뉴와 상세 화면.

`dist/`는 빌드 결과이므로 Git으로 관리하지 않습니다. 별도 SPA 리라이트나 Node.js 의존성 설치가 필요하지 않습니다.

### 그림 갱신

기존 PNG를 꺼내 편집할 경우 `python3 scripts/image_assets.py --extract-to work`를 실행합니다. `work/images/` 아래의 디렉터리 구조와 파일명을 유지해 그림을 갱신한 뒤 `python3 scripts/image_assets.py --source work/images`로 이미지 묶음을 다시 만드세요. 새 원본 이미지 폴더가 있으면 `--source`에 그 폴더를 바로 지정해도 됩니다. 이 과정은 PNG의 바이트를 변환하거나 다시 렌더링하지 않습니다. 마지막으로 `python3 scripts/build.py`를 실행해 모든 참조를 검증하세요.

## 자료 기준과 권리

자료 기준일: **2026-10-25**. 작물 관련 문서 및 그림만 공개용으로 옮겼습니다. 비공개 모드 저장소를 읽는 배포 코드나 접근 토큰은 없습니다. 운영 중인 서버의 설정과 게임 안내가 최신 기준입니다.

문서와 이미지는 CobbleRouge 프로젝트의 플레이어 안내용 자료입니다. 공개 저장소라는 이유로 재사용 권한이 부여되지는 않습니다. 원본 자료의 권리 고지는 `LICENSE`를 확인하세요.

Minecraft는 Mojang/Microsoft의, Pokémon은 해당 권리자의 상표 및 저작물입니다. 이 위키는 Mojang/Microsoft의 공식 서비스가 아닙니다.
