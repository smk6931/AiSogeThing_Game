import client from '@api/client';

// ========================================================
//  Novel API
// ========================================================

export const generateNovel = async (requestData) => {
  const response = await client.post('/api/content/novel/generate', requestData);
  return response.data;
};

export const getNovel = async (novelId) => {
  const response = await client.get(`/api/content/novel/${novelId}`);
  return response.data;
};

export const listNovels = async () => {
  const response = await client.get('/api/content/novel/');
  return response.data;
};

export const deleteNovel = async (novelId) => {
  const response = await client.delete(`/api/content/novel/${novelId}`);
  return response.data;
};

export const getCharacterImage = (filename) => {
  return `${client.defaults.baseURL}/api/content/novel/image/character/${filename}`;
};

export const getSceneImage = (filename) => {
  return `${client.defaults.baseURL}/api/content/novel/image/scene/${filename}`;
};
