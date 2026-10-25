export const supportTopics = [{ id: 'ACCOUNT', label: 'Account' }, { id: 'VERIFICATION', label: 'Documents' }, { id: 'LOAD_TRACKING', label: 'Shipment and tracking' }, { id: 'CAPACITY', label: 'Vehicle capacity' }, { id: 'GPS_SETUP', label: 'GPS device setup' }, { id: 'OTHER', label: 'Something else' }];
export const supportTopic = (value: string) => value==='PAYMENT'?'Something else':supportTopics.find(item => item.id === value)?.label || 'Support';
export type SupportSummary = { id: string; category: string; status: string; agent: string; preview: string; updatedAt: string; messageCount: number };
export type SupportList = { open: SupportSummary | null; history: SupportSummary[]; page: number; pageCount: number };
export type SupportThread = SupportSummary & { before: string; hasOlder: boolean; nextBefore: string; messages: { id: string; sequence:number; mine: boolean; body: string; createdAt: string; attachment: { id: string; name: string } | null }[] };
