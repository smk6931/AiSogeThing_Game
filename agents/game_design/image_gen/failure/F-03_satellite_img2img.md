# Title: F-03 Satellite Img2Img Style Failure
Description: 위성사진을 레퍼런스로 img2img 생성 시 도시 구조가 정원 조감도처럼 재해석된 실패 케이스. 게임 아트 스타일 생성 목적으로는 부적합.
When-To-Read: 위성사진 기반 img2img를 고려할 때
Keywords: failure, satellite, img2img, topdown, garden, urban, city
Priority: medium

**날짜**: 2026-04-18

---

## 실패 원인

- 위성사진의 도시 구조(건물 블록, 도로, 골목)가 "장식적 정원 조감도"로 재해석됨
- 건물 블록 → 조형 정원 / 나무 군집 → 장식 식물 덩어리로 변환
- 탑다운 각도는 맞아도 "playable ground texture"가 아닌 "stylized topdown illustration" 느낌
- 실제 지형 구조와 생성 결과 사이의 스케일 불일치

---

## 결론

위성사진 reference는 **서울 지형 구조 보존 용도**로만 사용.  
게임 아트 스타일이 필요하면 Pinterest 씬 이미지 img2img [S-01] 사용.

위성 img2img의 현재 상태: `partition_satellite_img2img_testing.md` 참고.
