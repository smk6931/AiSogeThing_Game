import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateNovel } from '@api/content/novel';
import './NovelCreate.css';

const NovelCreate = () => {
  const [formData, setFormData] = useState({
    topic: '',
    character_count: 2,
    character_descriptions: '남자 주인공: 20대 후반, 차가운 인상\n여자 주인공: 20대 중반, 밝고 활발한 성격',
    scene_count: 4,
    script_length: 'medium'
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'character_count' || name === 'scene_count' ? parseInt(value) : value
    }));
  };

  const handleGenerate = async () => {
    if (!formData.topic) {
      alert('스토리 주제를 입력해주세요');
      return;
    }

    setLoading(true);

    try {
      // 서버에서 생성을 시작하고 바로 ID를 반환받음
      const data = await generateNovel(formData);
      // 진행 상황을 보기 위해 뷰 페이지로 즉시 이동
      navigate(`/novel/${data.id}?generating=true`);
    } catch (err) {
      console.error(err);
      alert("웹툰 생성 실패: " + (err.response?.data?.detail || err.message));
      setLoading(false);
    }
  };

  return (
    <div className="novel-create-page">
      <h1 className="create-title">AI 웹툰 생성기</h1>

      <div className="create-form">
        {/* 스토리 주제 */}
        <div className="form-group">
          <label className="form-label">스토리 주제 *</label>
          <textarea
            name="topic"
            className="story-input"
            placeholder="예: 비 오는 날 우연히 만난 두 사람의 로맨스"
            value={formData.topic}
            onChange={handleChange}
            rows={3}
            autoFocus
          />
        </div>

        {/* 인물 설정 */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">인물 수</label>
            <select
              name="character_count"
              className="form-select"
              value={formData.character_count}
              onChange={handleChange}
            >
              <option value={1}>1명 (독백)</option>
              <option value={2}>2명 (남녀)</option>
              <option value={3}>3명 (삼각관계)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">컷 개수</label>
            <select
              name="scene_count"
              className="form-select"
              value={formData.scene_count}
              onChange={handleChange}
            >
              <option value={3}>3컷 (짧음)</option>
              <option value={4}>4컷 (기본)</option>
              <option value={5}>5컷 (긴 이야기)</option>
            </select>
          </div>
        </div>

        {/* 인물 설명 */}
        <div className="form-group">
          <label className="form-label">인물 설명</label>
          <textarea
            name="character_descriptions"
            className="story-input"
            placeholder="각 인물의 외형, 성격 등을 설명해주세요"
            value={formData.character_descriptions}
            onChange={handleChange}
            rows={4}
          />
        </div>

        {/* 글 길이 */}
        <div className="form-group">
          <label className="form-label">글 길이</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="script_length"
                value="short"
                checked={formData.script_length === 'short'}
                onChange={handleChange}
              />
              짧게 (2-3줄)
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="script_length"
                value="medium"
                checked={formData.script_length === 'medium'}
                onChange={handleChange}
              />
              보통 (5-7줄)
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="script_length"
                value="long"
                checked={formData.script_length === 'long'}
                onChange={handleChange}
              />
              길게 (10줄+)
            </label>
          </div>
        </div>

        {/* 생성 버튼 */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="generate-btn"
        >
          {loading ? "생성 시작 중..." : "웹툰 생성하기"}
        </button>
      </div>
    </div>
  );
};

export default NovelCreate;
