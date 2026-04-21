# Title: F-02 Polygon Clipping General Failure
Description: AI 생성 이미지를 파티션 폴리곤 shape으로 잘라 매핑하는 방식 전반의 실패. 경계선 품질 문제로 전면 포기.
When-To-Read: 파티션에 이미지를 매핑하는 방식을 설계할 때
Keywords: failure, polygon, clipping, partition, boundary, feather, blur
Priority: high

**날짜**: 2026-04-21

---

## 실패 원인

1. AI가 생성한 이미지를 복잡한 폴리곤 shape으로 자르면 경계선이 너덜너덜함
2. feather/GaussianBlur로 완화해도 파티션 경계가 눈에 보임
3. 파티션 shape이 복잡할수록 (좁고 긴 골목, 꺾인 형태) 더 심해짐
4. 인접 파티션끼리 이어 붙이면 경계 단절이 더 강조됨

---

## 결론

**폴리곤 클리핑 방식 전면 포기.**

대안:
- **tile 모드**: 정사각형 이미지 생성 후 UV 타일링으로 연속 지형 연결
- **연속 지형 시스템**: 파티션 경계와 무관하게 world-space UV로 텍스처 연결
- 상세: `world_texture_terrain_direction.md` 참고
