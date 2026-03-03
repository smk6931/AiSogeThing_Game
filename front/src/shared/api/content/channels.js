import client from '@api/client';

// ========== 채널 관련 API ==========
export const getChannelsList = async (params = {}) => {
  const { search, category, limit = 50, offset = 0 } = params;
  const queryParams = new URLSearchParams();
  if (search) queryParams.append('search', search);
  if (category) queryParams.append('category', category);
  queryParams.append('limit', limit);
  queryParams.append('offset', offset);

  const res = await client.get(`/api/content/youtube/channels/list?${queryParams}`);
  return res.data;
};

export const getChannelDetail = async (channelId) => {
  const res = await client.get(`/api/content/youtube/channels/${channelId}`);
  return res.data;
};

// ========== 영상 피드 API ==========
export const getVideosFeed = async (params = {}) => {
  const { sort_by = 'newest', country, category, limit = 50, offset = 0 } = params;
  const queryParams = new URLSearchParams();
  queryParams.append('sort_by', sort_by);
  if (country) queryParams.append('country', country);
  if (category) queryParams.append('category', category);
  queryParams.append('limit', limit);
  queryParams.append('offset', offset);

  const res = await client.get(`/api/content/youtube/videos/feed?${queryParams}`);
  return res.data;
};

export const getLiveVideos = async (params = {}) => {
  const { country = 'KR', category, limit = 20 } = params;
  const queryParams = new URLSearchParams();
  queryParams.append('country', country);
  if (category) queryParams.append('category', category);
  queryParams.append('limit', limit);

  const res = await client.get(`/api/content/youtube/search/live?${queryParams}`);
  return res.data; // { videos: [...] }
};

// ========== 구독 API (기존 유지) ==========
export const subscribeChannel = async (channelId, channelName) => {
  const res = await client.post(
    `/api/content/youtube/interest/subscribe`,
    { channel_id: channelId, channel_name: channelName }
  );
  return res.data;
};

export const unsubscribeChannel = async (channelId) => {
  const res = await client.delete(`/api/content/youtube/interest/unsubscribe/${channelId}`);
  return res.data;
};
