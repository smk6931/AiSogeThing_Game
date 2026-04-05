// 아이템/인벤토리/장비 API
import client from '@api/client';

const itemApi = {
  getInventory: (userId) => client.get(`/api/item/inventory/${userId}`),
  getEquipment: (userId) => client.get(`/api/item/equipment/${userId}`),
  equip: (userId, itemId) => client.put('/api/item/equip', { user_id: userId, item_id: itemId }),
  unequip: (userId, slot) => client.delete(`/api/item/equip/${userId}/${slot}`),
};

export default itemApi;
