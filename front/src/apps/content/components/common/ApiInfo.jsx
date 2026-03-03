import './ApiInfo.css';
import { Activity } from 'lucide-react';

export default function ApiInfo({ remaining, limit = 25000, name = "API Query" }) {
  // 남은 횟수가 없거나 Unknown이면 기본 텍스트 표시
  if (remaining === undefined || remaining === 'Unknown' || remaining === null) {
    return (
      <div className="api-info glass">
        <Activity size={14} className="api-info-icon" />
        <span>API 상태 확인 중...</span>
      </div>
    );
  }

  // 퍼센트 계산 (남은 양)
  const percent = (Number(remaining) / Number(limit)) * 100;

  // 색상 결정 (얼마 안 남으면 빨간색)
  let statusColor = '#4ade80'; // Green
  if (percent < 20) statusColor = '#f87171'; // Red
  else if (percent < 50) statusColor = '#fbbf24'; // Yellow

  return (
    <div className="api-info glass">
      <div className="api-info-header">
        <Activity size={14} color={statusColor} />
        <span className="api-info-label">{name}</span>
      </div>
      <div className="api-info-content">
        <span className="api-info-count" style={{ color: statusColor }}>
          {Number(remaining).toLocaleString()}
        </span>
        <span className="api-info-limit"> / {Number(limit).toLocaleString()}</span>
      </div>
      <div className="api-info-bar-bg">
        <div
          className="api-info-bar-fill"
          style={{ width: `${percent}%`, backgroundColor: statusColor }}
        ></div>
      </div>
    </div>
  );
}
