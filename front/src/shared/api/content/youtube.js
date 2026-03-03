import client from '@api/client';

/**
 * 🎥 유튜브 관련 API (Youtube API)
 */

export const searchYoutube = async (query) => {
  const response = await client.get('/api/content/youtube/search', { params: { query } });
  return response.data;
};

export const getPopularYoutube = async (categoryId = null) => {
  const params = categoryId ? { categoryId } : {};
  const response = await client.get('/api/content/youtube/popular', { params });
  return response.data;
};

// 2. 시청 기록 조회
export const getHistory = async () => {
  // 백엔드가 리스트를 바로 주는지, {data: ...}로 주는지에 따라 다르지만
  // client.js interceptor가 data를 벗겨내는지 확인 필요.
  // 보통 axios는 .data에 본문이 있음.
  // 기존 코드 패턴(response.data 반환)을 따름.
  const response = await client.get('/api/content/youtube/history');
  return response.data;
};

export const getDatingYoutube = async () => {
  const response = await client.get('/api/content/youtube/dating');
  return response.data;
};

export const discoverDatingChannels = async (category = 'reality') => {
  const response = await client.post('/api/content/youtube/dating/discover', { category });
  return response.data;
};

// 1. 시청 로그 저장 (클릭 시 호출) -> log_id 반환됨
export const logYoutubeVideo = async (video) => {
  const payload = {
    video_id: video.id,
    title: video.title,
    description: video.description || "",
    thumbnail_url: video.thumbnail || "",
    channel_title: video.channelTitle || ""
  };

  try {
    const response = await client.post('/api/content/youtube/log', payload);
    return response.data; // { status: "logged", log_id: 123 }
  } catch (error) {
    console.error('Log Error:', error);
    return null;
  }
};

export const updateWatchTime = async (logId, watched) => {
  try {
    await client.post('/api/content/youtube/log/time', {
      log_id: logId,
      watched: Math.floor(watched)
    });
  } catch (e) {
    console.error("Time update failed", e);
  }
};

// 3. 개별 채널 구독 & 취소
export const subscribeChannel = async (channel_id, channel_name) => {
  const response = await client.post('/api/content/youtube/interest/subscribe', { channel_id, channel_name });
  return response.data;
};

export const unsubscribeChannel = async (channel_id) => {
  const response = await client.post('/api/content/youtube/interest/unsubscribe', { channel_id });
  return response.data;
};

// =========================================================
//  사용자 정의 관심사 (RSS) API
// =========================================================
export const discoverInterest = async (keyword) => {
  const response = await client.post('/api/content/youtube/interest/discover', { keyword });
  return response.data;
};

export const getInterestYoutube = async (keyword = null) => {
  const response = await client.get('/api/content/youtube/interest', { params: { keyword } });
  return response.data;
};

export const getAdhocRssVideos = async (channels) => {
  const response = await client.post('/api/content/youtube/interest/rss', { channels });
  return response.data;
};

// 4. 내 구독 리스트 조회
export const getMySubscriptions = async () => {
  const response = await client.get('/api/content/youtube/my-subscriptions');
  return response.data;
};

// 5. DB 수집 영상 조회 (Admin Collect 결과)
export const getDBVideos = async (country, category) => {
  const params = { limit: 50 };
  if (country) params.country = country;
  if (category) params.category = category;
  const response = await client.get('/api/content/youtube/db-list', { params });
  return response.data;
};

// 5. 랜덤 추천 (무한 스크롤용)
export const getRandomVideo = async () => {
  const response = await client.get('/api/content/youtube/recommend/random');
  return response.data;
};
