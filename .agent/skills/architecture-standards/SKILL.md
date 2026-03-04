---
name: 프로젝트 아키텍처 구조 가이드 (Architecture Standards)
description: 백엔드(FastAPI)와 프론트엔드(React+Three.js)의 폴더 구조, 계층 분리 원칙, 절대경로 별칭 사용 규칙을 정의합니다.
---

# 프로젝트 아키텍처 개요

이 스킬은 3개의 세부 스킬로 분리되었습니다. 상세 내용은 각 스킬을 참조하세요.

## 백엔드 구조
→ 스킬: **back-structure**
- 도메인 최상위 폴더 + 내부 계층(routers/services/models/schemas/managers) 구조
- 가상환경 위치, 임포트 규칙, 파일명 규칙

## 프론트엔드 구조
→ 스킬: **front-structure**
- api / contexts / hooks / screens / ui / entity / engine 역할별 폴더 구조

## 프론트엔드 경로 별칭
→ 스킬: **front-alias-rules**
- @api, @contexts, @hooks, @screens, @ui, @entity, @engine Alias 목록과 사용 예시

## 핵심 원칙 (공통)
- 백엔드: 최상위 = 도메인(user/player/monster/world), 내부 = 계층(routers/services 등)
- 프론트: 기술적 역할 기반 최상위, entity/ 는 백엔드 도메인과 1:1 매핑
- 새 도메인 추가 시: 백엔드 `back/새도메인/`, 프론트 `entity/새도메인/` 동시 생성
