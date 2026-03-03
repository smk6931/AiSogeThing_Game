import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Code, Server, Database, BrainCircuit, Cpu } from 'lucide-react';
import mermaid from 'mermaid';
import './NovelView.css';

const NovelPortfolio = () => {
  const [diagramSvg, setDiagramSvg] = useState('');

  useEffect(() => {
    // Mermaid 초기화 및 렌더링
    mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });

    const graphDefinition = `
      graph TD
      A[시작: 사용자 입력] --> B[스토리 작가 Script Writer]
      B --> C[표지 디자이너 Cover Gen]
      C --> D[캐릭터 분석가 Char Analyzer]
      D --> E[캐릭터 원화가 Profile Gen]
      E --> F[콘티 작가 Scene Splitter]
      F --> G[웹툰 작화가 Scene Gen]
      G --> H[최종 완료]
      
      style A fill:#2d2d44,stroke:#fff,stroke-width:2px
      style B fill:#333,stroke:#F093FB,stroke-width:2px,color:#fff
      style C fill:#333,stroke:#F093FB,stroke-width:2px,color:#fff
      style D fill:#333,stroke:#F093FB,stroke-width:2px,color:#fff
      style E fill:#333,stroke:#4facfe,stroke-width:2px,color:#fff
      style F fill:#333,stroke:#4facfe,stroke-width:2px,color:#fff
      style G fill:#333,stroke:#4facfe,stroke-width:2px,color:#fff
      style H fill:#2d2d44,stroke:#43e97b,stroke-width:2px,color:#fff
    `;

    try {
      mermaid.render('mermaid-chart', graphDefinition).then(({ svg }) => {
        setDiagramSvg(svg);
      });
    } catch (error) {
      console.error('Mermaid rendering failed:', error);
    }
  }, []);

  return (
    <div className="novel-view-page">
      <div className="view-nav">
        <Link to="/novel" className="back-link">← 포트폴리오 닫기</Link>
      </div>

      <header style={{ textAlign: 'center', marginBottom: '40px', marginTop: '20px' }}>
        <h1 style={{
          fontSize: '2.2rem',
          background: 'linear-gradient(45deg, #FF0080, #7928CA)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '10px',
          fontWeight: '800'
        }}>
          AI 웹툰 생성 시스템 아키텍처
        </h1>
        <p style={{ color: '#ccc', fontSize: '1.1rem' }}>
          Google Gemini 2.0 & LangGraph 기반의 완전 자동화 파이프라인
        </p>
      </header>

      {/* 1. Core Tech Stack */}
      <div className="synopsis-section">
        <div className="section-header">
          <Code size={24} color="#F093FB" />
          <h2>핵심 기술 스택 (Tech Stack)</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '16px' }}>
          <TechCard icon={<BrainCircuit size={32} />} title="AI 엔진" desc="Google Gemini 2.0 Flash (LangChain 연동)" />
          <TechCard icon={<Cpu size={32} />} title="오케스트레이션" desc="LangGraph 상태 머신 (State Machine)" />
          <TechCard icon={<Server size={32} />} title="백엔드" desc="FastAPI (비동기 처리) + Background Tasks" />
          <TechCard icon={<Database size={32} />} title="데이터베이스" desc="PostgreSQL + SQLAlchemy (AsyncPG)" />
        </div>
      </div>

      {/* 2. Pipeline Workflow */}
      <div className="story-section">
        <div className="section-header">
          <Cpu size={24} color="#4facfe" />
          <h2>자동화 생성 파이프라인 (LangGraph Flow)</h2>
        </div>

        {/* Mermaid Diagram Container */}
        <div style={{ background: '#1e1e2e', padding: '20px', borderRadius: '12px', marginTop: '16px', display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
          {diagramSvg ? (
            <div dangerouslySetInnerHTML={{ __html: diagramSvg }} style={{ width: '100%', maxWidth: '800px' }} />
          ) : (
            <p style={{ color: '#666' }}>Loading Diagram...</p>
          )}
        </div>

        <div style={{ background: '#1e1e2e', padding: '20px', borderRadius: '12px', marginTop: '16px' }}>
          <WorkflowStep number="01" title="스토리 작가 (Script Writer)" desc="사용자 주제를 기반으로 웹툰 대본(Script) 및 장면(Scene) 구조화 (Gemini 2.0)" />
          <WorkflowStep number="02" title="캐릭터 분석 (Character Analysis)" desc="대본에서 등장인물의 외형적 특징(Visual Features) 자동 추출 및 DB화" />
          <WorkflowStep number="03" title="일관성 유지 (Consistency Check)" desc="캐릭터 이미지 생성 후, 해당 외형 묘사를 컷 생성 프롬프트에 주입" />
          <WorkflowStep number="04" title="작화 생성 (Scene Generation)" desc="각 장면별 상황(Context)과 캐릭터 외형을 결합하여 고품질 컷 생성" />
          <WorkflowStep number="05" title="실시간 피드백 (Real-time Feedback)" desc="생성 과정을 Polling하여 프론트엔드에 실시간 진행률 표시 및 에러 시 롤백" />
        </div>
      </div>

      {/* 3. System Architecture */}
      <div className="synopsis-section">
        <div className="section-header">
          <Server size={24} color="#43e97b" />
          <h2>시스템 아키텍처 및 특징</h2>
        </div>
        <div style={{ color: '#ddd', lineHeight: '1.6', marginTop: '10px' }}>
          <p>본 프로젝트는 <strong>Modular Monolith</strong> 아키텍처를 기반으로 설계되었습니다.
            <strong>FastAPI</strong>의 비동기 처리를 통해 무거운 AI 작업을 백그라운드 큐로 처리하며,
            <strong>LangGraph</strong>를 도입하여 복잡한 생성 단계를 상태(State) 기반으로 관리하여 안정성을 확보했습니다.</p>
          <br />
          <ul style={{ paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px' }}>⚡ <strong>비동기 처리 (Async Processing):</strong> 이미지 생성 등 오래 걸리는 작업을 Non-blocking으로 처리하여 서버 성능 최적화</li>
            <li style={{ marginBottom: '8px' }}>🔄 <strong>에러 롤백 (Robust Error Handling):</strong> 생성 중 실패 시 자동 감지 및 DB 데이터 정리(Rollback)로 데이터 무결성 보장</li>
            <li style={{ marginBottom: '8px' }}>📱 <strong>반응형 UI (Responsive Design):</strong> 모바일 환경에 최적화된 포스터형 갤러리 UI 및 로딩 경험(Skeleton UX) 제공</li>
          </ul>
        </div>
      </div>

      <div style={{ height: '50px' }}></div>
    </div>
  );
};

const TechCard = ({ icon, title, desc }) => (
  <div style={{ background: '#2d2d44', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
    <div style={{ color: 'var(--pink-500)', marginBottom: '10px' }}>{icon}</div>
    <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: '#fff' }}>{title}</h3>
    <p style={{ fontSize: '0.9rem', color: '#aaa', wordBreak: 'keep-all' }}>{desc}</p>
  </div>
);

const WorkflowStep = ({ number, title, desc }) => (
  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '16px' }}>
    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#666', marginRight: '16px', minWidth: '40px' }}>{number}</span>
    <div>
      <h4 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '4px' }}>{title}</h4>
      <p style={{ fontSize: '0.9rem', color: '#bbb', wordBreak: 'keep-all' }}>{desc}</p>
    </div>
  </div>
);

export default NovelPortfolio;
