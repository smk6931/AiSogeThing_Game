// 아이템/인벤토리 API
import client from '@api/client';

const itemApi = {
  getInventory: (userId) => client.get(`/api/item/inventory/${userId}`),
};

export default itemApi;
