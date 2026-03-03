import React, { useState } from 'react';
import { Search, Tag } from 'lucide-react';
import { subscribeChannel, unsubscribeChannel } from '@api/content/channels';
import searchAPI from '@api/content/search';
import './ChannelExplorer.css';

export default function ChannelExplorer({ onChannelClick }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [searchIntent, setSearchIntent] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const data = await searchAPI.searchChannels(query);
      setChannels(data.results || []);
      setSearchIntent(data.intent);
      console.log(`🔍 [SmartSearch] Intent: ${data.intent}, Results: ${data.results?.length || 0}`);
    } catch (error) {
      console.error('Failed to search channels:', error);
      setChannels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSubscribe = async (channel) => {
    try {
      if (channel.is_subscribed) {
        await unsubscribeChannel(channel.channel_id);
      } else {
        await subscribeChannel(channel.channel_id, channel.name);
      }
      alert('구독 완료! 재검색하여 최신 상태를 확인하세요.');
    } catch (error) {
      console.error('Subscribe failed:', error);
    }
  };

  const intentLabels = {
    keyword: '🔍 키워드 검색',
    personalized: '🎯 개인화 추천',
    similar: '✨ 유사 콘텐츠',
    analyze: '📊 성향 분석'
  };

  return (
    <div className="channel-explorer">
      {/* Search Bar */}
      <div className="explorer-header">
        <div className="search-box">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="채널 검색 (예: 추천해줘, 한문철, 한문철이랑 비슷한)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="search-input"
          />
          <button className="search-btn" onClick={handleSearch} disabled={loading}>
            {loading ? '검색중...' : '검색'}
          </button>
        </div>

        {/* Intent Badge */}
        {searchIntent && (
          <div className="intent-badge">
            {intentLabels[searchIntent]}
            <span className="result-count"> ({channels.length}개 결과)</span>
          </div>
        )}
      </div>

      {/* Channel Grid */}
      <div className="channel-grid">
        {loading ? (
          <div className="loading-message">채널을 불러오는 중...</div>
        ) : channels.length === 0 ? (
          <div className="empty-message">
            검색어를 입력해보세요! 🔍
            <br />
            <small>예: "추천해줘", "한문철", "한문철이랑 비슷한"</small>
          </div>
        ) : (
          channels.map((channel) => (
            <div key={channel.channel_id} className="channel-card">
              <div className="channel-avatar">
                {channel.name.charAt(0).toUpperCase()}
              </div>

              <div className="channel-info">
                <h3 className="channel-name" onClick={() => onChannelClick(channel)}>
                  {channel.name}
                </h3>

                {channel.category && (
                  <div className="channel-category">
                    <Tag size={14} />
                    {channel.category}
                  </div>
                )}

                {channel.keywords && (
                  <div className="channel-keywords">
                    {channel.keywords.split(',').slice(0, 3).map((kw, i) => (
                      <span key={i} className="keyword-tag">#{kw.trim()}</span>
                    ))}
                  </div>
                )}

                {channel.description && (
                  <p className="channel-description">
                    {channel.description.substring(0, 100)}
                    {channel.description.length > 100 && '...'}
                  </p>
                )}
              </div>

              <button
                className={`subscribe-btn ${channel.is_subscribed ? 'subscribed' : ''}`}
                onClick={() => handleSubscribe(channel)}
              >
                {channel.is_subscribed ? '구독중 ✓' : '+ 구독하기'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
