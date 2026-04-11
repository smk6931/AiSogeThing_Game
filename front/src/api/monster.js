// 몬스터 템플릿 API
import client from '@api/client';

const monsterApi = {
  getTemplate: (templateId) => client.get(`/api/monsters/templates/${templateId}`),
  getAllTemplates: () => client.get('/api/monsters/templates'),
  getSpawnConfig: () => client.get('/api/monsters/spawn-config'),
  setSpawnConfig: (enabledIds) => client.put('/api/monsters/spawn-config', { enabled_template_ids: enabledIds }),
  respawn: () => client.post('/api/monsters/respawn'),
};

export default monsterApi;
