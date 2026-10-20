// Synthetic Contoso tickets, matching the examples of the Contoso Tickets API contract.
export interface Ticket {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'in-progress' | 'resolved';
  service: string;
}

export function createContosoTickets(): Ticket[] {
  return [
    { id: 'CT-1001', title: 'VPN gateway reports intermittent timeouts', severity: 'high', status: 'open', service: 'network' },
    { id: 'CT-1002', title: 'Shared drive close to its quota', severity: 'medium', status: 'in-progress', service: 'storage' },
    { id: 'CT-1003', title: 'Expense app slow at month end', severity: 'low', status: 'resolved', service: 'expense-app' },
  ];
}
