// 몬스터 템플릿 API
import client from '@api/client';

const monsterApi = {
  getTemplate: (templateId) => client.get(`/api/monsters/templates/${templateId}`),
  getAllTemplates: () => client.get('/api/monsters/templates'),
};

export default monsterApi;
