# Obsidian Blog Setup (Option A)

이 Vault는 **서버(systemd timer) 자동 push 유지** + Obsidian은 작성 편의 플러그인만 사용합니다.

## 1) 플러그인 설치
- Templater
- QuickAdd
- Obsidian Git (선택)

## 2) Templater 설정
- Template folder location: `Templates`

## 3) QuickAdd 설정 (추천)
- Choice Type: Template
- Name: `New Blog Post`
- Template Path: `Templates/Blog Post.md`
- File Name Format: `{{VALUE:title}}`
- Folder: 원하는 posts 폴더 (예: `content/posts` 또는 현재 폴더)

## 4) Obsidian Git 설정 (중요)
자동화 충돌 방지를 위해 아래는 OFF 권장:
- Auto pull on startup: OFF
- Auto push interval: OFF
- Auto commit interval: OFF

수동 명령만 사용:
- `Obsidian Git: Commit all changes`
- `Obsidian Git: Push`

## 5) 실제 자동 배포는 서버가 담당
- systemd user timer: `blog-autopush.timer`
- 주기: 5분

상태 확인:
```bash
systemctl --user status blog-autopush.timer
journalctl --user -u blog-autopush.service -n 50 --no-pager
```
